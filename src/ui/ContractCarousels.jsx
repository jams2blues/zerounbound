/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/ContractCarousels.jsx
  Rev :    r761-a8   2025-08-02
  Summary: include factory‑originated contracts using initiator search; restore
           original SlideCard layout and toggles; remove the duplicate Reset
           Carousels button inside this component; place the show‑hidden
           checkbox between the page‑level reset and the carousels; centre and
           stylise instructions with icons; retain MAX_W/GUTTER container,
           spinner and other improvements.  Filter legacy and factory
           originations to only include contracts whose typeHash is listed in
           hashMatrix.json (v1–v4d), excluding unrelated FA2 collections.
─────────────────────────────────────────────────────────────*/

import React, {
  useEffect, useState, useRef, useCallback, useMemo, forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import styledPkg from 'styled-components';
import useEmblaCarousel from 'embla-carousel-react';
import { Buffer } from 'buffer';

import { jFetch, sleep } from '../core/net.js';
import { useWalletContext } from '../contexts/WalletContext.js';
import hashMatrix from '../data/hashMatrix.json' assert { type: 'json' };
import countTokens from '../utils/countTokens.js';
import RenderMedia from '../utils/RenderMedia.jsx';
import PixelHeading from './PixelHeading.jsx';
import PixelButton from './PixelButton.jsx';
import detectHazards from '../utils/hazards.js';
import useConsent from '../hooks/useConsent.js';
import IntegrityBadge from './IntegrityBadge.jsx';
// Pull in both the overlay and toggle components for script opt‑in functionality.
import { EnableScriptsOverlay, EnableScriptsToggle } from './EnableScripts.jsx';
import { checkOnChainIntegrity } from '../utils/onChainValidator.js';
import PixelConfirmDialog from './PixelConfirmDialog.jsx';
import { INTEGRITY_LONG } from '../constants/integrityBadges.js';

/*──────── constants ─────────────────────────────────────────*/
const CARD_W    = 340;
const CLAMP_CSS = `clamp(220px, 24vw, ${CARD_W}px)`;
const MAX_W     = CARD_W * 3 + 64;
const GUTTER    = 32;
const IMG_H     = 'clamp(115px, 18vh, 160px)';

const EMBLA_OPTS = { loop: true, dragFree: true, align: 'center' };

const HIDDEN_KEY = 'zu_hidden_contracts_v1';
const CACHE_KEY  = 'zu_contract_cache_v1';
const DETAIL_TTL = 7 * 24 * 60 * 60 * 1_000;  /* 7 days */
const CACHE_MAX  = 150;
/* Shorten list TTL from 5 minutes to 1 minute so new contracts appear sooner */
const LIST_TTL   = 60_000;
const MIN_SPIN   = 200;
const RETRY_MAX  = 3;
const RETRY_DELAY= 2000;

const TZKT = {
  ghostnet: 'https://api.ghostnet.tzkt.io/v1',
  mainnet : 'https://api.tzkt.io/v1',
};

/*──────── hash helpers ─────────────────────────────────────*/
const VERSION_TO_HASH = Object.entries(hashMatrix)
  .reduce((o, [h, v]) => { o[v] = Number(h); return o; }, {});
const HASHES = { ghostnet: VERSION_TO_HASH, mainnet: VERSION_TO_HASH };
const mkHash = (o) => [...new Set(Object.values(o))].join(',');
const getVer = (net, h) =>
  (Object.entries(HASHES[net]).find(([, n]) => n === h)?.[0] || 'v?').toUpperCase();

/*──────── misc helpers ─────────────────────────────────────*/
const hex2str  = (h) => Buffer.from(h.replace(/^0x/, ''), 'hex').toString('utf8');
const parseHex = (h) => { try { return JSON.parse(hex2str(h)); } catch { return {}; } };
const arr      = (v) => (Array.isArray(v) ? v : []);
const scrub    = (s = '') => s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

/* “identifiable” – image OR scrubbed name */
const identifiable = (name = '', img = null) => Boolean(scrub(name)) || Boolean(img);

/*──────── tiny localStorage cache — shape { data, ts } ─────*/
const readCache = () => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const writeCache = (o) => {
  if (typeof window === 'undefined') return;
  const slim = Object.entries(o)
    .sort(([, a], [, b]) => b.ts - a.ts)
    .slice(0, CACHE_MAX);
  localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(slim)));
};
const getCache   = (k) => readCache()[k] ?? null;
const patchCache = (k, p) => {
  if (typeof window === 'undefined') return;
  const all = readCache();
  all[k] = { data: { ...(all[k]?.data || {}), ...p }, ts: Date.now() };
  writeCache(all);
};

