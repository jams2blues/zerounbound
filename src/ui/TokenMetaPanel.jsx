/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/TokenMetaPanel.jsx
  Rev :    r753   2025‑10‑14
  Summary: adaptive hero preview — audio/video fill width,
           never clipped on any viewport
──────────────────────────────────────────────────────────────*/
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import styledPkg            from 'styled-components';

import RenderMedia          from '../utils/RenderMedia.jsx';
import { listUriKeys }      from '../utils/uriHelpers.js';
import { useWalletContext } from '../contexts/WalletContext.js';
import { jFetch }           from '../core/net.js';
import LoadingSpinner       from './LoadingSpinner.jsx';
import PixelButton          from './PixelButton.jsx';
import { checkOnChainIntegrity } from '../utils/onChainValidator.js';
import { getIntegrityInfo }      from '../constants/integrityBadges.js';
import IntegrityBadge       from './IntegrityBadge.jsx';
// Import helpers for Tezos domain resolution and address formatting
import { resolveTezosDomain } from '../utils/resolveTezosDomain.js';
import { shortAddr } from '../utils/formatAddress.js';
import { NETWORK_KEY } from '../config/deployTarget.js';

const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────── helpers ───────────────────────────────────────────*/
const unwrapImgSrc = (s = '') =>
  (s.match(/<img[^>]+src=["']([^"']+)["']/i) || [, ''])[1] || s;

const pickUri = (m = {}) =>
  unwrapImgSrc(
    m.imageUri || m.artifactUri || m.displayUri || m.thumbnailUri || '',
  );

const pct = (v, d) => (Number(v) / 10 ** d * 100)
  .toFixed(2)
  .replace(/\.00$/, '');

const fmtRoyalties = (o = {}) =>
  o.shares
    ? Object.entries(o.shares)
        .map(([a, v]) => `${a.slice(0, 6)}… : ${pct(v, o.decimals || 0)}%`)
        .join(', ')
    : JSON.stringify(o);

const fmtAttrs = (v) => Array.isArray(v)
  ? v.filter((a) => a && a.name).map((a) => `${a.name}: ${a.value}`).join(', ')
  : Object.entries(v || {})
      .filter(([, val]) => val !== undefined && val !== null && val !== '')
      .map(([k, val]) => `${k}: ${val}`)
      .join(', ');

const pretty = (k, v) => {
  if (Array.isArray(v)) return k === 'attributes' ? fmtAttrs(v) : v.join(', ');
  if (v && typeof v === 'object') {
    return k === 'royalties'
      ? fmtRoyalties(v)
      : k === 'attributes'
        ? fmtAttrs(v)
        : JSON.stringify(v);
  }
  try { return pretty(k, JSON.parse(v)); } catch { return String(v); }
};

/*──────── util ─────────────────────────────────────────────*/
const sz = (v) =>
  Array.isArray(v)                     ? v.length
    : v && typeof v.size === 'number'  ? v.size
    : v && typeof v.forEach === 'function' ? [...v].length
    : typeof v === 'number'            ? v
    : v && typeof v.int === 'string'   ? parseInt(v.int, 10)
    : 0;

/* href helper for linking to admin‑filtered explore pages */
const hrefFor = (addr = '') => `/explore?cmd=tokens&admin=${addr}`;

/*──────── styled shells ─────────────────────────────────────*/
const Card = styled.div`
  --zu-chip-h: 34px;
  border:2px solid var(--zu-accent,#00c8ff);
  background:var(--zu-bg,#000);
  color:var(--zu-fg,#f0f0f0);
  padding:clamp(var(--zu-chip-h), 6px, var(--zu-chip-h)) 8px 8px;
  font-size:.75rem;line-height:1.25;overflow:hidden;
  position:relative;

  @media(min-width:480px){
    padding-top:6px;
  }
`;

