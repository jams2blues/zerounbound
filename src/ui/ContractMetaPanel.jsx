/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/ContractMetaPanel.jsx
  Rev :    r814   2025‑09‑04
  Summary: meta decode + previewUri fallback + displayName fix
──────────────────────────────────────────────────────────────*/
import React, { useEffect, useMemo, useState, useRef } from 'react';
import styledPkg                       from 'styled-components';
import RenderMedia                     from '../utils/RenderMedia.jsx';
import { jFetch }                      from '../core/net.js';
import { checkOnChainIntegrity }       from '../utils/onChainValidator.js';
import { getIntegrityInfo }            from '../constants/integrityBadges.js';
import IntegrityBadge                  from './IntegrityBadge.jsx';
import decodeHexFields                 from '../utils/decodeHexFields.js';

const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────── helpers ───────────────────────────────────────────*/
const sz = (v) =>
  Array.isArray(v)                     ? v.length
    : v && typeof v.size === 'number'  ? v.size
    : v && typeof v.forEach === 'function' ? [...v].length
    : typeof v === 'number'            ? v
    : v && typeof v.int === 'string'   ? parseInt(v.int, 10)
    : 0;

/*──────── meta resolver ─────────────────────────────────────*/
function resolveMeta(raw = {}) {
  const decoded = decodeHexFields(typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw); } catch { return {}; } })()
    : raw);
  return decoded && typeof decoded === 'object' ? decoded : {};
}

/*──────── styled shells ─────────────────────────────────────*/
const Card = styled.div`
  --zu-chip-h: 34px;
  border:2px solid var(--zu-accent,#00c8ff);
  background:var(--zu-bg,#000);
  color:var(--zu-fg,#f0f0f0);
  padding:clamp(var(--zu-chip-h),10px,var(--zu-chip-h)) 10px 10px;
  font-size:.75rem;line-height:1.25;
  position:relative;overflow:visible;

  @media(min-width:480px){ padding-top:10px; }
`;

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

const Title = styled.h3`
  margin:.1rem 0 .35rem;font-size:.95rem;text-align:center;
  color:var(--zu-accent);word-break:break-word;
`;
const StatRow = styled.p`
  margin:.25rem 0;font-size:.75rem;display:flex;justify-content:center;gap:6px;
  span{display:inline-block;padding:1px 6px;border:1px solid var(--zu-fg);}
`;
const MetaGrid = styled.dl`
  display:grid;grid-template-columns:max-content 1fr;
  column-gap:6px;row-gap:2px;margin:8px 0 0;
  dt{text-align:right;color:var(--zu-accent);overflow-wrap:anywhere;}
  dd{margin:0;word-break:break-word;overflow-wrap:anywhere;}
`;

/*──────── component ────────────────────────────────────────*/
export default function ContractMetaPanel({
  meta = {}, contractAddress = '', network = 'ghostnet',
}) {
  const [counts, setCounts] = useState({ coll:0,parent:0,child:0,total:0 });
  const cancelled = useRef(false);

  /* decode meta early */
  const m = useMemo(() => resolveMeta(meta), [meta]);

  /* live chain counts */
  useEffect(() => {
    cancelled.current = false;
    if (!contractAddress) return;
    const base = network === 'mainnet'
      ? 'https://api.tzkt.io/v1'
      : 'https://api.ghostnet.tzkt.io/v1';
    (async () => {
      try{
        const st = await jFetch(`${base}/contracts/${contractAddress}/storage`);
        if (cancelled.current) return;
        setCounts({
          coll  : sz(st?.collaborators),
          parent: sz(st?.parents),
          child : sz(st?.children),
          total : sz(st?.active_tokens) ?? sz(st?.total_supply) ?? sz(st?.next_token_id),
        });
      }catch{/* ignore */}
    })();
    return () => { cancelled.current = true; };
  }, [contractAddress, network]);

  /* ordered key/value pairs for grid */
  const ORDER=[
    'name','symbol','description','version','license','authors',
    'homepage','authoraddress','creators','type','interfaces',
  ];
  const kv = useMemo(() =>
    ORDER.filter((k) => m[k] !== undefined)
         .map((k) => [k, Array.isArray(m[k]) ? m[k].join(', ') : String(m[k])]),
  [m]);

  /* integrity calc */
  const integrity = useMemo(() => checkOnChainIntegrity(m), [m]);
  const { label } = useMemo(
    () => getIntegrityInfo(integrity.status),
  [integrity.status]);

  const previewUri =
    m.imageUri || m.logo || m.artifactUri || m.thumbnailUri;

  const displayName = m.name || m.symbol || contractAddress || '—';

  return (
    <Card>
      {integrity.status !== 'unknown' && (
        <IntegrityChip aria-label={label}
          title={integrity.status === 'partial'
            ? `${label} – ${integrity.reasons.join('; ')}`
            : label}>
          <IntegrityBadge status={integrity.status}/>
          <span className="label">{label}</span>
        </IntegrityChip>
      )}

      {previewUri && (
        <RenderMedia
          uri={previewUri}
          alt={displayName}
          style={{
            width:120,height:120,margin:'0 auto 6px',display:'block',
            objectFit:'contain',border:'2px solid var(--zu-fg)',
          }}
        />
      )}

      <Title>{displayName}</Title>

      <StatRow>
        <span>P {counts.parent}</span>
        <span>C {counts.child}</span>
        <span>Collab {counts.coll}</span>
        <span>Tokens {counts.total}</span>
      </StatRow>

      <MetaGrid>
        {kv.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt><dd>{v}</dd>
          </React.Fragment>
        ))}
      </MetaGrid>
    </Card>
  );
}
/* What changed & why:
   • meta decoded via resolveMeta() – fixes missing keys/“—”
   • previewUri fallback chain restores media
   • displayName chooses name→symbol→address
   • Rev‑bump r814 */
/* EOF */
