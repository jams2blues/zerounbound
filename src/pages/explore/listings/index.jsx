/*Developed by @jams2blues – ZeroContract Studio
  File:    src/pages/explore/listings/index.jsx
  Rev:     r13   2025‑08‑19
  Summary(of what this file does): Explore → Listings grid for all
           active ZeroSum listings (ZeroContract family only). This
           revision adds a partial‑stock‑safe seller‑balance check
           (TzKT `/v1/tokens/balances`) so a listing remains visible
           when the seller still holds ≥1 edition, even if the
           listing’s recorded amount is higher due to sales on other
           markets. Also retains preview/supply gating and stable
           ordering. */

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import styledPkg from 'styled-components';

import ExploreNav        from '../../../ui/ExploreNav.jsx';
import LoadingSpinner    from '../../../ui/LoadingSpinner.jsx';
import TokenListingCard  from '../../../ui/TokenListingCard.jsx';

import { useWalletContext } from '../../../contexts/WalletContext.js';
import { NETWORK_KEY }      from '../../../config/deployTarget.js';
import { jFetch }           from '../../../core/net.js';

import decodeHexFields      from '../../../utils/decodeHexFields.js';
import detectHazards        from '../../../utils/hazards.js';
import { tzktBase }         from '../../../utils/tzkt.js';

import {
  listActiveCollections,
  listListingsForCollectionViaBigmap,
} from '../../../utils/marketplaceListings.js';

import { getAllowedTypeHashList } from '../../../utils/allowedHashes.js';

/* styled-components import guard (v5/v6 ESM/CJS) */
const styled = typeof styledPkg === 'function' ? styledPkg : styledPkg.default;

/*──────────────── layout ────────────────*/
const Grid = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--col), 1fr));
  gap: 1.2rem;
  justify-content: stretch;
  --col: clamp(160px, 18vw, 220px);
`;
const Center = styled.div`
  text-align: center;
  margin: 1.25rem 0 1.75rem;
`;

/*──────────────── helpers ────────────────*/
function isRenderableDataUri(uri) {
  if (typeof uri !== 'string') return false;
  const s = uri.slice(0, 48).toLowerCase();
  return (
    s.startsWith('data:image') ||
    s.startsWith('data:audio') ||
    s.startsWith('data:video') ||
    s.startsWith('data:application/svg+xml') ||
    s.startsWith('data:text/html')
  );
}
function hasRenderablePreview(m) {
  const meta = m && typeof m === 'object' ? m : {};
  const keys = [
    'displayUri','display_uri',
    'imageUri','image_uri','image',
    'thumbnailUri','thumbnail_uri',
    'artifactUri','artifact_uri',
    'mediaUri','media_uri',
  ];
  for (const k of keys) {
    const v = meta[k];
    if (isRenderableDataUri(v)) return true;
  }
  if (Array.isArray(meta.formats)) {
    for (const f of meta.formats) {
      const cand = (f && (f.uri || f.url)) || '';
      if (isRenderableDataUri(cand)) return true;
    }
  }
  return false;
}
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
function uniqByPair(items) {
  const seen = new Set(); const out = [];
  for (const it of items) {
    const key = `${it.contract}|${it.tokenId}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  return out;
}

/**
 * Batch‑check sellers for a given (contract, tokenId) with TzKT.
 * Keeps sellers with live balance ≥ `minUnits` (default 1).
 * Uses `/v1/tokens/balances` with `account.in`, `token.contract`, `token.tokenId`.
 */
async function keepSellersWithBalanceAtLeast(TZKT, nftContract, tokenId, sellers, minUnits = 1) {
  // Deduplicate; TzKT accepts up to a reasonable number via account.in
  const unique = [...new Set(sellers.filter(Boolean))];
  if (unique.length === 0) return new Set();

  const kept = new Set();
  const CHUNK = 50;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const qs = new URLSearchParams({
      'account.in': slice.join(','),
      'token.contract': nftContract,
      'token.tokenId': String(tokenId),
      select: 'account,balance',
      limit: String(slice.length),
    });
    const rows = await jFetch(`${TZKT}/tokens/balances?${qs}`, 1).catch(() => []);
    for (const r of rows || []) {
      const addr = r?.account?.address || r?.account;
      const bal  = Number(r?.balance ?? 0);
      if (typeof addr === 'string' && bal >= minUnits) kept.add(addr);
    }
  }
  return kept;
}

/**
 * Fallback discovery from the marketplace’s big‑maps:
 * prefer `listings_active` if present, else scan `listings`.
 * Returns a list of KT1 contract addresses potentially having active listings.
 */