const AddrRow = styled.div`
  font-size:.65rem;text-align:center;
  display:flex;justify-content:center;align-items:center;gap:4px;
  margin-bottom:4px;
`;
const Warn = styled.div`
  position:absolute;inset:0;background:rgba(0,0,0,.9);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:1rem;
  border:2px dashed var(--zu-accent-sec,#ff0080);z-index:5;
  p{margin:.5rem 0;font-size:.7rem;line-height:1.35;}
  a{color:var(--zu-accent);text-decoration:underline;cursor:pointer;}
`;
const Stats = styled.p`
  margin:0 0 6px;font-size:.72rem;text-align:center;
  display:flex;gap:6px;justify-content:center;align-items:center;
  span{display:inline-block;padding:1px 4px;border:1px solid var(--zu-fg);white-space:nowrap;}
`;
const RelStats = styled(Stats)`margin-top:-2px;gap:4px;font-size:.68rem;opacity:.9;`;
const MetaGrid = styled.dl`
  margin:0;display:grid;grid-template-columns:max-content 1fr;
  column-gap:6px;row-gap:2px;
  dt{white-space:nowrap;color:var(--zu-accent);}
  dd{margin:0;word-break:break-word;}
`;

/* clickable integrity chip */
const IntegrityChip = styled.span`
  position:absolute;top:4px;right:4px;z-index:4;
  display:flex;align-items:center;gap:4px;flex-wrap:wrap;
  max-width:calc(100% - 8px);
  font-size:1rem;line-height:1;
  padding:.15rem .4rem;border:1px solid var(--zu-fg);border-radius:3px;
  background:var(--zu-bg);
  .label{font-size:.55rem;white-space:nowrap;}
  @media(min-width:480px){
    background:transparent;border:none;gap:0;
    .label{display:none;}
  }
`;

/* small util to pick primary author‑like key */
const primaryAuthorKey = (m = {}) =>
  m.authors !== undefined ? 'authors'
  : m.artists !== undefined ? 'artists'
  : 'authors';

