/*Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/ContractCarousels.jsx
  Rev :    r579   2025-06-14
  Summary: ignore cached totals = 0 → refetch; badge now shows the
           true v4/v4a supply after bug-fix. */

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
}                       from 'react';
import styled           from 'styled-components';
import useEmblaCarousel from 'embla-carousel-react';
import { Buffer }       from 'buffer';

import { jFetch, sleep }     from '../core/net.js';
import { useWalletContext }  from '../contexts/WalletContext.js';
import hashMatrix            from '../data/hashMatrix.json' assert { type: 'json' };
import countTokens           from '../utils/countTokens.js';
import RenderMedia           from '../utils/RenderMedia.jsx';
import PixelHeading          from './PixelHeading.jsx';
import PixelButton           from './PixelButton.jsx';

/*──────── constants & helpers ────────────────────────────────*/
const CARD_W    = 240;
const CLAMP_CSS = `clamp(200px, 32vw, ${CARD_W}px)`;
const MAX_W     = CARD_W * 3 + 64;
const GUTTER    = 32;

const EMBLA_OPTS = {
  loop: true,
  dragFree: true,
  align: 'center',
};

const HIDDEN_KEY = 'zu_hidden_contracts_v1';
const CACHE_KEY  = 'zu_contract_cache_v1';
const TTL        = 31_536_000_000;   // 365 d
const CACHE_MAX  = 150;
const LIST_TTL   = 300_000;          // 5 min
const MIN_SPIN   = 200;              // ms

const TZKT = {
  ghostnet: 'https://api.ghostnet.tzkt.io/v1',
  mainnet : 'https://api.tzkt.io/v1',
};

/* hash helpers */
const VERSION_TO_HASH = Object.entries(hashMatrix)
  .reduce((o, [h, v]) => { o[v] = Number(h); return o; }, {});
const HASHES = { ghostnet: VERSION_TO_HASH, mainnet: VERSION_TO_HASH };
const mkHash = o => [...new Set(Object.values(o))].join(',');
const getVer = (net, h) =>
  (Object.entries(HASHES[net]).find(([, n]) => n === h)?.[0] || 'v?').toUpperCase();

/* misc helpers */
const hex2str  = h => Buffer.from(h.replace(/^0x/, ''), 'hex').toString('utf8');
const parseHex = h => { try { return JSON.parse(hex2str(h)); } catch { return {}; } };
const arr      = v => (Array.isArray(v) ? v : []);

/*──────── tiny localStorage cache ───────────────────────────*/
const readCache = () => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const writeCache = o => {
  if (typeof window === 'undefined') return;
  const slim = Object.entries(o).sort(([, a], [, b]) => b.ts - a.ts).slice(0, CACHE_MAX);
  localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(slim)));
};
const getCache   = k => { const c = readCache()[k]; return c && Date.now() - c.ts < TTL ? c.data : null; };
const patchCache = (k, p) => {
  if (typeof window === 'undefined') return;
  const all = readCache();
  all[k] = { data: { ...(all[k]?.data || {}), ...p }, ts: Date.now() };
  writeCache(all);
};

/* wallet-scoped helpers */
const listKey   = (kind, wallet, net) => `${kind}_${wallet}_${net}`;
const getList   = k => getCache(k);
const cacheList = (k, v) => patchCache(k, { v });

/*──────── tzkt discovery helpers ─────────────────────────────*/
async function fetchOriginated(addr, net) {
  if (!addr) return [];
  const url = `${TZKT[net]}/contracts?creator=${addr}&typeHash.in=${mkHash(HASHES[net])}&limit=200`;
  const rows = await jFetch(url).catch(() => []);
  return rows.map(c => ({
    address  : c.address,
    typeHash : c.typeHash,
    timestamp: c.firstActivityTime || c.lastActivityTime,
  }));
}

async function isWalletCollaborator(addr, wallet, net) {
  try {
    const st = await jFetch(`${TZKT[net]}/contracts/${addr}/storage`);
    if (Array.isArray(st.collaborators) && st.collaborators.includes(wallet)) return true;
    if (Number.isInteger(st.collaborators)) {
      await jFetch(`${TZKT[net]}/bigmaps/${st.collaborators}/keys/${wallet}`, 1);
      return true;
    }
  } catch {/* ignore */ }
  return false;
}