async function discoverActiveCollectionsViaTzkt(TZKT, net, marketplaceAddress) {
  try {
    const maps = await jFetch(`${TZKT}/contracts/${marketplaceAddress}/bigmaps`).catch(() => []);
    let ptr = null;
    if (Array.isArray(maps)) {
      const active   = maps.find((m) => (m.path || m.name) === 'listings_active');
      const listings = maps.find((m) => (m.path || m.name) === 'listings');
      if (active)      ptr = active.ptr ?? active.id;
      else if (listings) ptr = listings.ptr ?? listings.id;
    }
    if (ptr == null) return [];
    // Extract KT1 addresses from big‑map keys.
    const rows = await jFetch(`${TZKT}/bigmaps/${ptr}/keys?limit=5000&active=true`).catch(() => []);
    const out = new Set();
    for (const r of rows || []) {
      const s = JSON.stringify(r?.key || r);
      const m = s && s.match(/KT1[0-9A-Za-z]{33}/);
      if (m && m[0]) out.add(m[0]);
    }
    return [...out];
  } catch { return []; }
}

/*──────────────── component ────────────────*/
export default function ListingsPage() {
  const { toolkit } = useWalletContext() || {};

  const net = useMemo(() => {
    if (toolkit?.[ '_network' ]?.type && /mainnet/i.test(toolkit._network.type)) return 'mainnet';
    const key = (NETWORK_KEY || 'ghostnet').toLowerCase();
    return key.includes('mainnet') ? 'mainnet' : 'ghostnet';
  }, [toolkit]);

  // IMPORTANT: tzktBase() already includes "/v1" — do not append again (Invariant I121/I152).
  const TZKT = useMemo(() => tzktBase(net), [net]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showCount, setCount] = useState(24);
  const [items, setItems]     = useState([]); // [{contract, tokenId, priceMutez, metadata, contractName}]

  const allowedHashes = useMemo(() => new Set(getAllowedTypeHashList()), []);

  /**
   * Filter to ZeroContract family via TzKT `contracts` (typeHash).
   */
  const filterAllowedContracts = useCallback(async (addrs) => {
    if (!Array.isArray(addrs) || addrs.length === 0) return [];
    const out = [];
    for (const slice of chunk(addrs, 50)) {
      const qs = new URLSearchParams({
        'address.in': slice.join(','),
        select: 'address,typeHash,metadata',
        limit: String(slice.length),
      });
      const rows = await jFetch(`${TZKT}/contracts?${qs}`, 2).catch(() => []);
      for (const r of rows || []) {
        const th = Number(r?.typeHash ?? r?.type_hash);
        if (allowedHashes.has(th)) {
          out.push({ address: String(r.address), name: (r.metadata && r.metadata.name) || '' });
        }
      }
    }
    return out;
  }, [TZKT, allowedHashes]);

  /**
   * Batched token metadata for a set of ids.
   */
  const fetchTokenMetaBatch = useCallback(async (contract, ids) => {
    const result = new Map();
    if (!contract || !Array.isArray(ids) || ids.length === 0) return result;
    for (const slice of chunk(ids, 40)) {
      const qs = new URLSearchParams({
        contract,
        'tokenId.in': slice.join(','),
        select: 'tokenId,metadata,holdersCount,totalSupply',
        limit: String(slice.length),
      });
      const rows = await jFetch(`${TZKT}/tokens?${qs}`, 2).catch(() => []);
      for (const t of rows || []) {
        let md = (t && t.metadata) || {};
        try { md = decodeHexFields(md || {}); } catch {}
        if (md && typeof md.creators === 'string') {
          try { const j = JSON.parse(md.creators); if (Array.isArray(j)) md.creators = j; } catch {}
        }
        result.set(String(t.tokenId), {
          metadata: md,
          holdersCount: Number(t.holdersCount || t.holders_count || 0),
          totalSupply : Number(t.totalSupply  || t.total_supply  || 0),
        });
      }
    }
    return result;
  }, [TZKT]);

  useEffect(() => {
    let abort = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        /* 1) discover candidate collections with listings (fast path) */
        let candidates = await listActiveCollections(net, false).catch(() => []);
        if (!Array.isArray(candidates)) candidates = [];

        /* 2) supplement via marketplace big‑maps to catch very fresh listings */
        const marketplaceCandidates = await discoverActiveCollectionsViaTzkt(
          TZKT,
          net,
          undefined,
        ).catch(() => []);
        if (Array.isArray(marketplaceCandidates) && marketplaceCandidates.length) {
          for (const kt of marketplaceCandidates) if (!candidates.includes(kt)) candidates.push(kt);
        }

        /* 3) keep only ZeroContract family (typeHash allow‑list) */
        const allowed = await filterAllowedContracts(candidates);

        /* 4) per collection: fetch active listings and verify seller stock ≥ 1 (partial‑stock‑safe) */
        const byContract = new Map(); // KT1 -> Set(tokenId)
        const prices     = new Map(); // "KT1|id" -> priceMutez
        const names      = new Map(); // KT1 -> contract name

        for (const { address: kt, name } of allowed) {
          names.set(kt, name || '');

          const ls = await listListingsForCollectionViaBigmap(kt, net).catch(() => []);
          if (!Array.isArray(ls) || ls.length === 0) continue;

          // Normalize & keep “active, amount>0, valid tokenId”
          let active = ls.filter((l) => {
            const amt = Number(l?.amount ?? l?.available ?? 0);
            const isActive = (l?.active ?? true) !== false;
            const idOk = Number.isFinite(Number(l?.tokenId ?? l?.token_id));
            return amt > 0 && isActive && idOk;
          });
          if (active.length === 0) continue;

          // Group by tokenId & collect sellers to check in one hit
          const sellersById = new Map(); // id -> Set(sellers)
          for (const l of active) {
            const id = Number(l.tokenId ?? l.token_id);
            const s  = String(l.seller || '');
            const set = sellersById.get(id) || new Set();
            set.add(s);
            sellersById.set(id, set);
          }

          // For each tokenId: keep sellers with balance ≥ 1
          const keptById = new Map(); // id -> Set(kept sellers)
          for (const [id, sellersSet] of sellersById.entries()) {
            const keepSet = await keepSellersWithBalanceAtLeast(TZKT, kt, id, [...sellersSet], 1);
            keptById.set(id, keepSet);
          }

          // Trim the listing set to those sellers; then compute the lowest price per tokenId
          const byId = new Map(); // id -> { priceMutez, … }
          for (const l of active) {
            const id       = Number(l.tokenId ?? l.token_id);
            const price    = Number(l.priceMutez ?? l.price);
            const seller   = String(l.seller || '');
            const keepSet  = keptById.get(id);
            if (!keepSet || !keepSet.has(seller)) continue; // seller has 0 in stock → hide
            if (!Number.isFinite(price) || price <= 0) continue;
            const prev = byId.get(id);
            if (!prev || price < prev.priceMutez) {
              byId.set(id, { ...l, tokenId: id, priceMutez: price });
            }
          }
          if (byId.size === 0) continue;

          // Track ids and prices for later metadata pass
          const set = byContract.get(kt) || new Set();
          for (const [id, row] of byId.entries()) {
            set.add(id);
            prices.set(`${kt}|${id}`, Number(row.priceMutez));
          }
          byContract.set(kt, set);
        }

        /* 5) metadata pass per contract (preview/supply gating) and card assembly */
        const assembled = [];
        for (const [kt, idSet] of byContract.entries()) {
          const ids = [...idSet];
          const metaMap = await fetchTokenMetaBatch(kt, ids);
          for (const id of ids) {
            const key        = `${kt}|${id}`;
            const priceMutez = prices.get(key);
            const metaEntry  = metaMap.get(String(id)) || {};
            const md         = metaEntry.metadata || {};
            const supply     = Number(metaEntry.totalSupply ?? 0);
            if (!Number.isFinite(priceMutez)) continue;
            if (!hasRenderablePreview(md)) continue;
            if (detectHazards(md)?.broken) continue;
            if (supply === 0) continue;
            assembled.push({
              contract     : kt,
              tokenId      : id,
              priceMutez   : priceMutez,
              metadata     : md,
              contractName : names.get(kt) || undefined,
            });
          }
        }

        // Order newest visible first by tokenId as a simple, stable heuristic
        const unique = uniqByPair(assembled);
        unique.sort((a, b) => b.tokenId - a.tokenId);

        if (!abort) {
          setItems(unique);
          setLoading(false);
        }
      } catch (err) {
        if (!abort) {
          setError((err && (err.message || String(err))) || 'Network error');
          setItems([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => { abort = true; };
  }, [net, TZKT, filterAllowedContracts, fetchTokenMetaBatch]);

  const visible = useMemo(() => items.slice(0, showCount), [items, showCount]);

  return (
    <>
      <ExploreNav hideSearch />
      {loading && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && (
        <p role="alert" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          Could not load listings. Please try again.
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          No active listings found.
        </p>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <Grid>
            {visible.map(({ contract, tokenId, priceMutez, metadata, contractName }) => (
              <TokenListingCard
                key={`${contract}-${tokenId}`}
                contract={contract}
                tokenId={tokenId}
                priceMutez={priceMutez}
                metadata={metadata}
                contractName={contractName}
              />
            ))}
          </Grid>
          {showCount < items.length && (
            <Center>
              <button
                type="button"
                onClick={() => setCount((n) => n + 24)}
                style={{
                  background: 'none',
                  border: '2px solid var(--zu-accent,#00c8ff)',
                  color: 'var(--zu-fg,#fff)',
                  padding: '0.4rem 1rem',
                  fontFamily: 'Pixeloid Sans, monospace',
                  cursor: 'pointer',
                }}
              >
                Load&nbsp;More&nbsp;🔻
              </button>
            </Center>
          )}
        </>
      )}
    </>
  );
}

/* What changed & why:
   • Partial‑stock‑safe visibility: retain listings when any seller still has
     ≥1 unit (TzKT `/v1/tokens/balances` batch check). Avoids false negatives
     caused by cross‑market trades lowering balances without updating original
     listing amounts.
   • Kept: ZeroContract allow‑list via typeHash, preview & non‑zero supply
     guards, dedupe (contract|tokenId), and stable “newest‑first” ordering.
   • TzKT base via tzktBase(net) already ends with `/v1` (no double‑append). */