/*════════ component ════════════════════════════════════════*/
export default function TokenMetaPanel({
  meta            = null,
  tokenId         = '',
  contractAddress = '',
  contractVersion = '',
  onRemove,
}) {
  const { address: wallet, network = 'ghostnet' } = useWalletContext() || {};

  /*── flags ─*/
  const vLow   = contractVersion.toLowerCase();
  const isV4a  = vLow.startsWith('v4a') || vLow.startsWith('v4c');

  /*── state ─*/
  const [warn,   setWarn]   = useState('');
  const [supply, setSupply] = useState(null);
  const [owned,  setOwned]  = useState(null);
  const [rel,    setRel]    = useState({ coll:0, parent:0, child:0 });
  const [copied, setCopied] = useState(false);

  /* domain resolution state. Holds resolved .tez names keyed by lowercase address. */
  const [domains, setDomains] = useState({});
  /* toggles for showing full lists of authors and creators */
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const [showAllCreators, setShowAllCreators] = useState(false);

  /* Authors and creators arrays extracted from metadata.  Authors fallback
   * to artists if authors are not defined.  Creators are read from
   * metadata.creators.  Each entry can be a string, array or object.
   */
  const authorsList = useMemo(() => {
    const a = metaObj.authors ?? metaObj.artists ?? [];
    if (Array.isArray(a)) return a;
    if (typeof a === 'string') {
      try { const j = JSON.parse(a); return Array.isArray(j) ? j : [a]; }
      catch { return [a]; }
    }
    if (a && typeof a === 'object') return Object.values(a);
    return [];
  }, [metaObj]);
  const creatorsList = useMemo(() => {
    const c = metaObj.creators ?? [];
    if (Array.isArray(c)) return c;
    if (typeof c === 'string') {
      try { const j = JSON.parse(c); return Array.isArray(j) ? j : [c]; }
      catch { return [c]; }
    }
    if (c && typeof c === 'object') return Object.values(c);
    return [];
  }, [metaObj]);

  /* Resolve Tezos domains for all addresses in authorsList and creatorsList.
   * Only addresses matching tz* /KT* patterns are looked up.  Cache results
   * by lowercased address.  Use the global NETWORK_KEY so resolution
   * honours the current network (mainnet vs ghostnet).  */
  useEffect(() => {
    const addrs = new Set();
    authorsList.forEach((item) => {
      if (typeof item === 'string' && /^(tz|kt)/i.test(item.trim())) {
        addrs.add(item);
      }
    });
    creatorsList.forEach((item) => {
      if (typeof item === 'string' && /^(tz|kt)/i.test(item.trim())) {
        addrs.add(item);
      }
    });
    addrs.forEach((addr) => {
      const key = addr.toLowerCase();
      if (domains[key] !== undefined) return;
      (async () => {
        const name = await resolveTezosDomain(addr, NETWORK_KEY);
        setDomains((prev) => {
          if (prev[key] !== undefined) return prev;
          return { ...prev, [key]: name };
        });
      })();
    });
  }, [authorsList, creatorsList, domains]);

  /* Format a single author/creator entry.  If a domain has been
   * resolved for the address, return that domain.  Otherwise, if the
   * value contains a dot, treat it as a human name or domain and
   * return it unchanged.  Addresses (tz* or KT*) are truncated via
   * shortAddr for readability. */
  const formatEntry = useCallback((val) => {
    if (!val || typeof val !== 'string') return String(val || '');
    const v = val.trim();
    const key = v.toLowerCase();
    if (domains[key]) return domains[key];
    if (v.includes('.')) return v;
    if (/^(tz|kt)/i.test(v) && v.length > 12) return shortAddr(v);
    return v;
  }, [domains]);

  /* Render a comma-separated list of entries.  When the list has more
   * than three items and showAll is false, only the first three are
   * displayed followed by a “More” toggle.  Each address-like entry
   * becomes a clickable link to the admin filter route. */
  const renderEntryList = useCallback((list, showAll, toggleFn) => {
    const display = showAll ? list : list.slice(0, 3);
    const items = [];
    display.forEach((item, idx) => {
      const prefix = idx > 0 ? ', ' : '';
      const formatted = formatEntry(item);
      const isAddr = typeof item === 'string' && /^(tz|kt)/i.test(item.trim());
      items.push(
        isAddr ? (
          <a
            key={`${item}-${idx}`}
            href={hrefFor(item)}
            style={{ color: 'var(--zu-accent-sec,#6ff)', textDecoration: 'none', wordBreak: 'break-all' }}
          >
            {prefix}{formatted}
          </a>
        ) : (
          <span key={`${item}-${idx}`} style={{ wordBreak: 'break-all' }}>{prefix}{formatted}</span>
        ),
      );
    });
    if (list.length > 3 && !showAll) {
      items.push(
        <>
          … 
          <button
            type="button"
            aria-label="Show all entries"
            onClick={() => toggleFn(true)}
            style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
          >🔻More</button>
        </>,
      );
    }
    return items;
  }, [formatEntry]);

  /* suppress repeat warnings after user dismiss */
  const supRef = useRef(new Set());
  const suppressWarn = useCallback((r) => {
    if (supRef.current.has(r)) return;
    setWarn(r);
  }, []);
  const dismissWarn = () => { if (warn) supRef.current.add(warn); setWarn(''); };

  /*AdminTools opener */
  const openTool = useCallback((key) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('zu:openAdminTool', {
      detail: { key, contract: contractAddress },
    }));
  }, [contractAddress]);

  /*──────── memo‑derived values ─*/
  const metaObj   = typeof meta === 'object' && meta ? meta : {};
  const hero      = useMemo(() => pickUri(metaObj), [metaObj]);
  const uriArr    = useMemo(() => listUriKeys(metaObj), [metaObj]);

  /* adaptive hero style – never clip audio/video */
  const heroStyle = useMemo(() => {
    const mime = hero.startsWith('data:')
      ? hero.slice(5, hero.indexOf(';')).split(/[;,]/)[0] || ''
      : '';
    if (/^audio\//i.test(mime) || /^video\//i.test(mime)) {
      return {
        width: '100%',
        maxHeight: 120,
        display: 'block',
        margin: '0 auto 6px',
      };
    }
    /* default square thumbnail for images & svg */
    return {
      width: 96,
      height: 96,
      objectFit: 'contain',
      display: 'block',
      margin: '0 auto 6px',
    };
  }, [hero]);

  const integrity = useMemo(() => checkOnChainIntegrity(metaObj), [metaObj]);
  const { label } = useMemo(()=>getIntegrityInfo(integrity.status),[integrity.status]);

  const kvPairs = useMemo(() => {
    const aKey = primaryAuthorKey(metaObj);
    // Build a list of metadata keys excluding authors/artists and creators.  These
    // fields are rendered separately with domain resolution.  See
    // formatEntry/renderEntryList implementations below.
    const keys = [
      'name', 'description', 'mimeType', 'rights',
      'royalties', 'mintingTool', 'accessibility', 'contentRating',
      'tags', 'attributes', 'decimals',
    ];
    return keys
      .filter((k)=>metaObj[k]!==undefined)
      .map((k)=>[k, pretty(k, metaObj[k])]);
  }, [metaObj]);

  const ktShort = contractAddress
    ? `${contractAddress.slice(0, 5)}…${contractAddress.slice(-4)}`
    : '';

  const copyAddr = async () => {
    if (!contractAddress || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopied(true); setTimeout(() => setCopied(false), 800);
    } catch {}
  };

  /* relationship counts */
  useEffect(() => {
    if (!contractAddress) return;
    const base = network === 'mainnet'
      ? 'https://api.tzkt.io/v1'
      : 'https://api.ghostnet.tzkt.io/v1';
    (async () => {
      try {
        const st = await jFetch(`${base}/contracts/${contractAddress}/storage`);
        setRel({
          coll  : sz(st?.collaborators),
          parent: sz(st?.parents),
          child : sz(st?.children),
        });
      } catch {}
    })();
  }, [contractAddress, network]);

  /* supply & wallet balance */
  useEffect(() => {
    let cancelled = false;
    const safeSet = (fn, v) => { if (!cancelled) fn(v); };
    if (!contractAddress || tokenId === '') { setSupply(null); setOwned(null); return; }

    const base = network === 'mainnet'
      ? 'https://api.tzkt.io/v1'
      : 'https://api.ghostnet.tzkt.io/v1';

    const sumBalances = async () => {
      const rows = await jFetch(
        `${base}/tokens/balances?token.contract=${contractAddress}&token.tokenId=${tokenId}&select=balance&limit=10000`,
      ).catch(() => []);
      return rows.length ? rows.reduce((t, b) => t + Number(b || 0), 0) : NaN;
    };

    const fetchSupply = async () => {
      try {
        const [row] = await jFetch(
          `${base}/tokens?contract=${contractAddress}&tokenId=${tokenId}&select=totalSupply&limit=1`,
        ).catch(() => []);
        if (row !== undefined && row !== null) {
          const n = Number(typeof row === 'object' ? row.totalSupply : row);
          if (Number.isFinite(n)) return n;
        }
      } catch {}
      try {
        const bm = await jFetch(
          `${base}/contracts/${contractAddress}/bigmaps/total_supply/keys/${tokenId}`,
        ).catch(() => null);
        if (bm?.value?.int) return Number(bm.value.int);
      } catch {}
      try {
        const st = await jFetch(`${base}/contracts/${contractAddress}/storage`).catch(() => null);
        const v = st?.total_supply?.[tokenId];
        if (v?.int) return Number(v.int);
        if (Number.isFinite(+v)) return Number(v);
      } catch {}
      return sumBalances();
    };

    const fetchOwned = async () => {
      if (!wallet) return NaN;
      const [row] = await jFetch(
        `${base}/tokens/balances?account=${wallet}&token.contract=${contractAddress}&token.tokenId=${tokenId}&limit=1`,
      ).catch(() => []);
      return row ? Number(row.balance || row) : 0;
    };

    (async () => {
      const [sup, own] = await Promise.all([fetchSupply(), fetchOwned()]);
      safeSet(setSupply, Number.isFinite(sup) ? sup : undefined);
      safeSet(setOwned , Number.isFinite(own) ? own : undefined);
    })();
    return () => { cancelled = true; };
  }, [contractAddress, tokenId, wallet, network]);

  /*──────── render ─*/
  if (tokenId === '') return null;

  if (meta === null) {
    return (
      <Card style={{ textAlign:'center' }}>
        <LoadingSpinner size={48} style={{ margin:'12px auto' }} />
      </Card>
    );
  }

  return (
    <Card>
      {integrity.status !== 'unknown' && (
        <IntegrityChip
          aria-label={label}
          title={integrity.status === 'partial'
            ? `${label} – ${integrity.reasons.join('; ')}`
            : label}
        >
          <IntegrityBadge status={integrity.status} />
          <span className="label">{label}</span>
        </IntegrityChip>
      )}

      {ktShort && (
        <AddrRow>
          <code style={{ opacity:.8 }}>{ktShort}</code>
          <PixelButton
            size="xs"
            title="copy KT1"
            aria-label={copied ? 'Address copied' : 'Copy contract address'}
            onClick={copyAddr}
            style={{ padding:'0 4px', lineHeight:1 }}
          >
            {copied ? '✓' : '📋'}
          </PixelButton>
        </AddrRow>
      )}

      <Stats>
        {supply === null
          ? <LoadingSpinner size={16} />
          : supply === undefined
            ? null
            : <span title="Total editions">Total&nbsp;{supply}</span>}
        {wallet && (
          owned === null
            ? <LoadingSpinner size={16} />
            : owned === undefined
              ? null
              : <span title="Editions you own">Owned&nbsp;{owned}</span>
        )}
      </Stats>

      <RelStats>
        <span title="Parent addresses">P&nbsp;{rel.parent}</span>
        <span title="Children addresses">C&nbsp;{rel.child}</span>
        <span title="Collaborators">Collab&nbsp;{rel.coll}</span>
      </RelStats>

      {hero && !supRef.current.has('hero') && (
        <RenderMedia
          uri={hero}
          alt={metaObj.name}
          style={heroStyle}
          onInvalid={(r) => { supRef.current.add('hero'); suppressWarn(r); }}
        />
      )}

      {/* authors and creators lines displayed with domain resolution.  These
         sections appear below the hero preview and above the metadata grid. */}
      {authorsList.length > 0 && (
        <p style={{ wordBreak: 'break-all' }}>
          Author(s)&nbsp;
          {renderEntryList(authorsList, showAllAuthors, setShowAllAuthors)}
        </p>
      )}
      {creatorsList.length > 0 && (
        <p style={{ wordBreak: 'break-all', opacity: authorsList.length > 0 ? 0.85 : 1 }}>
          Creator(s)&nbsp;
          {renderEntryList(creatorsList, showAllCreators, setShowAllCreators)}
        </p>
      )}

      {warn && (
        <Warn>
          <h3 style={{ margin:0,fontSize:'1rem',color:'var(--zu-accent-sec)' }}>
            Broken&nbsp;Media&nbsp;URI
          </h3>
          <p>
            This token’s media link looks invalid
            <br />(reason: {warn})
            <br />To avoid broken previews on marketplaces:
          </p>
          <p>
            <strong>Options:</strong><br />
            {/* Repair link – key depends on contract version */}
            <a href="#repair_uri" onClick={(e)=>{
              e.preventDefault();
              openTool(isV4a ? 'repair_uri_v4a' : 'repair_uri');
            }}>
              {isV4a ? 'REPAIR URI' : 'REPAIR URI'}
            </a>
            {isV4a
              ? null
              : (
                <>
                  {' — '}<br />
                  {/* Clear URI only for v4 */}
                  <a href="#clear_uri" onClick={(e)=>{
                    e.preventDefault();
                    openTool('clear_uri');
                  }}>
                    CLEAR URI
                  </a>{' then append a fresh URI.'}
                </>
              )
            }
          </p>
          <PixelButton onClick={dismissWarn}>DISMISS</PixelButton>
        </Warn>
      )}

      <MetaGrid>
        {kvPairs.map(([k,v])=>(
          <React.Fragment key={k}>
            <dt>{k}</dt><dd>{v}</dd>
          </React.Fragment>
        ))}
        {uriArr.map((k)=>(
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd style={{ display:'flex',alignItems:'center',gap:6 }}>
              <RenderMedia
                uri={metaObj[k]}
                alt={k}
                style={{ width:48,height:48,objectFit:'contain' }}
                onInvalid={(r)=>suppressWarn(`${k}: ${r}`)}
              />
              {onRemove && (
                <PixelButton
                  size="xs"
                  warning
                  title="delete uri"
                  style={{ marginLeft:'auto' }}
                  onClick={()=>onRemove(k)}
                >
                  DELETE
                </PixelButton>
              )}
            </dd>
          </React.Fragment>
        ))}
      </MetaGrid>
    </Card>
  );
}
/* What changed & why:
   • heroStyle memo picks up media MIME; audio/video now 100 % width,
     max‑height 120 px, preventing the clipped waveform/player seen on
     4 K monitors (Invariant I00).                    */
/* EOF */
