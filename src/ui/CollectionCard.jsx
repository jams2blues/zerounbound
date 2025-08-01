/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/CollectionCard.jsx
  Rev :    r26   2025‑07‑22
  Summary: use deployTarget for network detection and TzKT API
─────────────────────────────────────────────────────────────*/
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import PropTypes                  from 'prop-types';
import styledPkg                  from 'styled-components';

import useConsent                 from '../hooks/useConsent.js';
import detectHazards              from '../utils/hazards.js';
import { checkOnChainIntegrity }  from '../utils/onChainValidator.js';
import { getIntegrityInfo }       from '../constants/integrityBadges.js';
import countOwners                from '../utils/countOwners.js';
import countTokens                from '../utils/countTokens.js';
import { shortKt, copyToClipboard } from '../utils/formatAddress.js';
import { shortAddr } from '../utils/formatAddress.js';
import RenderMedia                from '../utils/RenderMedia.jsx';
import PixelButton                from './PixelButton.jsx';
import { jFetch }                 from '../core/net.js';
import decodeHexFields            from '../utils/decodeHexFields.js';
import {
  EnableScriptsToggle,
  EnableScriptsOverlay,
} from './EnableScripts.jsx';
// Import network constants from deployTarget.  This avoids reliance on
// process.env.NEXT_PUBLIC_NETWORK, which is only substituted at build
// time and may default to ghostnet in development.  NETWORK_KEY
// resolves to 'mainnet' or 'ghostnet'; TZKT_API provides the base
// TzKT domain for the selected network.  See src/config/deployTarget.js.
import { NETWORK_KEY, TZKT_API } from '../config/deployTarget.js';

// Domain resolver for reverse lookups.  This helper queries Tezos
// Domains via GraphQL and falls back to cached results.  Domains are
// resolved per-network (mainnet vs ghostnet) using NETWORK_KEY.
import { resolveTezosDomain } from '../utils/resolveTezosDomain.js';

const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────── styled shells ─────────────────────────────────────*/
const Card = styled.div`
  width : var(--col);
  display: flex; flex-direction: column;
  border: 2px solid var(--zu-accent,#00c8ff);
  background: var(--zu-bg,#000); color: var(--zu-fg,#fff);
  overflow: hidden; cursor: pointer;
  &:hover { box-shadow: 0 0 6px var(--zu-accent-sec,#ff0); }
`;

const ThumbWrap = styled.div`
  flex: 0 0 var(--col);
  display:flex;align-items:center;justify-content:center;
  background: var(--zu-bg-dim,#111);
  position: relative;
`;

const ThumbMedia = styled(RenderMedia)`
  max-width:100%; max-height:100%; image-rendering:pixelated;
`;

const Badge = styled.span`
  position:absolute;top:4px;right:4px;z-index:2;font-size:1.1rem;
`;

const Obf = styled.div`
  position:absolute;inset:0;background:rgba(0,0,0,.85);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;font-size:.75rem;z-index:3;text-align:center;
  p{margin:0;width:80%;}
`;

const Meta = styled.div`
  padding:6px 6px 4px;display:flex;flex-direction:column;gap:2px;
  h3{margin:0;font-size:.9rem;line-height:1.15;font-family:'Pixeloid Sans',monospace;}
  p {margin:0;font-size:.75rem;opacity:.8;}
`;

const StatRow = styled.div`
  display:flex;justify-content:space-between;font-size:.75rem;
`;

const AddrRow = styled.div`
  display:flex;align-items:center;gap:4px;font-size:.68rem;opacity:.6;
  button{line-height:1;padding:0 .3rem;font-size:.65rem;}
`;

/*──────── helpers ───────────────────────────────────────────*/
const ipfsToHttp = (u='') => u.replace(/^ipfs:\/\//,'https://ipfs.io/ipfs/');
const PLACEHOLDER = '/sprites/cover_default.svg';

function decodeHexMetadata(val='') {
  try{
    if(typeof val!=='string') return null;
    const s = val.trim();
    if(s.startsWith('{') && s.endsWith('}')) return JSON.parse(s);
    const hex = s.replace(/^0x/,'');
    if(!/^[0-9a-f]+$/i.test(hex) || hex.length%2) return null;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16)));
    return JSON.parse(new TextDecoder().decode(bytes).replace(/[\u0000-\u001F\u007F]/g,''));
  }catch{return null;}
}

