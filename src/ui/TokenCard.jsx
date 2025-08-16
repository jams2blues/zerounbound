/*Developed by @jams2blues
  File: src/ui/TokenCard.jsx
  Rev : r42
  Summary: Attach .preview-1x1; keep down‑scale fit; video-controls hit‑test. */

import {
  useState, useMemo, useEffect, useCallback,
} from 'react';
import PropTypes        from 'prop-types';
import styledPkg        from 'styled-components';

import useConsent                from '../hooks/useConsent.js';
import detectHazards             from '../utils/hazards.js';
import RenderMedia               from '../utils/RenderMedia.jsx';
import { getIntegrityInfo }      from '../constants/integrityBadges.js';
import { checkOnChainIntegrity } from '../utils/onChainValidator.js';
import PixelButton               from './PixelButton.jsx';
import MakeOfferBtn              from './MakeOfferBtn.jsx';
import IntegrityBadge            from './IntegrityBadge.jsx';
import { useWallet }             from '../contexts/WalletContext.js';
import { EnableScriptsToggle }   from './EnableScripts.jsx';
import FullscreenModal           from './FullscreenModal.jsx';
import PixelConfirmDialog        from './PixelConfirmDialog.jsx';
import countAmount               from '../utils/countAmount.js';
import { shortAddr }             from '../utils/formatAddress.js';
import { resolveTezosDomain }    from '../utils/resolveTezosDomain.js';
import { NETWORK_KEY }           from '../config/deployTarget.js';

const PLACEHOLDER = '/sprites/cover_default.svg';
const VALID_DATA  = /^data:/i;

const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────── helpers ───────────────────────────────────────────*/
const pickDataUri = (m = {}) => (
  [m.displayUri, m.imageUri, m.thumbnailUri, m.artifactUri]
    .find((u) => typeof u === 'string' && VALID_DATA.test(u.trim())) || ''
);

const toArray = (src) => {
  if (Array.isArray(src)) return src;
  if (typeof src === 'string') {
    try { const j = JSON.parse(src); return Array.isArray(j) ? j : [src]; }
    catch { return [src]; }
  }
  if (src && typeof src === 'object') return Object.values(src);
  return [];
};

const authorArray   = (m = {}) => toArray(m.authors);
const creatorArray  = (m = {}) => toArray(m.creators);

const isCreator = (meta = {}, addr = '') =>
  !!addr && creatorArray(meta).some((a) => String(a).toLowerCase() === addr.toLowerCase());

const hrefFor = (addr = '') => `/explore?cmd=tokens&admin=${addr}`;
const isTz = (s) => typeof s === 'string' && /^tz[1-3][1-9A-HJ-NP-Za-km-z]{33}$/i.test(s?.trim());

/*──────── styled shells ────────────────────────────────────*/
const Card = styled.article`
  position: relative;
  border: 2px solid var(--zu-accent,#00c8ff);
  background: var(--zu-bg,#000);
  color: var(--zu-fg,#fff);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 330px;
  transition: box-shadow .15s;
  &:hover { box-shadow: 0 0 6px var(--zu-accent-sec,#ff0); }
`;

