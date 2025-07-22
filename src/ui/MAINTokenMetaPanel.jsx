/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/MAINTokenMetaPanel.jsx
  Rev :    r10    2025‑10‑17
  Summary: responsive token metadata panel with improved
           collection preview and prefix.  Uses a flexible
           grid for small screens and robust thumbnail
           fallbacks.  Adds a “Collection:” label before the
           collection name and chooses the first available
           imageUri/logoUri/displayUri/thumbnailUri for the
           thumbnail.  This version preserves hazard
           warnings, script toggles and marketplace controls.
─────────────────────────────────────────────────────────────*/
import React, { useMemo, useState } from 'react';
import PropTypes                    from 'prop-types';
import { format }                   from 'date-fns';
import styledPkg                    from 'styled-components';

import PixelHeading                 from './PixelHeading.jsx';
import PixelButton                  from './PixelButton.jsx';
import RenderMedia                  from '../utils/RenderMedia.jsx';
import IntegrityBadge               from './IntegrityBadge.jsx';
import MarketplaceBar               from './MarketplaceBar.jsx';

import { checkOnChainIntegrity }    from '../utils/onChainValidator.js';
import { getIntegrityInfo }         from '../constants/integrityBadges.js';
import detectHazards                from '../utils/hazards.js';
import useConsent                   from '../hooks/useConsent.js';
import { shortKt, copyToClipboard } from '../utils/formatAddress.js';
import {
  EnableScriptsToggle,
  EnableScriptsOverlay,
} from './EnableScripts.jsx';
import PixelConfirmDialog           from './PixelConfirmDialog.jsx';
import countAmount                  from '../utils/countAmount.js';
import hashMatrix                   from '../data/hashMatrix.json';

const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────── styled shells ─────────────────────────────────────*/
const Panel = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  /* Allow the panel to shrink gracefully on narrow screens */
  width: 100%;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: .5rem;
`;

const CollectionLink = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  &:hover {
    text-decoration: underline;
  }
`;

const ThumbWrap = styled.div`
  position: relative;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1px solid var(--zu-fg);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ThumbMedia = styled(RenderMedia)`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

/* obfuscation overlay for NSFW/flash hazards */
const Obf = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: .65rem;
  z-index: 3;
  text-align: center;
  p {
    margin: 0;
    width: 80%;
  }
`;

const AddrRow = styled.div`
  font-size: .75rem;
  opacity: .8;
  display: flex;
  align-items: center;
  gap: 6px;
  code {
    word-break: break-all;
  }
  button {
    line-height: 1;
    padding: 0 4px;
    font-size: .65rem;
  }
`;

const Description = styled.p`
  font-size: .85rem;
  line-height: 1.4;
  white-space: pre-wrap;
  margin: 0;
`;

const BadgeWrap = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
`;

const Tag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--zu-fg);
  background: var(--zu-bg-alt);
  font-size: .7rem;
  border-radius: 4px;
`;

/* Meta grid uses adaptive columns. On small screens the labels
   stack above values; on wider screens they sit side by side. */
const MetaGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(120px, 40%), 1fr));
  gap: 4px 8px;
  font-size: .8rem;
  dt {
    font-weight: 700;
    opacity: .8;
  }
  dd {
    margin: 0;
    word-break: break-word;
  }
`;

/*──────── helpers ───────────────────────────────────────────*/
const HASH2VER = Object.entries(hashMatrix)
  .reduce((o, [h, v]) => { o[+h] = v.toUpperCase(); return o; }, {});

const PLACEHOLDER = '/sprites/cover_default.svg';
// Convert ipfs:// URIs to http for thumbnail display
const ipfsToHttp  = (u = '') => u.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/');