/* wallet‑scoped helpers */
const listKey   = (kind, wallet, net) => `${kind}_${wallet}_${net}`;
const getList   = (k) => getCache(k)?.data?.v || null;
const cacheList = (k, v) => patchCache(k, { v });

/*──────── retry wrapper ────────────────────────────────────*/
async function withRetry(fn, max = RETRY_MAX, delay = RETRY_DELAY) {
  let lastErr;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < max - 1) await sleep(delay);
    }
  }
  throw lastErr;
}

/*──────── tzkt discovery helpers ───────────────────────────*/
/**
 * Fetch contracts originated by a wallet.  This helper now queries both
 * the legacy /contracts endpoint (creator filter) and the modern
 * /operations/originations endpoint (initiator filter) to capture
 * collections deployed via the contract factory.  Results are
 * deduplicated by address and include typeHash/timestamp when available.
 *
 * @param {string} addr Wallet address
 * @param {string} net  Network key ('ghostnet' or 'mainnet')
 * @returns {Promise<Array<{address:string,typeHash:number|undefined,timestamp:any}>>}
 */
async function fetchOriginated(addr, net) {
  if (!addr) return [];
  const base   = `${TZKT[net]}/contracts?creator=${addr}&limit=400`;
  const hashQS = mkHash(HASHES[net]);
  const url1   = `${base}&typeHash.in=${hashQS}`;
  // First attempt: query contracts by creator filtered by known typeHash values.
  const rows1 = await jFetch(url1, 3).catch(() => []);
  const rows  = rows1.length
    ? rows1
    : await jFetch(base, 3).catch(() => []);
  // Filter legacy results to include only contracts whose typeHash is present in
  // hashMatrix.json (allowedHashes).  Without this guard, unrelated FA2
  // collections (e.g. Objkt IPFS collections) may appear in the carousel.
  const allowedHashes = new Set(Object.values(HASHES[net]).map(Number));
  const legacyList = rows
    .filter((c) => c.typeHash !== undefined && allowedHashes.has(Number(c.typeHash)))
    .map((c) => ({
      address  : c.address,
      typeHash : c.typeHash,
      timestamp: c.lastActivityTime || c.firstActivityTime,
    }));
  // Second attempt: query originations by initiator to capture factory‑originated contracts.
  let opRows = [];
  try {
    const opUrl = `${TZKT[net]}/operations/originations?initiator=${addr}&limit=400`;
    opRows = await jFetch(opUrl, 3).catch(() => []);
  } catch {/* ignore network errors */}
  const allowedHashes2 = new Set(Object.values(HASHES[net]).map(Number));
  const opList = [];
  for (const row of opRows) {
    const oc = row?.originatedContract || row?.originated_contract;
    if (!oc) continue;
    // Only include asset contracts whose typeHash matches one of our known versions.
    const okKind = oc.kind === 'asset';
    const thash  = oc.typeHash ?? oc.type_hash;
    const okHash = thash !== undefined && allowedHashes2.has(Number(thash));
    if (okKind && okHash) {
      opList.push({
        address  : oc.address,
        typeHash : thash,
        timestamp: row.timestamp || null,
      });
    }
  }
  // Merge and deduplicate by address.  Prefer entries with a timestamp and typeHash.
  const merged = new Map();
  for (const it of [...legacyList, ...opList]) {
    if (!it || !it.address) continue;
    const prev = merged.get(it.address);
    if (!prev) {
      merged.set(it.address, it);
    } else {
      // If the new entry has a timestamp or typeHash not present on the previous
      // one, merge those fields in.  Keep the earliest timestamp for sort.
      const ts   = it.timestamp || prev.timestamp;
      const tHash= it.typeHash !== undefined ? it.typeHash : prev.typeHash;
      merged.set(it.address, { address: it.address, typeHash: tHash, timestamp: ts });
    }
  }
  return Array.from(merged.values());
}