const ThumbWrap = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;  /* strict square */
  background: var(--zu-bg-dim,#111);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  outline: none;
  &:focus-visible { box-shadow: inset 0 0 0 3px rgba(0,200,255,.45); }
`;

const FSBtn = styled(PixelButton)`
  position:absolute;
  bottom:4px;
  right:4px;
  opacity:.45;
  &:hover{ opacity:1; }
  z-index:7; /* above preview */
`;

const Meta = styled.section`
  background: var(--zu-bg-alt,#171717);
  padding: 6px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  border-top: 2px solid var(--zu-accent,#00c8ff);

  h4{margin:0;font-size:.82rem;line-height:1.15;font-family:'Pixeloid Sans',monospace;}
  p {margin:0;font-size:.68rem;line-height:1.25;}
`;

const Stat = styled.span`
  display:block;white-space:nowrap;font-size:.65rem;opacity:.85;
`;

const Row = styled.div`
  display:flex;justify-content:space-between;align-items:center;
`;

/*──────── component ───────────────────────────────────────*/
export default function TokenCard({
  token, contractAddress, contractName = '', contractAdmin = '',
}) {
  const meta          = token.metadata || {};
  const integrity     = useMemo(() => checkOnChainIntegrity(meta), [meta]);

  const { walletAddress } = useWallet() || {};

  /* consent flags */
  const scriptKey  = `scripts:${contractAddress}:${token.tokenId}`;
  const [allowNSFW,  setAllowNSFW]  = useConsent('nsfw',  false);
  const [allowFlash, setAllowFlash] = useConsent('flash', false);
  const [allowScr,   setAllowScr]   = useConsent(scriptKey, false);

  const { nsfw, flashing, scripts: scriptHaz } = detectHazards(meta);
  const needsNSFW  = nsfw     && !allowNSFW;
  const needsFlash = flashing && !allowFlash;
  const blocked    = needsNSFW || needsFlash;

  /* auto‑enable scripts when viewer == creator/admin */
  useEffect(() => {
    if (!scriptHaz || allowScr) return;
    const adminMatch = contractAdmin
      && walletAddress
      && contractAdmin.toLowerCase() === walletAddress.toLowerCase();
    if (adminMatch || isCreator(meta, walletAddress)) setAllowScr(true);
  }, [scriptHaz, allowScr, walletAddress, contractAdmin, meta, setAllowScr]);

  /* UI states */
  const preview      = pickDataUri(meta);
  const artifactSvg  = (typeof meta.artifactUri === 'string' && VALID_DATA.test(meta.artifactUri.trim()))
    ? meta.artifactUri.trim()
    : '';
  const fsUri        = (scriptHaz && allowScr && artifactSvg) ? artifactSvg : preview;

  const [thumbOk, setThumbOk]   = useState(true);
  const [fs,      setFs]        = useState(false);

  /* reveal dialog */
  const [revealType, setRevealType] = useState(null);   // 'nsfw' | 'flash' | null
  const [termsOk,    setTermsOk]    = useState(false);

  /* author / creator merge + “more…” toggle */
  const authors  = authorArray(meta);
  const creators = creatorArray(meta);
  const showCreatorsLine = creators.length > 0 && authors.join() !== creators.join();
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const [showAllCreators, setShowAllCreators] = useState(false);

  /* domains */
  const [domains, setDomains] = useState({});
  useEffect(() => {
    const addrs = new Set();
    authors.forEach(a => { if (typeof a === 'string' && isTz(a)) addrs.add(a.trim()); });
    creators.forEach(a => { if (typeof a === 'string' && isTz(a)) addrs.add(a.trim()); });

    addrs.forEach(addr => {
      const key = addr?.toLowerCase();
      if (!key || domains[key] !== undefined) return;
      (async () => {
        const name = await resolveTezosDomain(addr, NETWORK_KEY);
        setDomains(prev => (prev[key] !== undefined ? prev : { ...prev, [key]: name }));
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authors.join('|'), creators.join('|')]);

  const formatEntry = useCallback((val) => {
    if (!val || typeof val !== 'string') return String(val || '');
    const v = val.trim();
    const name = domains[v.toLowerCase()];
    if (name) return name;
    if (v.includes('.') || !/^(tz|kt)/i.test(v)) return v;
    return shortAddr(v);
  }, [domains]);

  const renderEntryList = useCallback((list, showAll, toggle) => {
    const display = showAll ? list : list.slice(0, 3);
    const elems = display.map((item, idx) => {
      const prefix = idx > 0 ? ', ' : '';
      const isAddr = typeof item === 'string' && /^(tz|kt)/i.test(item.trim());
      const content = formatEntry(item);
      return isAddr ? (
        <a
          key={`${item}_${idx}`}
          href={hrefFor(item)}
          style={{ color:'var(--zu-accent-sec,#6ff)', textDecoration:'none', wordBreak:'break-all' }}
        >
          {prefix}{content}
        </a>
      ) : (
        <span key={`${String(item)}_${idx}`} style={{ wordBreak:'break-all' }}>
          {prefix}{content}
        </span>
      );
    });
    if (list.length > 3 && !showAll) {
      elems.push(
        <span key="more">
          …&nbsp;
          <button
            type="button"
            aria-label="Show all entries"
            onClick={() => toggle(true)}
            style={{ background:'none', border:'none', color:'inherit', font:'inherit', cursor:'pointer', padding:0 }}
          >🔻More</button>
        </span>
      );
    }
    return elems;
  }, [formatEntry]);

  /* stats */
  const editions  = countAmount(token);
  const owners    = Number.isFinite(token.holdersCount) ? token.holdersCount : '…';
  const priceTez  = token.price ? (token.price / 1_000_000).toFixed(2) : null;

  /* artifact download permission */
  const artifact        = meta.artifactUri;
  const downloadAllowed = walletAddress
    && (walletAddress.toLowerCase() === (contractAdmin || '').toLowerCase()
      || isCreator(meta, walletAddress));

  /* enable scripts confirm handler */
  const [cfrmScr,   setCfrmScr]   = useState(false);
  const [scrTerms,  setScrTerms]  = useState(false);
  const askEnableScripts = () => { setScrTerms(false); setCfrmScr(true); };
  const confirmScripts   = () => { if (scrTerms) { setAllowScr(true); setCfrmScr(false); } };

  /* navigation helpers (tile = link; keep video controls functional) */
  const tokenHref = `/tokens/${contractAddress}/${token.tokenId}`;
  const goDetail = useCallback(() => { window.location.href = tokenHref; }, [tokenHref]);
  const onKey = (e) => { if (e.key === 'Enter') goDetail(); };
  const isMediaControlsHit = (e) => {
    const v = e.target?.closest?.('video, audio');
    if (!v) return false;
    const r = v.getBoundingClientRect?.(); if (!r) return true;
    const band = Math.max(34, Math.min(64, r.height * 0.22));
    const yFromBottom = r.bottom - (e.clientY ?? 0);
    return yFromBottom <= band;
  };
  const onThumbClick = (e) => { if (!isMediaControlsHit(e)) goDetail(); };

  return (
    <>
      <Card>
        {/* preview (1:1 clickable tile) */}
        <ThumbWrap className="preview-1x1" role="link" tabIndex={0} aria-label="View token detail" onClick={onThumbClick} onKeyDown={onKey}>
          {!blocked && preview && !(!thumbOk || !preview) && (
            <RenderMedia
              uri={preview}
              mime={meta.mimeType}
              allowScripts={scriptHaz && allowScr}
              onInvalid={() => setThumbOk(false)}
              /* Down‑scale only; avoid cropping; center media. */
              style={{ display:'block', width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', objectPosition:'center' }}
            />
          )}

          {!blocked && (!preview || !thumbOk) && (
            <img src={PLACEHOLDER} alt="" style={{ width:'60%', opacity:.45 }} />
          )}

          {blocked && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
              justifyContent:'center', gap:'6px', padding:'0 8px', flexDirection:'column' }}>
              {nsfw && !allowNSFW && (
                <PixelButton size="sm" warning onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRevealType('nsfw'); }}>
                  NSFW&nbsp;🔞
                </PixelButton>
              )}
              {flashing && !allowFlash && (
                <PixelButton size="sm" warning onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRevealType('flash'); }}>
                  Flashing&nbsp;🚨
                </PixelButton>
              )}
            </div>
          )}

          <FSBtn
            size="xs"
            disabled={!(!scriptHaz || allowScr)}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); (!scriptHaz || allowScr) ? setFs(true) : askEnableScripts(); }}
            title={(!scriptHaz || allowScr) ? 'Fullscreen' : 'Enable scripts first'}
          >⛶</FSBtn>
        </ThumbWrap>

        {/* meta info (no VIEW button; tile is the link) */}
        <Meta>
          <Row>
            <span title={getIntegrityInfo(integrity.status).label} style={{ cursor:'pointer', fontSize:'1.1rem' }}>
              <IntegrityBadge status={integrity.status} />
            </span>

            {scriptHaz && (
              <EnableScriptsToggle
                enabled={allowScr}
                onToggle={allowScr ? () => setAllowScr(false) : askEnableScripts}
              />
            )}
          </Row>

          <h4>{meta.name || `#${token.tokenId}`}</h4>

          {authorArray(meta).length > 0 && (
            <p style={{ wordBreak:'break-all' }}>
              Author(s)&nbsp;
              {renderEntryList(authorArray(meta), showAllAuthors, setShowAllAuthors)}
            </p>
          )}
          {showCreatorsLine && (
            <p style={{ wordBreak:'break-all', opacity: authorArray(meta).length > 0 ? 0.8 : 1 }}>
              Creator(s)&nbsp;
              {renderEntryList(creatorArray(meta), showAllCreators, setShowAllCreators)}
            </p>
          )}

          {meta.mimeType && (
            <p>
              FileType:&nbsp;
              {downloadAllowed && artifact
                ? <a href={artifact} download style={{ color:'inherit' }}>{meta.mimeType}</a>
                : meta.mimeType}
            </p>
          )}

          <Stat>Token‑ID&nbsp;{token.tokenId}</Stat>
          <Stat>Amount&nbsp;×{editions}</Stat>
          <Stat>Owners&nbsp;{owners}</Stat>
          {priceTez && <Stat>Price&nbsp;{priceTez}&nbsp;ꜩ</Stat>}

          <div style={{ marginTop:'4px' }}>
            <MakeOfferBtn contract={contractAddress} tokenId={token.tokenId} label="OFFER" />
          </div>

          <p style={{ marginTop:'4px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            Collection:&nbsp;
            <a href={`/contracts/${contractAddress}`} style={{ color:'var(--zu-accent-sec,#6ff)', textDecoration:'none' }}>
              {contractName || formatEntry(contractAddress)}
            </a>
          </p>
        </Meta>
      </Card>

      {/* fullscreen modal */}
      <FullscreenModal
        open={fs}
        onClose={() => setFs(false)}
        uri={fsUri}
        mime={meta.mimeType}
        allowScripts={scriptHaz && allowScr}
        scriptHazard={scriptHaz}
      />

      {/* enable scripts confirm */}
      {cfrmScr && (
        <PixelConfirmDialog
          open
          title="Enable scripts?"
          message={(
            <>
              <label style={{ display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px' }}>
                <input type="checkbox" checked={scrTerms} onChange={(e) => setScrTerms(e.target.checked)} />
                I&nbsp;agree&nbsp;to&nbsp;<a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
              </label>
              Executable HTML / JS can be harmful. Proceed only if you trust the author.
            </>
          )}
          confirmLabel="OK"
          cancelLabel="Cancel"
          confirmDisabled={!scrTerms}
          onConfirm={() => { if (scrTerms) { setAllowScr(true); setCfrmScr(false); } }}
          onCancel={() => setCfrmScr(false)}
        />
      )}

      {/* hazard reveal confirm */}
      {revealType && (
        <PixelConfirmDialog
          open
          title={`Reveal ${revealType === 'nsfw' ? 'NSFW' : 'flashing‑hazard'} content?`}
          message={(
            <>
              {revealType === 'nsfw'
                ? <p style={{ margin:'0 0 8px' }}>This asset is flagged as <strong>Not‑Safe‑For‑Work (NSFW)</strong>. Viewer discretion is advised.</p>
                : <p style={{ margin:'0 0 8px' }}>This asset contains <strong>rapid flashing or strobing effects</strong>.</p>}
              <label style={{ display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap' }}>
                <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
                I&nbsp;confirm&nbsp;I&nbsp;am&nbsp;18 + and&nbsp;agree&nbsp;to&nbsp;<a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
              </label>
            </>
          )}
          confirmLabel="REVEAL"
          cancelLabel="Cancel"
          confirmDisabled={!termsOk}
          onConfirm={() => { if (revealType==='nsfw') setAllowNSFW(true); if (revealType==='flash') setAllowFlash(true); setRevealType(null); setTermsOk(false); }}
          onCancel={() => { setRevealType(null); setTermsOk(false); }}
        />
      )}
    </>
  );
}

TokenCard.propTypes = {
  token: PropTypes.shape({
    tokenId      : PropTypes.oneOfType([PropTypes.string,PropTypes.number]).isRequired,
    metadata     : PropTypes.object,
    price        : PropTypes.number,
    holdersCount : PropTypes.number,
  }).isRequired,
  contractAddress: PropTypes.string.isRequired,
  contractName   : PropTypes.string,
  contractAdmin  : PropTypes.string,
};
/* What changed & why (r42):
   • Use .preview-1x1 for square, no-crop fit.
   • Click-through respects native media controls band.
   • Kept prior feature parity; no layout regressions. */ /* EOF */