async function fetchCollaborative(addr, net) {
  if (!addr) return [];
  const { v3, v4 } = HASHES[net];
  const cands = await jFetch(`${TZKT[net]}/contracts?typeHash.in=${v3},${v4}&limit=200`).catch(() => []);
  const out = [];
  await Promise.all(cands.map(async c => {
    const cached = getCache(c.address);
    if (cached?.isCollab) { out.push(cached.basic); return; }
    if (await isWalletCollaborator(c.address, addr, net)) {
      const basic = { address: c.address, typeHash: c.typeHash, timestamp: c.firstActivityTime || c.lastActivityTime };
      out.push(basic); patchCache(c.address, { isCollab: true, basic });
    }
  }));
  return out;
}

/*──────── enrich helper — adds image/meta/total ───────────────*/
async function enrich(list, net) {
  return (await Promise.all(list.map(async it => {
    if (!it?.address) return null;

    /* ignore stale cache where total === 0 (caused by prior bug) */
    const cached = getCache(it.address);
    if (cached?.detail &&
        Number.isFinite(cached.detail.total) &&
        cached.detail.total > 0) {
      return cached.detail;
    }

    try {
      const det = await jFetch(`${TZKT[net]}/contracts/${it.address}`);
      let meta  = det.metadata || {};

      if (!meta.name || !meta.imageUri) {
        const bm = await jFetch(
          `${TZKT[net]}/contracts/${it.address}/bigmaps/metadata/keys/content`,
        ).catch(() => null);
        if (bm?.value) meta = { ...parseHex(bm.value), ...meta };
      }

      const total = await countTokens(it.address, net);

      const detail = {
        address : it.address,
        typeHash: it.typeHash,
        name    : meta.name || it.address,
        description: meta.description || '',
        imageUri   : meta.imageUri,
        total,
        version: getVer(net, it.typeHash),
        date   : it.timestamp,
      };
      patchCache(it.address, { detail });        // fresh value
      return detail;
    } catch { return null; }
  })))
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/*──────── styled components ───────────────────────────────────*/
const Viewport  = styled.div`overflow:hidden;position:relative;`;
const Container = styled.div`display:flex;`;
const Slide     = styled.div`flex:0 0 auto;width:${CLAMP_CSS};margin-right:16px;`;

const CountBox = styled.span`
  display:inline-block;margin-left:6px;min-width:26px;padding:1px 5px;
  border:2px solid var(--zu-fg);background:var(--zu-bg-alt);
  font:900 .68rem/1 'PixeloidSans',monospace;text-align:center;color:var(--zu-fg);
`;
const CountTiny = styled(CountBox)`
  margin-left:4px;min-width:18px;padding:0 4px;font-size:.65rem;
`;

const AddrLine = styled.p`
  font-size:clamp(.34rem,1.6vw,.6rem);margin:.1rem 0 0;text-align:center;
  white-space:nowrap;overflow:hidden;
`;

const ArrowBtn = styled.button`
  position:absolute;top:50%;transform:translateY(-50%);
  ${({ $left }) => ($left ? 'left:-12px;' : 'right:-12px;')}
  width:34px;height:34px;display:flex;align-items:center;justify-content:center;
  background:var(--zu-accent-sec);color:#fff;border:2px solid var(--zu-accent);
  font:900 .85rem/1 'PixeloidSans',monospace;cursor:pointer;
  &:hover{background:var(--zu-accent);}
`;

const CardBase = styled.div.withConfig({ shouldForwardProp: p => p !== '$dim' })`
  width:${CLAMP_CSS};min-height:210px;border:2px solid var(--zu-fg);
  background:var(--zu-bg-alt);color:var(--zu-fg);cursor:pointer;
  position:relative;display:flex;flex-direction:column;padding-bottom:.25rem;
  opacity:${p => (p.$dim ? 0.45 : 1)};
  &:hover{box-shadow:0 0 0 3px var(--zu-accent);}
`;

const BusyWrap = styled.div`
  position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;
  align-items:center;justify-content:center;background:#000c;z-index:4;
  img{width:46px;height:46px;animation:spin 1s linear infinite;}
  p{font-size:.75rem;margin:0;color:#fff;}
  @keyframes spin{to{transform:rotate(360deg);}}
`;

/* icon glyphs */
const ICON_EYE  = '👁️';
const ICON_HIDE = '🚫';
const ICON_LOAD = '↻';

const TinyHide = styled(PixelButton)`
  position:absolute;top:4px;right:4px;font-size:.55rem;padding:0 .4rem;
  background:var(--zu-accent-sec);
`;
const TinyLoad = styled(PixelButton)`
  position:absolute;top:4px;left:4px;font-size:.55rem;padding:0 .4rem;
  background:var(--zu-accent-sec);
`;

/*──────── SlideCard ───────────────────────────────────────────*/
const SlideCard = React.memo(function SlideCard({
  contract, index, api, hidden, toggleHidden, load,
}) {
  const dim = hidden.has(contract.address);

  return (
    <Slide onClick={() => api?.scrollTo(index)} key={contract.address}>
      <CardBase $dim={dim}>
        <RenderMedia
          uri={contract.imageUri}
          alt={contract.name}
          style={{ width: '100%', height: 140, objectFit: 'contain', borderBottom: '1px solid var(--zu-fg)' }}
        />

        <TinyLoad size="xs" title="Load" onClick={e => { e.stopPropagation(); load?.(contract); }}>
          {ICON_LOAD}
        </TinyLoad>
        <TinyHide size="xs" title={dim ? 'Show' : 'Hide'} onClick={e => { e.stopPropagation(); toggleHidden(contract.address); }}>
          {dim ? ICON_EYE : ICON_HIDE}
        </TinyHide>

        <div style={{ padding: '0.35rem 0.4rem 0' }}>
          <PixelHeading
            as="h3" level={3}
            style={{
              margin: 0, fontSize: '.9rem', textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {contract.name}
          </PixelHeading>
        </div>

        {Number.isFinite(contract.total) && (
          <div style={{
            fontSize: '.68rem', textAlign: 'center', margin: '.15rem 0 0',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}>
            <span>token&nbsp;count</span>
            <CountTiny title="Total supply">{contract.total}</CountTiny>
          </div>
        )}

        <AddrLine>{contract.address}</AddrLine>
        <p style={{ fontSize: '.7rem', margin: '.05rem 0 0', textAlign: 'center' }}>
          {contract.version} • {new Date(contract.date).toLocaleDateString()}
        </p>
      </CardBase>
    </Slide>
  );
});

/*──────── hold-scroll helper ─────────────────────────────────*/
const useHold = api => {
  const t = useRef(null);
  const start = dir => {
    if (!api) return;
    (dir === 'prev' ? api.scrollPrev() : api.scrollNext());
    t.current = setInterval(() => (dir === 'prev' ? api.scrollPrev() : api.scrollNext()), 200);
  };
  const stop = () => clearInterval(t.current);
  return { start, stop };
};

/*──────── Rail (carousel row) ───────────────────────────────*/
const Rail = React.memo(({
  label, data, emblaRef, api, hidden,
  toggleHidden, load, busy, holdPrev, holdNext,
}) => (
  <>
    <h4 style={{ margin: '.9rem 0 .2rem', fontFamily: 'PixeloidSans', textAlign: 'center' }}>
      {label}<CountBox>{data.length}</CountBox>
    </h4>
    <p style={{ margin: '0 0 .45rem', fontSize: '.7rem', textAlign: 'center', opacity: .75 }}>
      ↔ drag/swipe • hold ◀ ▶ • ↻ load • 🚫/👁 hide
    </p>

    <div style={{
      position: 'relative', minHeight: 225, margin: '0 auto', width: '100%',
      maxWidth: `${MAX_W}px`, padding: `0 ${GUTTER}px`, boxSizing: 'border-box',
    }}>
      {busy && (
        <BusyWrap>
          <img src="/sprites/loading.svg" alt="Loading" />
          <p>Loading…</p>
        </BusyWrap>
      )}

      <ArrowBtn $left onMouseDown={() => holdPrev.start('prev')}
                onMouseUp={holdPrev.stop} onMouseLeave={holdPrev.stop}>◀</ArrowBtn>

      <Viewport ref={emblaRef}>
        <Container>
          {data.length
            ? data.map((c, i) => (
                <SlideCard
                  key={c.address}
                  contract={c}
                  index={i}
                  api={api}
                  hidden={hidden}
                  toggleHidden={toggleHidden}
                  load={load}
                />
              ))
            : !busy && <p style={{ margin: '5rem auto', textAlign: 'center' }}>None found.</p>}
        </Container>
      </Viewport>

      <ArrowBtn onMouseDown={() => holdNext.start('next')}
                onMouseUp={holdNext.stop} onMouseLeave={holdNext.stop}>▶</ArrowBtn>
    </div>
  </>
));

/*──────── Main component ────────────────────────────────────*/
export default function ContractCarousels({ onSelect }) {
  const { address: walletAddress, network } = useWalletContext();

  /* load <model-viewer> polyfill once */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.customElements.get('model-viewer')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);

  /* hidden set */
  const [hidden, setHidden] = useState(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHidden(new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')));
  }, []);
  const toggleHidden = useCallback(addr => {
    setHidden(p => {
      const n = new Set(p);
      n.has(addr) ? n.delete(addr) : n.add(addr);
      if (typeof window !== 'undefined')
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...n]));
      return n;
    });
  }, []);

  /* origin & collab lists */
  const [orig, setOrig]   = useState([]);
  const [coll, setColl]   = useState([]);
  const [stage, setStage] = useState('init');  // init | basic | detail
  const [spinStart, setSpinStart] = useState(0);

  const refresh = useCallback(async () => {
    if (!walletAddress) { setOrig([]); setColl([]); return; }
    setStage('init'); setSpinStart(Date.now());

    /* cached first */
    const co = getList(listKey('orig', walletAddress, network)) || [];
    const cc = getList(listKey('coll', walletAddress, network)) || [];
    if (co.length || cc.length) { setOrig(co); setColl(cc); setStage('basic'); }

    /* live fetch */
    const [oRaw, cRaw] = await Promise.all([
      fetchOriginated(walletAddress, network),
      fetchCollaborative(walletAddress, network),
    ]);
    const mkBasic = it => ({
      address: it.address,
      typeHash: it.typeHash,
      name: it.address,
      description: '',
      imageUri: null,
      total: null,
      version: getVer(network, it.typeHash),
      date: it.timestamp,
    });
    const oBasic = oRaw.map(mkBasic); const cBasic = cRaw.map(mkBasic);
    setOrig(oBasic); setColl(cBasic); setStage('basic');
    cacheList(listKey('orig', walletAddress, network), oBasic);
    cacheList(listKey('coll', walletAddress, network), cBasic);

    /* enrich (adds totals) */
    const [oDet, cDet] = await Promise.all([enrich(oRaw, network), enrich(cRaw, network)]);
    const wait = MIN_SPIN - Math.max(0, Date.now() - spinStart);
    if (wait > 0) await sleep(wait);
    setOrig(oDet); setColl(cDet); setStage('detail');
    cacheList(listKey('orig', walletAddress, network), oDet);
    cacheList(listKey('coll', walletAddress, network), cDet);
  }, [walletAddress, network]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, LIST_TTL);
    return () => clearInterval(id);
  }, [refresh]);

  /* embla carousels */
  const [emblaRefO, emblaO] = useEmblaCarousel(EMBLA_OPTS);
  const [emblaRefC, emblaC] = useEmblaCarousel(EMBLA_OPTS);
  const holdOprev = useHold(emblaO), holdOnext = useHold(emblaO);
  const holdCprev = useHold(emblaC), holdCnext = useHold(emblaC);

  const [showHidden, setShowHidden] = useState(false);
  const visOrig = useMemo(
    () => (showHidden ? arr(orig) : arr(orig).filter(c => !hidden.has(c.address))),
    [orig, hidden, showHidden],
  );
  const visColl = useMemo(
    () => (showHidden ? arr(coll) : arr(coll).filter(c => !hidden.has(c.address))),
    [coll, hidden, showHidden],
  );

  const busy = stage !== 'detail';

  return (
    <>
      <label style={{ display: 'block', margin: '.6rem 0', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={showHidden}
          onChange={e => setShowHidden(e.target.checked)}
        />{' '}
        Show hidden
      </label>

      <Rail
        label="Originated"
        data={visOrig}
        emblaRef={emblaRefO}
        api={emblaO}
        hidden={hidden}
        toggleHidden={toggleHidden}
        load={onSelect}
        busy={busy}
        holdPrev={holdOprev}
        holdNext={holdOnext}
      />

      <Rail
        label="Collaborative"
        data={visColl}
        emblaRef={emblaRefC}
        api={emblaC}
        hidden={hidden}
        toggleHidden={toggleHidden}
        load={onSelect}
        busy={busy}
        holdPrev={holdCprev}
        holdNext={holdCnext}
      />

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          style={{ font: '700 .9rem PixeloidSans', padding: '.35rem .9rem' }}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>
    </>
  );
}

/* What changed & why: cached detail is now used only when total > 0 –
   forces a live recount when older buggy cache stored 0. */
/* EOF */