/* URL encode key for /keys/{key} endpoint */
const quoteKey = (s='') => encodeURIComponent(`"${s}"`);

async function isWalletCollaborator(contractAddr, wallet, net) {
  try {
    const st = await jFetch(
      `${TZKT[net]}/contracts/${contractAddr}/storage`,
      3,
    );
    if (Array.isArray(st.collaborators) && st.collaborators.includes(wallet)) return true;
    if (Number.isInteger(st.collaborators)) {
      const url = `${TZKT[net]}/bigmaps/${st.collaborators}/keys/${quoteKey(wallet)}?select=value`;
      const hit = await jFetch(url, 3).catch(() => null);
      return hit !== null;
    }
  } catch {/* ignore */}
  return false;
}

async function fetchCollaborative(wallet, net) {
  if (!wallet) return [];
  const hashes = [...new Set(Object.values(HASHES[net]))];
  const cands = await jFetch(
    `${TZKT[net]}/contracts?typeHash.in=${hashes.join(',')}&limit=400`,
    3,
  ).catch(() => []);

  const out = [];
  await Promise.all(cands.map(async (c) => {
    const cached = getCache(c.address);
    if (cached?.data?.isCollab) { out.push(cached.data.basic); return; }
    if (await isWalletCollaborator(c.address, wallet, net)) {
      const basic = {
        address  : c.address,
        typeHash : c.typeHash,
        timestamp: c.lastActivityTime || c.firstActivityTime,
      };
      out.push(basic);
      patchCache(c.address, { isCollab: true, basic });
    }
  }));
  return out;
}

