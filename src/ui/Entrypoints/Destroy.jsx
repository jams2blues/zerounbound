/*─────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/ui/Entrypoints/Destroy.jsx
  Rev :    r693   2025-06-25
  Summary: $level-safe Wrap, clearer overlay flow, minor lint
──────────────────────────────────────────────────────────────*/
import React, { useCallback, useEffect, useState } from 'react';
import { Buffer }          from 'buffer';
import styledPkg           from 'styled-components';

import PixelHeading        from '../PixelHeading.jsx';
import PixelInput          from '../PixelInput.jsx';
import PixelButton         from '../PixelButton.jsx';
import PixelConfirmDialog  from '../PixelConfirmDialog.jsx';
import OperationOverlay    from '../OperationOverlay.jsx';
import TokenMetaPanel      from '../TokenMetaPanel.jsx';
import LoadingSpinner      from '../LoadingSpinner.jsx';

import listLiveTokenIds    from '../../utils/listLiveTokenIds.js';
import { useWalletContext } from '../../contexts/WalletContext.js';
import { jFetch }           from '../../core/net.js';
import { TZKT_API }         from '../../config/deployTarget.js';

/* polyfill */
if (typeof window !== 'undefined' && !window.Buffer) window.Buffer = Buffer;

/*──────── helpers ─────*/
const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;
const Wrap   = styled('section').withConfig({ shouldForwardProp: (p) => p !== '$level' })`
  margin-top:1.5rem;position:relative;z-index:${(p) => p.$level ?? 'auto'};
`;
const Box = styled.div`position:relative;flex:1;`;
const Spin = styled(LoadingSpinner).attrs({ size:16 })`
  position:absolute;top:8px;right:8px;
`;
const HelpBox = styled.p`
  font-size:.75rem;line-height:1.25;margin:.5rem 0 .9rem;
`;
const API = `${TZKT_API}/v1`;
const hex2str = (h) => Buffer.from(h.replace(/^0x/, ''), 'hex').toString('utf8');

/* robust decode – never throw */
function decodeMeta(src = '') {
  try {
    const txt = typeof src === 'string' ? src : JSON.stringify(src);
    return JSON.parse(txt);
  } catch { return {}; }
}

/*──────────────── component ────────────────────────────────*/
export default function Destroy({
  contractAddress = '',
  setSnackbar     = () => {},
  onMutate        = () => {},
  $level,
}) {
  const { toolkit, network='ghostnet' } = useWalletContext() || {};
  const snack = (m, s='info') => setSnackbar({ open:true, message:m, severity:s });

  /* token list */
  const [tokOpts, setTokOpts]       = useState([]);
  const [loadingTok, setLoadingTok] = useState(false);

  const fetchTokens = useCallback(async () => {
    if (!contractAddress) return;
    setLoadingTok(true);
    setTokOpts(await listLiveTokenIds(contractAddress, network, true));
    setLoadingTok(false);
  }, [contractAddress, network]);

  useEffect(() => { void fetchTokens(); }, [fetchTokens]);

  /* ui state */
  const [tokenId, setTokenId]   = useState('');
  const [meta,    setMeta]      = useState(null);
  const [ov,      setOv]        = useState({ open:false });
  const [confirmOpen, setConfirm] = useState(false);

  /*── metadata loader ───────────────────────────────*/
  const loadMeta = useCallback(async (id) => {
    setMeta(null);
    if (!contractAddress || id === '') return;

    /* indexed row */
    let rows = await jFetch(
      `${API}/tokens?contract=${contractAddress}&tokenId=${id}&limit=1`,
    ).catch(() => []);

    /* big-map fallback */
    if (!rows.length) {
      const one = await jFetch(
        `${API}/contracts/${contractAddress}/bigmaps/token_metadata/keys/${id}`,
      ).catch(() => null);
      if (one?.value) rows = [{ metadata: decodeMeta(hex2str(one.value)) }];
    }

    let m = rows?.[0]?.metadata ?? {};
    if (typeof m === 'string') m = decodeMeta(m);
    setMeta(m);
  }, [contractAddress]);

  useEffect(() => { void loadMeta(tokenId); }, [tokenId, loadMeta]);

  /*── destroy op ────────────────────────────────────*/
  const run = async () => {
    if (!toolkit)       return snack('Connect wallet', 'error');
    if (tokenId === '') return snack('Token-ID?', 'warning');

    try {
      setOv({ open:true, status:'Waiting for signature…' });
      const c  = await toolkit.wallet.at(contractAddress);
      const op = await c.methods.destroy(+tokenId).send();
      setOv({ open:true, status:'Broadcasting…' });
      await op.confirmation();

      snack('Destroyed ✓', 'success');
      onMutate();
      await fetchTokens();
      setTokenId(''); setMeta(null);
      setOv({ open:false });
    } catch (e) {
      setOv({ open:false });
      snack(e.message || String(e), 'error');
    }
  };

  /*── render ───────────────────────────────*/
  return (
    <Wrap $level={$level}>
      <PixelHeading level={3}>Destroy&nbsp;Token</PixelHeading>
      <HelpBox>
        V4 contracts don't have a burn entrypoint, instead they have an Admin-only “hard” burn: 
        sets **total_supply = 0** and marks token as destroyed. Metadata remains for provenance. 
        Pick token → Destroy → confirm. Irreversible and heavier fee than Burn. ❗MUST OWN ALL EDITIONS TO Destroy❗
        <br/>   
        </HelpBox>
      <div style={{ display:'flex', gap:'.5rem' }}>
        <PixelInput
          placeholder="Token-ID"
          style={{ flex:1 }}
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value.replace(/\D/g, ''))}
        />
        <Box>
          <select
            style={{ width:'100%', height:32 }}
            disabled={loadingTok}
            value={tokenId || ''}
            onChange={(e) => setTokenId(e.target.value)}
          >
            <option value="">
              {loadingTok
                ? 'Loading…'
                : tokOpts.length ? 'Select token' : '— none —'}
            </option>
            {tokOpts.map((t) => {
              const id   = typeof t === 'object' ? t.id   : t;
              const name = typeof t === 'object' ? t.name : '';
              return (
                <option key={id} value={id}>
                  {name ? `${id} — ${name}` : id}
                </option>
              );
            })}
          </select>
          {loadingTok && <Spin />}
        </Box>
      </div>

      <div style={{ marginTop:'1rem' }}>
        <TokenMetaPanel
          meta={meta}
          tokenId={tokenId}
          contractAddress={contractAddress}
        />
      </div>

      <PixelButton
        warning
        style={{ marginTop:'1rem' }}
        disabled={tokenId === ''}
        onClick={() => setConfirm(true)}
      >
        Destroy
      </PixelButton>

      <PixelConfirmDialog
        open={confirmOpen}
        message={(
          <>
            This will <strong>permanently reduce</strong> supply of&nbsp;
            token&nbsp;<code>{tokenId}</code> to&nbsp;0.<br/>
            Metadata remains on-chain for provenance.<br/><br/>
            Continue?
          </>
        )}
        onOk={() => { setConfirm(false); run(); }}
        onCancel={() => setConfirm(false)}
      />

      {ov.open && (
        <OperationOverlay
          {...ov}
          onRetry={run}
          onCancel={() => setOv({ open:false })}
        />
      )}
    </Wrap>
  );
}
/* EOF */