/*──────── component ─────────────────────────────────────────*/
export default function CollectionCard({ contract }) {
  const [meta, setMeta]   = useState({});
  const [owners,setOwners]= useState(null);
  const [live,  setLive]  = useState(null);
  const [thumbOk,setThumbOk]=useState(true);

  const [allowNSFW,setAllowNSFW]= useConsent('nsfw',false);
  const [allowFlash,setAllowFlash]= useConsent('flash',false);
  const [allowScripts,setAllowScripts]= useConsent('scripts',false);

  // Determine current network from deployTarget.js.  Falling back to
  // process.env will cause mismatches in local dev when NEXT_PUBLIC_NETWORK
  // is undefined.  NETWORK_KEY returns 'mainnet' or 'ghostnet'.
  const net = NETWORK_KEY;
  // Base API URL for the chosen network.  Append /v1 to use the v1
  // endpoints for tokens, contracts and bigmaps.
  const api = `${TZKT_API}/v1`;

  /*── metadata – big‑map “content” key query ───────────────*/
  useEffect(()=>{let cancelled=false;
    (async()=>{
      let m = {};
      try{
        const rows = await jFetch(
          `${api}/contracts/${contract.address}/bigmaps/metadata/keys`
          + '?key=content&select=value&limit=1',
        ).catch(()=>[]);
        const raw = rows?.[0];
        const parsed = decodeHexMetadata(raw);
        if(parsed) m = parsed;
      }catch{/* ignore */}

      if(!m.name){                                   /* fallback contract */
        try{
          const c = await jFetch(`${api}/contracts/${contract.address}`).catch(()=>null);
          if(c?.metadata) m = { ...m, ...decodeHexFields(c.metadata) };
        }catch{/* ignore */}
      }
      if(!cancelled) setMeta(decodeHexFields(m));
    })();
    return ()=>{cancelled=true;};
  },[contract.address,api]);

  /* counts */
  useEffect(()=>{let c=false;
    countOwners(contract.address,net).then(n=>{if(!c)setOwners(n);});
    countTokens(contract.address,net).then(n=>{if(!c)setLive(n);});
    return ()=>{c=true;};
  },[contract.address,net]);

  const { nsfw,flashing,scripts } = detectHazards(meta);
  const hide  = (nsfw&&!allowNSFW)||(flashing&&!allowFlash);
  const integrity = useMemo(()=>checkOnChainIntegrity(meta).status,[meta]);
  const { badge,label } = getIntegrityInfo(integrity);

  /* preview + text */
  const preview = meta.imageUri ? ipfsToHttp(meta.imageUri) : PLACEHOLDER;
  const showPlaceholder = (!meta.imageUri || !thumbOk);
  const nameSafe = meta.name || shortKt(contract.address);
  const authors = Array.isArray(meta.authors)
    ? meta.authors
    : typeof meta.authors === 'string'
      ? meta.authors.split(/[,;]\s*/)
      : [];

  // --------------------------------------------------------------
  // Domain resolution state.  We cache resolved .tez domains for
  // author addresses using a lowercase key.  Lookups are performed
  // only once per address per component instance.
  const [domains, setDomains] = useState({});
  const [showAllAuthors, setShowAllAuthors] = useState(false);

  // Resolve domain names for all addresses in the authors list.
  useEffect(() => {
    const addrs = new Set();
    authors.forEach((a) => {
      if (a && typeof a === 'string' && /^(tz|kt)/i.test(a.trim())) {
        addrs.add(a);
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
  }, [authors]);

  // Format a single entry: if a domain is resolved, use it; if the
  // string contains a dot (likely a custom name or domain) leave it
  // unmodified; otherwise abbreviate tz/KT addresses via shortAddr().
  const formatEntry = useCallback(
    (val) => {
      if (!val || typeof val !== 'string') return String(val || '');
      const v = val.trim();
      const lower = v.toLowerCase();
      const dom = domains[lower];
      if (dom) return dom;
      if (v.includes('.')) return v;
      return shortAddr(v);
    },
    [domains],
  );

  // Render authors with optional expansion.  When not showing all,
  // only the first three entries are displayed; a toggle is appended
  // when more items exist.
  const renderAuthors = useCallback(() => {
    const list = showAllAuthors ? authors : authors.slice(0, 3);
    const elems = [];
    list.forEach((item, idx) => {
      const prefix = idx > 0 ? ', ' : '';
      const formatted = formatEntry(item);
      const isAddr = typeof item === 'string' && /^(tz|kt)/i.test(item.trim());
      elems.push(
        isAddr ? (
          <a
            key={item}
            href={`/explore?cmd=tokens&admin=${item}`}
            style={{ color: 'var(--zu-accent-sec,#6ff)', textDecoration: 'none' }}
          >
            {prefix}
            {formatted}
          </a>
        ) : (
          <span key={item}>{prefix}{formatted}</span>
        ),
      );
    });
    if (authors.length > 3 && !showAllAuthors) {
      elems.push(
        <>
          …&nbsp;
          <button
            type="button"
            aria-label="Show all authors"
            onClick={(e) => { e.preventDefault(); setShowAllAuthors(true); }}
            style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            🔻More
          </button>
        </>,
      );
    }
    return elems;
  }, [authors, showAllAuthors, formatEntry]);

  /* toggle handler */
  const handleToggleScripts = () => {
    if (allowScripts) {
      setAllowScripts(false);
    } else if (window.confirm('Enable executable scripts for this media?')) {
      setAllowScripts(true);
    }
  };

  /*──────── render ─*/
  return (
    <a href={`/contracts/${contract.address}`} style={{textDecoration:'none'}}>
      <Card>
        <ThumbWrap>
          <Badge title={label}>{badge}</Badge>

          {scripts && (
            <span style={{ position:'absolute', top:4, left:4, zIndex:11 }}>
              <EnableScriptsToggle
                enabled={allowScripts}
                onToggle={handleToggleScripts}
              />
            </span>
          )}

          {hide && (
            <Obf>
              <p>{nsfw&&'NSFW'}{nsfw&&flashing?' / ':''}{flashing&&'Flashing'}</p>
              <PixelButton size="sm" onClick={e=>{e.preventDefault();
                if(nsfw)    setAllowNSFW(true);
                if(flashing)setAllowFlash(true);
              }}>UNHIDE</PixelButton>
            </Obf>
          )}

          {!hide && !showPlaceholder && (
            <ThumbMedia
              uri={preview}
              alt={nameSafe}
              allowScripts={scripts&&allowScripts}
              onInvalid={()=>setThumbOk(false)}
            />
          )}

          {!hide && showPlaceholder && (
            <img src={PLACEHOLDER} alt="" style={{width:'60%',opacity:.45}} />
          )}

          {scripts && !allowScripts && !hide && (
            <Obf>
              <EnableScriptsOverlay onAccept={handleToggleScripts}/>
            </Obf>
          )}
        </ThumbWrap>

        <Meta>
          <h3 title={nameSafe}>{nameSafe}</h3>
          {authors.length > 0 && (
            <p style={{ wordBreak: 'break-all' }}>
              Author(s) 
              {renderAuthors()}
            </p>
          )}

          <StatRow>
            <span>{live ?? '…'} Tokens</span>
            {Number.isFinite(owners) && <span>{owners} Owners</span>}
          </StatRow>

          <AddrRow>
            <span>{shortKt(contract.address)}</span>
            <PixelButton size="xs" title="Copy address"
              onClick={e=>{e.preventDefault();copyToClipboard(contract.address);}}>
              📋
            </PixelButton>
          </AddrRow>
        </Meta>
      </Card>
    </a>
  );
}

CollectionCard.propTypes = {
  contract: PropTypes.shape({
    address: PropTypes.string.isRequired,
  }).isRequired,
};
/* What changed & why:
   • Replaced environment‑based network detection with imports from
     deployTarget.js to ensure correct network selection in both
     development and production.  process.env.NEXT_PUBLIC_NETWORK is
     only replaced at build time and may default to ghostnet, causing
     mainnet pages to fetch testnet data.  We now derive net and API
     base directly from deployTarget.
*/
/* EOF */