/*──────── enrich helper — adds image/meta/total ─────────────*/
async function enrich(list, net, force = false) {
  const rows = await Promise.all(list.map(async (it) => {
    if (!it?.address) return null;

    const cached   = getCache(it.address);
    const detCache = cached?.data?.detail;

    let freshOK = false;
    if (!force && detCache) {
      const ttlOk = (Date.now() - cached.ts) < DETAIL_TTL;
      const chainNewer = it.timestamp && detCache.date && new Date(it.timestamp) > new Date(detCache.date);
      freshOK = ttlOk && !chainNewer;
    }

    let totalLive;
    try {
      totalLive = await countTokens(it.address, net);
    } catch { totalLive = detCache?.total ?? 0; }  // fallback to 0

    if (freshOK) {
      let detail = { ...detCache, total: totalLive };
      if (!identifiable(detail.name, detail.imageUri)) {
        detail = {
          ...detail,
          name    : scrub(detail.name) || it.address,
          imageUri: detail.imageUri || null,
        };
      }
      patchCache(it.address, { detail });   // bump ts
      return detail;
    }

    let detRaw = null;
    try {
      detRaw = await jFetch(
        `${TZKT[net]}/contracts/${it.address}`,
        3,
      );
    } catch {}

    let meta = detRaw?.metadata || {};
    if (!meta.name || !meta.imageUri) {
      try {
        const bm = await jFetch(
          `${TZKT[net]}/contracts/${it.address}/bigmaps/metadata/keys/content`,
          3,
        );
        if (bm?.value) meta = { ...parseHex(bm.value), ...meta };
      } catch {}
    }

    const cleanName = scrub(meta.name || '');

    if (!identifiable(cleanName, meta.imageUri)) {
      const detail = {
        address    : it.address,
        typeHash   : it.typeHash,
        name       : cleanName || it.address,
        description: meta.description || '',
        imageUri   : meta.imageUri || null,
        total      : totalLive,
        version    : getVer(net, it.typeHash),
        date       : it.timestamp
          || detRaw?.firstActivityTime
          || detRaw?.lastActivityTime
          || null,
      };
      patchCache(it.address, { detail });
      return detail;
    }

    const detail = {
      address    : it.address,
      typeHash   : it.typeHash,
      name       : cleanName || it.address,
      description: meta.description || '',
      imageUri   : meta.imageUri || null,
      total      : totalLive,
      version    : getVer(net, it.typeHash),
      date       : it.timestamp
        || detRaw?.firstActivityTime
        || detRaw?.lastActivityTime
        || null,
    };
    patchCache(it.address, { detail });
    return detail;
  }));

  return [...new Map(rows.filter(Boolean).map((r) => [r.address, r])).values()]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

/*──────── styled components ───────────────────────────────*/
const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

const Viewport  = styled.div.withConfig({ componentId: 'cc-viewport' })`
  overflow: hidden;
  position: relative;
`;
const Container = styled.div.withConfig({ componentId: 'cc-container' })`
  display: flex;
`;
const Slide     = styled.div.withConfig({ componentId: 'cc-slide' })`
  flex: 0 0 auto;
  width: ${CLAMP_CSS};
  margin-right: 16px;
`;
const CountBox = styled.span.withConfig({ componentId: 'cc-count' })`
  display: inline-block;
  margin-left: 6px;
  min-width: 26px;
  padding: 1px 5px;
  border: 2px solid var(--zu-fg);
  background: var(--zu-bg-alt);
  font: 900 .68rem/1 'PixeloidSans', monospace;
  text-align: center;
  color: var(--zu-fg);
`;
const CountTiny = styled(CountBox).withConfig({ componentId: 'cc-counttiny' })`
  margin-left: 4px;
  min-width: 18px;
  padding: 0 4px;
  font-size: .65rem;
`;
const AddrLine = styled.p.withConfig({ componentId: 'cc-addr' })`
  font-size: clamp(.24rem,.9vw,.45rem);
  margin: .06rem 0 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const TitleWrap = styled(PixelHeading).withConfig({
  componentId      : 'cc-title',
  shouldForwardProp: (p) => p !== 'level',
}).attrs({ as: 'h3', level: 3 })`
  margin: 0;
  font-size: clamp(.8rem,.65vw + .2vh,1rem);
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;
const ArrowBtn = styled.button.withConfig({ componentId: 'cc-arrow' })`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $left }) => ($left ? 'left:4px;' : 'right:4px;')}
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zu-accent-sec);
  color: #fff;
  border: 2px solid var(--zu-accent);
  font: 900 .85rem/1 'PixeloidSans', monospace;
  cursor: pointer;
  z-index: 5;
  &:hover { background: var(--zu-accent); }
`;
const CardBase = styled.div.withConfig({
  componentId      : 'cc-card',
  shouldForwardProp: (p) => p !== '$dim',
})`
  position: relative;
  width: ${CLAMP_CSS};
  border: 2px solid var(--zu-fg);
  background: var(--zu-bg-alt);
  color: var(--zu-fg);
  display: flex;
  flex-direction: column;
  padding-bottom: .25rem;
  opacity: ${({ $dim }) => ($dim ? 0.45 : 1)};
  cursor: grab;
`;
const BusyWrap = styled.div.withConfig({ componentId: 'cc-busy' })`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  background: #0005;
  z-index: 4;
  pointer-events: none;
  img { width: 46px; height: 46px; }
  p   { font-size: .75rem; margin: 0; color: #fff; }
`;
const ErrorWrap = styled(BusyWrap)`
  background: #f005;
  pointer-events: auto;
  p { font-weight: bold; }
`;

// Use clear emoji glyphs for the show/hide buttons. Previously these
// constants contained only a variation selector or were empty, which
// resulted in no visible emoji rendering on the carousel controls.
// The eye emoji (👁️) signifies that a hidden contract can be revealed,
// while the see‑no‑evil monkey (🙈) conveys that clicking will hide it.
const ICON_EYE  = '👁️';
const ICON_HIDE = '🙈';
const ICON_LOAD = '↻';

const TinyHide = styled(PixelButton).withConfig({ componentId: 'cc-hide' })`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  font-size: .55rem;
  padding: 0 .4rem;
  background: var(--zu-accent-sec);
`;
const TinyLoad = styled(PixelButton).withConfig({ componentId: 'cc-load' })`
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 3;
  font-size: .55rem;
  padding: 0 .4rem;
  background: var(--zu-accent-sec);
`;

/*──────── SlideCard ───────────────────────────────────────*/
const SlideCard = React.memo(function SlideCard({
  contract, hidden, toggleHidden, load,
}) {
  const dim     = hidden.has(contract.address);
  const dateStr = contract.date && !Number.isNaN(new Date(contract.date))
    ? new Date(contract.date).toLocaleDateString()
    : null;

  const hazards = useMemo(() => detectHazards(contract), [contract]);
  const integrity = useMemo(() => checkOnChainIntegrity(contract), [contract]);
  const [consentScripts, setConsentScripts] = useConsent(`scripts:${contract.address}`);

  const [cfrmScr, setCfrmScr] = useState(false);
  const [scrTerms, setScrTerms] = useState(false);

  const askEnableScripts = () => { setScrTerms(false); setCfrmScr(true); };
  const confirmScripts = () => { if (scrTerms) { setConsentScripts(true); setCfrmScr(false); } };

  const [showBadgeDlg, setShowBadgeDlg] = useState(false);
  const badgeBlurb = INTEGRITY_LONG[integrity.status] || 'Unknown integrity status.';

  return (
    <Slide key={contract.address}>
      <CardBase $dim={dim}>
        <div style={{ position: 'relative', height: IMG_H }}>
          {hazards.scripts && !consentScripts ? (
            <EnableScriptsOverlay
              onConsent={askEnableScripts}
              terms="I trust this contract's scripts and am over 18."
            />
          ) : (
            <RenderMedia
              uri={contract.imageUri}
              alt={contract.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderBottom: '1px solid var(--zu-fg)',
              }}
            />
          )}
          <IntegrityBadge
            status={integrity.status}
            onClick={() => setShowBadgeDlg(true)}
            style={{ position: 'absolute', bottom: 4, right: 4, cursor: 'pointer' }}
          />
        </div>

        <TinyLoad
          size="xs"
          title="LOAD CONTRACT"
          onClick={(e) => { e.stopPropagation(); load?.(contract); }}
        >
          {ICON_LOAD}
        </TinyLoad>
        <TinyHide
          size="xs"
          title={dim ? 'Show' : 'Hide'}
          onClick={(e) => { e.stopPropagation(); toggleHidden(contract.address); }}
        >
          {dim ? ICON_EYE : ICON_HIDE}
        </TinyHide>

        <div style={{ padding: '.32rem .4rem 0' }}>
          <TitleWrap>{contract.name}</TitleWrap>
        </div>

        {Number.isFinite(contract.total) && (
          <div
            style={{
              fontSize: '.68rem',
              textAlign: 'center',
              margin: '.15rem 0 0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <span>token count</span>
            <CountTiny>{contract.total}</CountTiny>
          </div>
        )}

        <AddrLine>{contract.address}</AddrLine>
        {dateStr && (
          <p style={{ fontSize: '.7rem', margin: '.04rem 0 0', textAlign: 'center' }}>
            {contract.version} • {dateStr}
          </p>
        )}
        {hazards.scripts && (
          <EnableScriptsToggle
            contractAddress={contract.address}
            onToggle={() => (consentScripts ? setConsentScripts(false) : askEnableScripts())}
            style={{ margin: '0.2rem auto 0', display: 'block' }}
          />
        )}
      </CardBase>

      {/* portal dialogs to body for centering */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* scripts confirm */}
          {cfrmScr && (
            <PixelConfirmDialog
              open
              title="Enable scripts?"
              message={(
                <>
                  <label style={{ display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px' }}>
                    <input
                      type="checkbox"
                      checked={scrTerms}
                      onChange={(e) => setScrTerms(e.target.checked)}
                    />
                    I agree to 
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
                  </label>
                  Executable code can be harmful. Proceed only if you trust the author.
                </>
              )}
              confirmLabel="OK"
              cancelLabel="Cancel"
              confirmDisabled={!scrTerms}
              onConfirm={confirmScripts}
              onCancel={() => setCfrmScr(false)}
            />
          )}

          {/* badge info */}
          {showBadgeDlg && (
            <PixelConfirmDialog
              open
              title="Integrity Status"
              message={badgeBlurb}
              confirmLabel="OK"
              onConfirm={() => setShowBadgeDlg(false)}
            />
          )}
        </>,
        document.body
      )}
    </Slide>
  );
});

/*──────── hold‑scroll helper ───────────────────────────────*/
const useHold = (api) => {
  const t = useRef(null);
  const start = (dir) => {
    if (!api) return;
    dir === 'prev' ? api.scrollPrev() : api.scrollNext();
    t.current = setInterval(
      () => (dir === 'prev' ? api.scrollPrev() : api.scrollNext()),
      200,
    );
  };
  const stop = () => clearInterval(t.current);
  return { start, stop };
};

/*──────── Rail component ───────────────────────────────────*/
const Rail = React.memo(function Rail({
  label, data, emblaRef, hidden,
  toggleHidden, load, busy, error, holdPrev, holdNext, onRetry,
}) {
  return (
    <>
      <div
        style={{
          margin: '.9rem 0 .2rem',
          textAlign: 'center',
          fontFamily: 'PixeloidSans',
        }}
      >
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{label}</span>
        <CountBox>{data.length}</CountBox>
      </div>
      <p
        style={{
          margin: '0 0 .45rem',
          fontSize: '.74rem',
          textAlign: 'center',
          color: 'var(--zu-accent-sec)',
          fontWeight: 700,
        }}
      >
        ↔ drag/swipe • hold ◀ ▶ • Click ↻ to LOAD CONTRACT • /️ 🙈👁️hide/unhide
      </p>
      <div
        style={{
          position: 'relative',
          minHeight: 225,
          margin: '0 auto',
          width: '100%',
          maxWidth: `${MAX_W}px`,
          padding: `0 ${GUTTER}px`,
          boxSizing: 'border-box',
        }}
      >
        {busy && (
          <BusyWrap>
            <img src="/sprites/loading.svg" alt="Loading" />
            <p>Loading…</p>
          </BusyWrap>
        )}
        {error && (
          <ErrorWrap>
            <p>{error}</p>
            <PixelButton onClick={onRetry}>Retry</PixelButton>
          </ErrorWrap>
        )}
        <ArrowBtn
          $left
          onMouseDown={() => holdPrev.start('prev')}
          onMouseUp={holdPrev.stop}
          onMouseLeave={holdPrev.stop}
        >
          ◀
        </ArrowBtn>
        <Viewport ref={emblaRef}>
          <Container>
            {data.length ? (
              data.map((c) => (
                <SlideCard
                  contract={c}
                  hidden={hidden}
                  toggleHidden={toggleHidden}
                  load={load}
                />
              ))
            ) : (
              !busy && !error && (
                <p style={{ margin: '5rem auto', textAlign: 'center' }}>None found.</p>
              )
            )}
          </Container>
        </Viewport>
        <ArrowBtn
          onMouseDown={() => holdNext.start('next')}
          onMouseUp={holdNext.stop}
          onMouseLeave={holdNext.stop}
        >
          ▶
        </ArrowBtn>
      </div>
    </>
  );
});

/*──────── Main component ───────────────────────────────────*/
const ContractCarouselsComponent = forwardRef(function ContractCarousels({ onSelect }, ref) {
  const { address: walletAddress, network } = useWalletContext();

  /* polyfill once */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.customElements.get('model-viewer')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.src  = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);

  /* hidden set */
  const [hidden, setHidden] = useState(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHidden(new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')));
  }, []);
  const toggleHidden = useCallback((addr) => {
    setHidden((p) => {
      const n = new Set(p);
      n.has(addr) ? n.delete(addr) : n.add(addr);
      if (typeof window !== 'undefined') {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...n]));
      }
      return n;
    });
  }, []);

  /* origin & collab lists */
  const [orig, setOrig]   = useState([]);
  const [coll, setColl]   = useState([]);
  const [stage, setStage] = useState('init');
  const [error, setError] = useState(null);
  const [spinStart, setSpinStart] = useState(0);

  // Refs to track latest orig/coll lists. These are used in refresh() to
  // determine whether existing cards should be preserved during loading.
  const origRef = useRef([]);
  const collRef = useRef([]);
  useEffect(() => { origRef.current = orig; }, [orig]);
  useEffect(() => { collRef.current = coll; }, [coll]);

  const refresh = useCallback(async (hard = false) => {
    // If no wallet is connected, clear lists and abort
    if (!walletAddress) {
      setOrig([]);
      setColl([]);
      return;
    }
    setError(null);
    setSpinStart(Date.now());

    // Fetch raw contract lists (originated and collaborative)
    let oRaw, cRaw;
    try {
      [oRaw, cRaw] = await withRetry(async () => Promise.all([
        fetchOriginated(walletAddress, network),
        fetchCollaborative(walletAddress, network),
      ]));
    } catch (e) {
      console.error('Discovery failed after retries:', e);
      setError('Discovery failed after retries. Check network.');
      setStage('error');
      return;
    }

    // Compute basic placeholder rows for each contract
    const mkBasic = (it) => ({
      address    : it.address,
      typeHash   : it.typeHash,
      name       : it.address,
      description: '',
      imageUri   : null,
      total      : null,
      version    : getVer(network, it.typeHash),
      date       : it.timestamp,
    });
    const oBasic = oRaw.map(mkBasic);
    const cBasic = cRaw.map(mkBasic);

    // Merge existing details into the new basic lists.  This ensures that any
    // previously loaded cards remain visible while new contracts load and that
    // new contracts show their placeholder immediately.
    const prevOrigMap = new Map(origRef.current.map((it) => [it.address, it]));
    const oInitial = oBasic.map((it) => prevOrigMap.get(it.address) || it);
    const prevCollMap = new Map(collRef.current.map((it) => [it.address, it]));
    const cInitial = cBasic.map((it) => prevCollMap.get(it.address) || it);

    // Set initial merged lists and mark stage as basic.  Because the lists
    // already contain items, the busy overlay will not cover the carousel
    // during the subsequent loading phase.
    setOrig(oInitial);
    setColl(cInitial);
    setStage('basic');

    // Cache the initial lists for offline storage
    cacheList(listKey('orig', walletAddress, network), oInitial);
    cacheList(listKey('coll', walletAddress, network), cInitial);

    // Fetch enriched (detailed) info for all contracts in parallel
    let oDet, cDet;
    try {
      [oDet, cDet] = await withRetry(async () => Promise.all([
        enrich(oRaw, network, hard),
        enrich(cRaw, network, hard),
      ]));
    } catch (e) {
      console.error('Enrich failed after retries:', e);
      setError('Details load failed after retries. Using basics.');
      setStage('basic');
      return;
    }

    // Respect the minimum spinner duration
    const wait = MIN_SPIN - Math.max(0, Date.now() - spinStart);
    if (wait > 0) await sleep(wait);

    // Update the lists with the fully detailed information and mark as
    // detail stage so refreshes will show spinners only when lists are empty.
    setOrig(oDet);
    setColl(cDet);
    setStage('detail');

    // Cache the detailed lists for offline storage
    cacheList(listKey('orig', walletAddress, network), oDet);
    cacheList(listKey('coll', walletAddress, network), cDet);
  }, [walletAddress, network]);

  useEffect(() => {
    // Kick off an initial refresh and schedule periodic refreshes at LIST_TTL.
    refresh();
    const id = setInterval(() => refresh(), LIST_TTL);

    /**
     * Listen for storage events on both the contract cache and the hidden
     * contracts key.  When the cache changes, force a refresh to pick up
     * newly added or removed contracts.  When the hidden key changes
     * (e.g. via reset in another tab), update the hidden set accordingly.
     */
    const onStorage = (e) => {
      if (!e) return;
      // Force refresh when the contract cache is cleared or updated
      if (e.key === CACHE_KEY) {
        refresh(true);
      }
      // Sync the hidden set when zu_hidden_contracts_v1 changes
      if (e.key === HIDDEN_KEY) {
        try {
          const list = e.newValue ? JSON.parse(e.newValue) : [];
          setHidden(new Set(Array.isArray(list) ? list : []));
        } catch {
          setHidden(new Set());
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [refresh]);

  useImperativeHandle(ref, () => ({ refresh }));

  const [emblaRefO, emblaO] = useEmblaCarousel(EMBLA_OPTS);
  const [emblaRefC, emblaC] = useEmblaCarousel(EMBLA_OPTS);
  const holdOprev = useHold(emblaO);
  const holdOnext = useHold(emblaO);
  const holdCprev = useHold(emblaC);
  const holdCnext = useHold(emblaC);

  const [showHidden, setShowHidden] = useState(false);
  const visOrig = useMemo(
    () => (showHidden ? arr(orig) : arr(orig).filter((c) => !hidden.has(c.address))),
    [orig, hidden, showHidden],
  );
  const visColl = useMemo(
    () => (showHidden ? arr(coll) : arr(coll).filter((c) => !hidden.has(c.address))),
    [coll, hidden, showHidden],
  );

  const busy = stage !== 'detail' && !error;

  return (
    <>
      {/* Show hidden checkbox centered (placed between the global reset button and the carousels) */}
      <label
        style={{
          display: 'block',
          margin: '.6rem 0 .4rem',
          textAlign: 'center',
          color: 'var(--zu-accent)',
          fontWeight: 700,
        }}
      >
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(e) => setShowHidden(e.target.checked)}
        />{' '}
        Show hidden
      </label>
      <Rail
        label="Created"
        data={visOrig}
        emblaRef={emblaRefO}
        hidden={hidden}
        toggleHidden={toggleHidden}
        load={onSelect}
        busy={busy && !orig.length && !error}
        error={stage === 'error' ? error : null}
        holdPrev={holdOprev}
        holdNext={holdOnext}
        onRetry={() => refresh(true)}
      />
      <Rail
        label="Collaborating"
        data={visColl}
        emblaRef={emblaRefC}
        hidden={hidden}
        toggleHidden={toggleHidden}
        load={onSelect}
        busy={busy && !coll.length && !error}
        error={stage === 'error' ? error : null}
        holdPrev={holdCprev}
        holdNext={holdCnext}
        onRetry={() => refresh(true)}
      />
    </>
  );
});

export default ContractCarouselsComponent;

/* What changed & why:
   • Added initiator‑based originations search and deduplication to fetchOriginated(),
     ensuring that collections deployed via the contract factory appear in the
     carousel.  Results from the traditional creator filter and the new
     initiator filter are merged and deduplicated.
   • Restored the SlideCard component to its original design with a Slide wrapper,
     proper media rendering, script enable/disable toggle, token count and
     integrity badge.  Removed the card‑level onClick and redundant extra Slide
     wrappers in Rail.
   • Reintroduced the loading spinner with image, MAX_W/GUTTER container and
     correct use of constants in Rail.  Updated the header revision and summary.
   • Restored centred Show hidden checkbox and renamed the refresh button to
     “RESET CAROUSELS”, centring it below the checkbox.  Enlarged and centred
     the carousel instruction text, applied an accent‑contrasting colour and
     re‑added hide/unhide icons.
   • Updated the RESET CAROUSELS button to clear the contract and hidden
     caches (localStorage entries) and reset the hidden state before
     triggering a hard refresh of the carousels.  Centrally aligned the
     Created/Collaborating headings.
   • Removed the duplicate Reset Carousels button from within the component
     (the page-level reset remains).  Positioned the Show hidden checkbox
     between the global reset and the carousels.  Adjusted the summary and
     revision accordingly.
   • Updated fetchOriginated() to filter both legacy and operations‑based
     lists by typeHash against hashMatrix.json.  Only contracts whose
     typeHash appears in our known versions (v1–v4d) are included, preventing
     unrelated IPFS/Objkt FA2 collections from showing up in the carousels.
*/