/*──────── component ───────────────────────────────────────*/
export default function MAINTokenMetaPanel({ token, collection, walletAddress: _wa }) {
  const [copied, setCopied] = useState(false);

  const collMeta = collection.metadata || {};
  const collHaz  = detectHazards(collMeta);
  const tokHaz   = detectHazards(token.metadata || {});

  const [allowScr,   setAllowScr]   = useConsent(`scripts:${collection.address}`, false);
  const [allowNSFW,  setAllowNSFW]  = useConsent('nsfw',  false);
  const [allowFlash, setAllowFlash] = useConsent('flash', false);

  /* reveal dialog state */
  const [dlgType,   setDlgType]   = useState(null);   // 'nsfw' | 'flash' | null
  const [dlgTerms,  setDlgTerms]  = useState(false);
  /* script‑consent dialog state */
  const [dlgScr,    setDlgScr]    = useState(false);
  const [termsScr,  setTermsScr]  = useState(false);

  /* integrity + editions */
  const integrity  = useMemo(() => checkOnChainIntegrity(token.metadata || {}), [token.metadata]);
  const { label }  = useMemo(() => getIntegrityInfo(integrity.status), [integrity.status]);
  const editions   = useMemo(() => countAmount(token), [token]);
  const verLabel   = HASH2VER[collection.typeHash] || '?';

  /* thumb uri + fallbacks */
  const rawThumb = collMeta.imageUri
    || collMeta.logoUri
    || collMeta.displayUri
    || collMeta.thumbnailUri
    || '';
  const thumb    = rawThumb.startsWith('ipfs://') ? ipfsToHttp(rawThumb) : rawThumb;
  const [thumbOk, setThumbOk] = useState(true);

  /* hazard mask logic */
  const needsNSFW  = (collHaz.nsfw   || tokHaz.nsfw)    && !allowNSFW;
  const needsFlash = (collHaz.flashing || tokHaz.flashing) && !allowFlash;
  const hide       = needsNSFW || needsFlash;

  /* clipboard copy */
  const copyAddr = () => {
    copyToClipboard(collection.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  /* script-consent handler */
  const askEnable = () => { setTermsScr(false); setDlgScr(true); };
  const enable    = () => {
    if (!termsScr) return;
    setAllowScr(true);
    setDlgScr(false);
  };

  /* hazard reveal handlers */
  const askReveal = (tp) => { setDlgType(tp); setDlgTerms(false); };
  const confirmReveal = () => {
    if (!dlgTerms) return;
    if (dlgType === 'nsfw')  setAllowNSFW(true);
    if (dlgType === 'flash') setAllowFlash(true);
    setDlgType(null);
    setDlgTerms(false);
  };

  /*──────── render ─*/
  return (
    <>
      <Panel>
        {/* collection head */}
        <Section>
          <CollectionLink
            href={`/contracts/${collection.address}`}
            onClick={(e) => {
              if (hide) {
                e.preventDefault();
                if (needsNSFW) askReveal('nsfw');
                if (needsFlash) askReveal('flash');
              }
            }}
          >
            <ThumbWrap>
              {/* show hazard icons or thumbnail */}
              {hide && (
                <Obf>
                  {needsNSFW && <PixelButton onClick={(e) => { e.preventDefault(); askReveal('nsfw'); }}>NSFW 🔞</PixelButton>}
                  {needsFlash && <PixelButton onClick={(e) => { e.preventDefault(); askReveal('flash'); }}>Flash 🚨</PixelButton>}
                </Obf>
              )}
              {!hide && thumb && thumbOk && (
                <ThumbMedia
                  uri={thumb}
                  onError={() => setThumbOk(false)}
                />
              )}
              {(!thumb || !thumbOk) && !hide && (
                <ThumbMedia
                  uri={PLACEHOLDER}
                  onError={() => {}}
                />
              )}
              {collHaz.scripts && !allowScr && !hide && (
                <EnableScriptsOverlay
                  onClick={(e) => { e.preventDefault(); askEnable(); }}
                />
              )}
            </ThumbWrap>
            {/* collection name with prefix */}
            <span style={{ fontWeight: 'bold', fontSize: '.95rem' }}>
              Collection: {collMeta.name || shortKt(collection.address)}
            </span>
          </CollectionLink>
          {/* address row */}
          <AddrRow>
            <code>{shortKt(collection.address)}</code>
            <button type="button" onClick={copyAddr}>{copied ? '✓' : '📋'}</button>
            <Tag>({verLabel})</Tag>
            {/* permanent scripts toggle */}
            {collHaz.scripts && (
              <EnableScriptsToggle
                checked={allowScr}
                onChange={(val) => {
                  if (!val) setAllowScr(false);
                  else askEnable();
                }}
              />
            )}
          </AddrRow>
        </Section>

        {/* token name + integrity */}
        <Section>
          <BadgeWrap>
            <PixelHeading level={4}>{token.metadata?.name || `Token #${token.tokenId}`}</PixelHeading>
            <IntegrityBadge status={integrity.status} />
          </BadgeWrap>
          <span style={{ fontSize: '.75rem', opacity: .85 }}>
            Minted {format(new Date(token.firstTime), 'MMM dd, yyyy')} • {editions} edition{editions !== 1 ? 's' : ''}
          </span>
        </Section>

        {/* description */}
        {token.metadata?.description && (
          <Description>{token.metadata.description}</Description>
        )}

        {/* marketplace buttons */}
        <Section>
          <MarketplaceBar
            contractAddress={collection.address}
            tokenId={token.tokenId}
            marketplace={token.marketplace}
          />
        </Section>

        {/* tags */}
        {Array.isArray(token.metadata?.tags) && token.metadata.tags.length > 0 && (
          <Section>
            {token.metadata.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </Section>
        )}

        {/* misc meta */}
        <Section>
          <MetaGrid>
            <dt>MIME Type</dt>
            <dd>{token.metadata?.mimeType || 'N/A'}</dd>
            <dt>Creator(s)</dt>
            <dd>{(() => {
              const a = token.metadata || {};
              const s = a.authors || a.artists || a.creators || [];
              return Array.isArray(s) ? s.join(', ') : s;
            })()}</dd>
            {token.metadata?.rights && (
              <>
                <dt>Rights</dt>
                <dd>{token.metadata.rights}</dd>
              </>
            )}
          </MetaGrid>
        </Section>
      </Panel>

      {/* enable scripts confirm dialog */}
      {dlgScr && (
        <PixelConfirmDialog
          open={dlgScr}
          onOk={enable}
          onCancel={() => setDlgScr(false)}
          okLabel="OK"
          cancelLabel="Cancel"
          confirmDisabled={!termsScr}
          title="Enable Scripts"
          message={(
            <span>
              <label>
                <input
                  type="checkbox"
                  checked={termsScr}
                  onChange={(e) => setTermsScr(e.target.checked)}
                />
                I agree to Terms
              </label>
              <p>Executable code can be harmful. Proceed only if you trust the author.</p>
            </span>
          )}
        />
      )}

      {/* hazard reveal confirm dialog */}
      {dlgType && (
        <PixelConfirmDialog
          open={!!dlgType}
          onOk={confirmReveal}
          onCancel={() => { setDlgType(null); setDlgTerms(false); }}
          okLabel="REVEAL"
          cancelLabel="Cancel"
          confirmDisabled={!dlgTerms}
          title={dlgType === 'nsfw' ? 'NSFW Warning' : 'Flashing Warning'}
          message={(
            <span>
              {dlgType === 'nsfw' ? (
                <>
                  Warning: This thumbnail is marked Not‑Safe‑For‑Work (NSFW). It may include explicit nudity, sexual themes, graphic violence or other mature material.
                </>
              ) : (
                <>
                  Warning: This thumbnail may contain rapid flashing or strobing effects that can trigger seizures in people with photosensitive epilepsy.
                </>
              )}
              <br />
              <label>
                <input
                  type="checkbox"
                  checked={dlgTerms}
                  onChange={(e) => setDlgTerms(e.target.checked)}
                />
                I confirm I am 18 + and agree to Terms
              </label>
            </span>
          )}
        />
      )}
    </>
  );
}

MAINTokenMetaPanel.propTypes = {
  token        : PropTypes.object.isRequired,
  collection   : PropTypes.object.isRequired,
  walletAddress: PropTypes.string,
};

/* What changed & why (r10):
   • Added prefix “Collection:” before the collection name and improved
     thumbnail fallbacks by considering imageUri, logoUri,
     displayUri and thumbnailUri.
   • Made the meta grid adaptive using auto‑fit so labels wrap
     gracefully on small screens.
   • Reduced rigid widths; Panel now flexes to available space.
   • Preserved hazard overlays, script toggles and marketplace
     buttons, ensuring this component remains fully functional.
*/
/* EOF */