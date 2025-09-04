﻿/*â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DevelopedÂ byÂ @jams2blues â€“Â ZeroContractÂ Studio
  File:    docs/Master_Overview_And_Manifest_zerounbound_contractmanagement.md
  Rev :    r1187    2025â€‘09â€‘03Â UTC
  Summary: canonical slicer, IDBâ€‘only slice cache, dataâ€‘URI tests, RPCâ€‘backed
           extrauri view, consolidated Share appendix, and liveâ€‘supply semantics
           across collections/tokens (nonâ€‘empty = any token with totalSupply>0).
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€*/

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ZEROÂ UNBOUNDÂ v4 â€” MASTERÂ OVERVIEW & SOURCEâ€‘FILEÂ MANIFEST
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WHATÂ ISÂ THISÂ FILE?Â (unabridged)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
This document is the singleâ€‘sourceâ€‘ofâ€‘truth for the ZeroÂ Unbound
platform. A fresh git clone plus this manifest and the bundle
outputs yield a reproducible build on any host. It outlines the
architecture, invariants, sourceâ€‘tree map and CI pipeline. History
is appendâ€‘only; revisions are never overwritten.

The project uses a unified singleâ€‘stage origination pipeline
even when a factory contract is configured. When a factory
address exists for the target network, the UI assembles the full
metadata JSON (keys ordered per TZIPâ€‘16) and encodes it as a
bytes parameter. This bytes payload contains only the metadata
and offâ€‘chain views; storage pairs are not included. The
factory constructs the storage internally and originates a new **v4e**
contract via CREATE_CONTRACT. On networks without a factory,
the UI falls back to toolkit.wallet.originate() with the full
metadata bigâ€‘map. Marketplace integration includes listings,
offers and tokens pages under /explore and /my.

**New in this revision** â€” Canonical slicing & IDB checkpoints:
â€¢ Introduced `src/core/slicing.js` used by Mint/Append/Repair and the fee
  estimator, ensuring deterministic head/tail splits and matching signature
  counts.
â€¢ Slice checkpoints now persist in IndexedDB only with automatic migration;
  legacy localStorage paths were removed.
â€¢ Added Jest coverage for resume logic and SVG dataâ€‘URI validation.

See the TZIP invariants companion for standard compliance rules.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
TABLEÂ OFÂ CONTENTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
0Â Â·Â GlobalÂ RulesÂ &Â MetaÂ Docs  
1Â Â·Â Highâ€‘LevelÂ Architecture  
1Â·5Â Criticalâ€‘EntryÂ Index  
2Â Â·Â InvariantsÂ (I00Â â€“Â I156)  
3Â Â·Â Reserved  
4Â Â·Â Sourceâ€‘TreeÂ MapÂ (perâ€‘file descriptionÂ +Â imports/exports)  
5Â Â·Â BundleÂ Index  
6Â Â·Â Quickâ€‘StartÂ &Â CIÂ Pipeline  
7Â Â·Â Appendices  
8Â Â·Â ChangeÂ Log

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
0 Â· GLOBALÂ RULES & METAÂ DOCS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â€¢ History is appendâ€‘only; patch instead of overwrite.  
â€¢ Binary artefacts stay out of bundles.  
â€¢ docs/ mirrors this masterâ€”update both when changes occur.  
â€¢ The TZIP compliance invariants live in
  `docs/TZIP_Compliance_Invariants_ZeroContract_V4.md` and extend
  this manifestâ€™s rules.

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
1 Â· HIGHâ€‘LEVEL ARCHITECTURE & DATAâ€‘FLOW
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Browser (ReactÂ 18Â +Â styledâ€‘componentsÂ 6) â†’ ZeroFrontendÂ SPA
(Next.jsÂ 15.x) â†’ ZeroEngineÂ API (NodeÂ 22Â +Â Taquito) â†’ ZeroContracts
**v4e** + ZeroSum Marketplace (TezosÂ L1). 100Â % onâ€‘chain media via
data URIs. All remote HTTP traffic uses core/net.js with
multiâ€‘RPC fallback and exponential backâ€‘off.

Singleâ€‘Stage Origination â€” The UI collects user metadata via
DeployCollectionForm, constructs a deterministic metadata object
with ordered keys (name, symbol, description, version, license,
authors, homepage, authoraddress, creators, type, interfaces,
imageUri, views), encodes it to bytes and calls the factoryâ€™s
deploy entrypoint. The factory ignores the bytes payload when
constructing storage but stores the metadata on chain via
tezosâ€‘storage:content. On networks without a factory, the
frontend still builds a metadata bigâ€‘map and uses
wallet.originate().

Marketplace Integration â€” The explore section includes
/explore/listings (grid of tokens with active marketplace listings)
and the my section includes /my/offers and /my/tokens
(offers made/received and owned/minted tokens). Listing and
offer actions use `src/core/marketplace.js` helpers and dialogs
(ListTokenDialog, BuyDialog, MakeOfferDialog, AcceptOffer,
CancelListing, CancelOffer) with progress handled by
OperationOverlay.

Discovery, Caching & Parity â€” A unified discovery utility collects
candidate contract addresses from TzKT by initiator, creator, manager,
mintedâ€‘by and ownedâ€‘by. Results are validated against an allowâ€‘list of
ZeroContract type hashes and then enriched with lightweight contract rows.
All heavy reads are cached in IndexedDB with short TTLs. The Manageâ€‘page
carousels and /my/collections now consume the same dataâ€‘plane and are
expected to show the same set of contracts for a wallet (ordering can
differ by page purpose).

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
1Â·5 Â· CRITICALâ€‘ENTRY INDEX ðŸ—ï¸
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â€¢ `src/pages/deploy.js` â€” singleâ€‘stage origination; factory bytes param;
  ordered metadata; factory fallback to originate on UI when needed.
â€¢ `src/pages/explore/[[...filter]].jsx` â€” dynamic explore grid; admin/contract
  filters; shared discovery + idbCache for consistency.
â€¢ `src/pages/explore/listings/index.jsx` â€” lists tokens with active
  ZeroSum marketplace listings; responsive grid; uses
  TokenListingCard and marketplace helpers; **tzktBase already `/v1`**; do not
  append again.
â€¢ **`src/pages/explore/tokens.jsx` â€” ZeroContract tokens grid** with:
  **scanâ€‘ahead minâ€‘yield pagination** (avoids dead clicks), **accurate totals**
  via fallback + endâ€‘ofâ€‘paging reconciliation, **admin filter** parity,
  **preview & nonâ€‘zeroâ€‘supply guard**, and **`/v1` base normalization**.
â€¢ `src/pages/explore/secondary.jsx` â€” alternate explore route auxiliary
  page (networkâ€‘aware).
â€¢ `src/pages/my/collections.jsx` â€” **parity with ContractCarousels**; uses
  shared discovery + idbCache; includes v1â†’v4e; tolerates empty collections.
â€¢ `src/pages/my/offers.jsx` â€” lists marketplace offers (accept/made),
  uses TZIPâ€‘16 views and marketplace helpers.
â€¢ `src/pages/my/tokens.jsx` â€” unified minted/owned discovery and
  filtering (live balances, valid typeHash); decodes hex metadata;
  skips burnâ€‘only tokens.
â€¢ `src/ui/ContractCarousels.jsx` â€” creator/admin carousels on Manage page;
  backed by shared discovery + idbCache; clickâ€‘toâ€‘load contract.
â€¢ `src/ui/TokenListingCard.jsx` â€” listing card used on /explore/listings
  grid (imports MarketplaceBuyBar/MarketplaceBar).
â€¢ `src/ui/MarketplaceBuyBar.jsx` â€” compact buyâ€‘action bar variant for
  listings cards.
â€¢ `src/ui/BuyDialog.jsx` â€” buy modal with TzKT preflight and tagged stale
  listings errors.
â€¢ `src/core/marketplace.js` â€” **ZeroSum helpers + staleâ€‘listing guard**:
  `getMarketContract`, `fetchLowestListing`, onâ€‘chain/offâ€‘chain view readers,
  **`getFa2BalanceViaTzkt()`**, **`preflightBuy()`** (seller FA2 balance via
  TzKT `/v1/tokens/balances`), and paramâ€‘builders for `buy/list/offer/cancel/
  accept` with methodâ€‘name/positional fallbacks.

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
2 Â· INVARIANTS ðŸ”’ (scope tags: [F]rontend | [C]ontract | [E]ngine | [I]nfra)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
I00 [F, C, E, I] All UI elementsâ€”styling, fonts, buttons, overlays, popups,
containers, and moreâ€”must follow our 8â€‘bit retro arcade theme, including
pixel fonts, sprites, palettes, layouts, and theme context. Every component and
page should be resolutionâ€‘ and aspectâ€‘ratioâ€‘agnostic: interfaces must adapt
fluidly so text, images, and containers render and resize correctly on any
device or viewport.
I01 [C] One canonical onâ€‘chain record per contract instance.
I02 [E] Engine â†” Chain parity â‰¥ 2 blocks.
I03 [F,C] Roleâ€‘based ACL (admin/owner/collaborator).
I04 [C] Contract terms immutable once locked.
I05 [E] All mutating ops emit audit row + chain event.
I06 [F] Mobileâ€‘first UI; no sideways scroll â‰¤ 320 px.
I07 [F] LCP â‰¤ 2 s (P95 midâ€‘range Android).
I08 [F] WCAGÂ 2.2Â AA; theme & consent persist **per wallet via IndexedDB**.
I09 [F] PWA offline shell (WorkboxÂ 7, â‰¤Â 5Â MiB cache).
I10 [E] deployTarget.js is single network divergence point.
I11 [I] Caseâ€‘sensitive path guard in CI.
I12 [C] hashMatrix.json = SHAâ€‘1 â†’ version (appendâ€‘only).
I13 [C] entrypointRegistry.json appendâ€‘only.
I14 [I] bundle.config.json globs mirror Manifest Â§5.
I15 [E] Engine pods stateless.
I16 [E] Jest coverage â‰¥Â 90Â %.
I17 [E] (retired) legacy 3Â Mâ€‘block backâ€‘scan.
I18 [E] RPC failâ€‘over after 5 errors.
I19 [F] SSRâ€‘safe: hooks never touch window during render.
I20 [F] Exactly one document.js.
I21 [I] Corepack pins YarnÂ 4.9.1.
I22 [F] ESLint bans emâ€‘dash.
I23 [F] Styledâ€‘components factory import invariant.
I24 [F] Media =data URIs; no IPFS.
I25 [F] SVG canvas square & centred.
I26 [F] JS chunk â‰¤Â 32â€‰768â€‰B; total â‰¤Â 2â€‰MiB.
I27 [I] Monotonic Rev id ledger.
I28 [I] No pathâ€‘case duplicates.
I29 [I] CI tests NodeÂ 20Â LTS +Â 22.
I30 [F] useWallet alias until v5.
I31 [E] Offâ€‘chain templates carry MDâ€‘5 checksum.
I32 [I] No .env secrets in code.
I33 [C] Registries immutable (appendâ€‘only).
I34 [F] All colours via CSS vars.
I35 [F] Transient SC props filtered.
I36 [F] ESLint noâ€‘multiâ€‘spaces passes.
I37 [C] TZIPâ€‘04/12/16 compliance (see meta file).
I38 [C] Metadata stored in tezosâ€‘storage:content.
I39 [C] Interfaces array deduped preâ€‘storage.
I40 [E,F] Single jFetch Source â€” all HTTP via core/net.js.
I41 [F] Central RenderMedia Pipeline enforced.
I42 [F] Perâ€‘EP Overlay UX â€” one modal per AdminTools action.
I43 [E] jFetch global concurrency LIMIT =Â 4 & exponential 429 backâ€‘off.
I44 [F] Header publishes real height via CSS var --hdr; Layout obeys.
I45 [F] Single global scrollâ€‘region; inner comps never spawn scrollbars.
I46 [F] All DOMâ€‘mutating effects use useIsoLayoutEffect when SSR possible.
I47 [F] ZerosBackground obeys perf guard (â‰¤Â 4Â % CPU @Â 60Â fps).
I48 [F] Animated backgrounds idle â‰¤Â 4Â % CPU on lowâ€‘end mobiles.
I49 [F,C] Token metadata arrays/objects JSONâ€‘encode exactly once then hexâ€‘wrap.
I50 [F] Royalty UI % cap â‰¤Â 25Â %; stored as basisâ€‘points.
I51 [F,C] authoraddress key omitted when blank.
I52 [F] Tezos address validators accept tz1|tz2|tz3|KT1.
I53 [F,C] (dup of I49) JSONâ€‘encode once â†’ hexâ€‘wrap.
I54 [F] Dynamic tokenâ€‘id fetch â€” Mint.jsx must query next_token_id.
I55 [F] Operation size guard â€” sliceHex uses 1â€¯024â€¯B headâ€‘room.
I56 [F] Oversize mint triggers upfront Snackbar warning.
I57 [F] WalletContext delayed BeaconWallet instantiation.
I58 [F] Reveal action uses explicit 1â€¯mutez transfer.
I59 [F] Silent session restore on mount.
I60 [F,E] Resumable Slice Uploads â€” Mint, Append &Â Repair.
I61 [F] Sliceâ€‘Cache Hygiene & Expiry (purge rules).
I62 [F] Busyâ€‘Select Spinner.
I63 [I] Singleâ€‘Repo Target Switch (scripts/setTarget.js).
I64 [F] Wheelâ€‘Tunnel Modals.
I65 [F] Immediate Busy Indicators â€” superseded by I76.
I66 [F] Emptyâ€‘Collection Grace.
I67 [F,E] Filter destroyed / burn balances.
I68 [E] listLiveTokenIds.js 30Â s TTL.
I69 [F] ContractCarousels autoâ€‘refresh + zu_cache_flush listener.
I70 [I] destroy/burn dispatches zu_cache_flush.
I71 [F] Copyâ€‘Address UX via PixelButton.
I72 [F] RenderMedia downloadâ€‘fallback.
I73 [F] Relationship Microâ€‘Stats â€” TokenMetaPanel.
I74 [F,E] Chunkâ€‘Safe Estimator batches â‰¤Â 8 ops.
I75 [F] v4a Entrypoint Guards.
I76 [F] Inline Busy Overrides.
I77 [F] Relationshipâ€‘Aware Disable for destructive EPs.
I78 [F] SVG Pixelâ€‘Integrity via sandbox.
I79 [F] Header copyâ€‘clipboard reachable â‰¤â€¯320â€¯px & â‰¥â€¯8â€¯K.
I80 [F] Carousel arrows live inside container.
I81 [F] Mint tagâ€‘input autoâ€‘chips.
I82 [F] Form values persist across navigation.
I83 [F] Modal CloseBtn anchor stays inside modal bounds.
I84 [F] Unicode & Emoji acceptance â€” full UTFâ€‘8 except C0/C1.
I85 [F] Single feeEstimator.js source of truth â€” duplicates banned.
I86 [F] HelpBox Standard â€” standardized HelpBox across entryâ€‘points.
I87 [F] Live JSON Validation â€” disable CTA until valid JSON.
I88 [I] ESLint noâ€‘localâ€‘estimator Rule.
I89 [F,E] v4a slice batch storageLimit computed per payload.
I90 [F] All wait/sleep via sleepV4a.js.
I91 [F,E] Shared ledger wait logic in v4a flows.
I92 [F] MintV4a.jsx invokes shared ledgerâ€‘wait only after first slice.
I93 [F] OperationOverlay funâ€‘lines scroll spec.
I94 [F] AdminTools header count rules.
I95 [F] v4a collections warn banner.
I96 [F] OperationOverlay funâ€‘lines color via var(--zuâ€‘accent).
I97 [F] OperationOverlay Close triggers window.location.reload().
I98 [F] Origination CloseBtn topâ€‘right escape obeys I83.
I99 [F] Every upload runs through onChainValidator.js.
I100 [F] SAFE_REMOTE_RE allowâ€‘list â€” C0 only / C1 allowed.
I101 [F] Mature/flashing flags irreversible once set.
I102 [F] Responsive Entryâ€‘Point & Metaâ€‘Panel Blueprint (grid spec).
I103 [F] Readâ€‘only legacy alias artists â†’ authors.
I104 [F,C] Contract metadata must include symbol key (3â€‘5Â Aâ€‘Z/0â€‘9).
I105 [F] Explore grid uniformity (autoâ€‘fill col clamp).
I106 [F] Scriptâ€‘Hazard Consent sandboxing model.
I107 [F] Hexâ€‘field UTFâ€‘8 repair via decodeHexFields.js.
I108 [F] Tokenâ€‘ID filter UX on contract pages.
I109 [F,E] Live onâ€‘chain stats from countTokens/countOwners.
I110 [F] Integrity badge standardisation.
I111 [F,C,E,I] Avoid word â€œglobalâ€ in comments/summaries.
I112 [F,E] Marketplace dialogs must use feeEstimator.js + OperationOverlay.
I113 [F] Unified Consent Management via useConsent hook.
I114 [F] Portalâ€‘based draggable preview windows (SSRâ€‘safe).
I115 [F] Hazard detection & content protection (nsfw/flashing/scripts).
I116 [F] Debounced Form State Pattern; id/index pattern.
I117 [F] Script Security Model â€” consent & addressâ€‘scoped toggles.
I118 [retired] Dualâ€‘Stage Origination (removed).
I119 [F] Remote domain patterns caseâ€‘sensitive; allowâ€‘list only (I100).
I120 [F] Dev scripts propagate selected network into runtime/build.
I121 [F] **TzKT API bases must include /v1**; derived or normalized in code.
I122 [F] Token meta panels decode collection metadata fully.
I123 [F,E] Marketplace actions wired to ZeroSum helpers & dialogs.
I124 [E,F] Concurrent Ghostnet/Mainnet via yarn set:<network> && dev:current.
I125 [F] /explore/listings shows live ZeroSum listings with helper fns.
I126 [F,C] Factory parameter contains only ordered metadata bytes.
I127 [F] Deploy pages must inject full views array on origination.
I128 [F] Listings/my pages derive TzKT bases via deployTarget.js.
I129 [F,E] MyTokens minted/metadata discovery & liveâ€‘balance filter.
I130 [F] MyTokens guard â€” typeHash set and burnâ€‘only exclusion.
I131 [F] Domain resolution env â€” skip KT1; import DOMAIN_CONTRACTS/FALLBACK_RPCS.
I132 [I] Target default/mainnet â€” TARGET='mainnet' is the default.
I133 [C,F,E] Canonical contract version â€” v4e; full backâ€‘compat via hashMatrix.
I134 [F,E] Listings aggregation uses marketplaceListings.js.
I135 [F] **IndexedDB cache is the only persistence layer** for discovery/carousels; localStorage forbidden for these flows.
I136 [F,E] **Unified contract discovery** lives in src/utils/contractDiscovery.js; Manage carousels and /my/collections must call it.
I137 [F,C] **Allowed typeâ€‘hash set** exported via src/utils/allowedHashes.js; derived from src/data/hashMatrix.json; appendâ€‘only.
I138 [F] **Parity** â€” ContractCarousels and /my/collections must show the same contract set for a wallet; empty collections are allowed.
I139 [F] **/v1 guard** â€” TzKT base must be normalised to end with â€œ/v1â€.
I140 [F] **ExploreNav is mandatory** on explore/* and my/* pages unless explicitly hidden via prop for modals.
I141 [F] **CollectionCard propâ€‘shape** accepts string KT1 or object {address,â€¦}; component must resolve gracefully without extra calls.
I142 [F] **Batch resilience** â€” discovery validation proceeds perâ€‘batch; failed groups are logged and skipped, not fatal.
I143 [F,E] **jFetch budget** â€” â‰¤ 6 concurrent total; internal limiter default =Â 4 for browser tabs.
I144 [F] **Network awareness** â€” derive network from toolkit._network or TARGET; never hardâ€‘code.
I145 [F] **No stray sentinels** â€” â€œEOFâ€ or similar markers are banned inside JS/JSX.
I146 [F] **Adminâ€‘only visibility** â€” /my/collections may show empty or WIP contracts since the page is walletâ€‘scoped.
I147 [F] **Sort order** â€” default sort by lastActivityTime desc; stable tiebreaker = address asc.
I148 [E,F] **Staleâ€‘listing guard** â€” verify sellerâ€™s FA2 balance via TzKT `/v1/tokens/balances`; suppress listing and throw `STALE_LISTING_NO_BALANCE` when insufficient.
I149 [E] **TzKT query shape** â€” use `account`, not `account.address`, in `/tokens/balances`; `select` = `balance`.
I150 [F] **Listings grid hygiene** â€” require valid preview & nonâ€‘zero `totalSupply`; dedupe by `contract|tokenId`.
I151 [F] **Transient props** â€” Nonâ€‘standard DOM props must use transient form (`$prop`) or be filtered before reaching the DOM.
I152 [F,E] **tzktBase `/v1` guard** â€” `tzktBase(net)` returns a base already including `/v1`; callers must not append it again.
I153 [F] **ExploreNav mandatory** â€” reaffirmed for all `explore/*` and `my/*` routes unless intentionally hidden for modals.
I154 [F,E] **Tagged errors** â€” marketplace helpers surface actionable tags (`MISSING_LISTING_DETAILS`, `STALE_LISTING_NO_BALANCE`).
I155 [I] **No sentinels in JS/JSX** â€” comment footers end with `*/` only.
I156 [E] **Preflight budget & TTL** â€” balance checks observe jFetch limits; cache per `(seller,KT1,tokenId)` for â‰¤60â€¯s (networkâ€‘scoped).
I157 [C,E,F] **EP_MINT_SIGNATURES** â€” v1,v2b â†’ mint(map,address); v2a,v3â€“v4e â†’ mint(nat,map,address); v4a â†’ mint(address,nat,map). Unit test asserts UI builds these shapes.
I158 [F,E] Canonical slicer shared by estimator and batch; signature counts must align.
I159 [F] Slice checkpoints persist in IndexedDB only; migrate legacy localStorage then purge.
I160 [F,E] Append/Repair recompute on-chain prefix after each confirmation; duplicate bytes dropped; mismatch aborts.
I161 [F] OperationOverlay surfaces â€œResumeâ€ when wallet prompts stall.
I162 [F] Data URIs validated via `isValidDataUri`/`isLikelySvg` before slicing.

Invariants Addendum (Consolidated Share System) â€” I200â€“I213
- I200: `zu:openShare` event contract is stable. Unknown fields ignored; missing optional fields trigger bestâ€‘effort fetches.
- I201: ShareDialog never executes scripts; previews are images only. HTML/SVG with script capabilities are not mounted inside the dialog.
- I202: `@` is prefixed only for real X handles. Addresses (full or abbreviated) never receive `@`.
- I203: Handle resolution uses the first tz in `creators` for `/api/handle/[address]`. Failure does not block dialog open.
- I204: Fallback titles â€” token from token metadata; collection from bigâ€‘map `content` or contract `metadata|alias`.
- I205: URL normalization â€” relative â†’ absolute using `window.location.origin`; token URLs prefer `SITE_URL`.
- I206: IPFS normalization â€” any `ipfs://` preview URI is converted to `https://ipfs.io/ipfs/`.
- I207: Listing card SHARE resides below BUY in `ActionsRow` and MUST not affect price alignment.
- I208: Collection card SHARE MUST include `scope:'collection'` and SHOULD pass `name` and `creators` when known.
- I209: API `/api/handle/[address]` returns `{ handle, alias }`; clients use `handle` for `@`, otherwise full tz.
- I210: Variant 'purchase' changes only the verb; alias and preview rules unchanged.
- I211: ShareDialog download links sanitize filenames; extension derives from MIME (if given).
- I212: No shortening of addresses in share messages; full tz addresses appear verbatim.
- I213: All networkâ€‘aware share behavior depends on `deployTarget.js` (`SITE_URL`, `TZKT_API`, `NETWORK_KEY`).

Invariants Addendum (Liveâ€‘Supply & Nonâ€‘Empty Semantics) â€” I214â€“I221
- I214: Nonâ€‘empty collection = existence of any token row with `totalSupply>0` (verified via `/v1/tokens`). Do not rely solely on `/tokens/count`.
- I215: `countTokens(KT1, net)` validates server counts by reading `/tokens` rows; it returns 0 if no row has `totalSupply>0`.
- I216: Explore Â· Collections prefilters contracts by reading token rows (chunked) and caches nonâ€‘empty per KT1.
- I217: `CollectionCard` hides when live token count is 0 and only fetches owner counts when live>0.
- I218: Explore Â· Tokens requires `totalSupply.gt=0` serverâ€‘side and clientâ€‘side guards drop any row with `totalSupply===0`.
- I219: Contract page token grid uses `listLiveTokenIds()` for the allowâ€‘set and overlays meta/preview guards; header token count uses `countTokens()`.
- I220: My Â· Tokens â€œOwnedâ€ builds from balances `balance.ne=0` (no dependency on a burn address). â€œCreationsâ€ hides destroyed by default (toggleable).
- I221: Liveness/burn semantics are addressâ€‘agnostic; destroy/burn entrypoints and direct burns are all unified under `totalSupply>0` rules.

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
3 Â· RESERVED
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Reserved for future research notes and protocol upgrades.

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
4 Â· COMPREHENSIVE SOURCEâ€‘TREE MAP (perâ€‘file descriptionÂ â€¢ importsÂ â€¢ exports)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/* Legend â€” one line per path, keep caseâ€‘exact  
<relativeâ€‘path> â€” <purpose>; Imports: <commaâ€‘list>; Exports: <commaâ€‘list>  
â€œÂ·â€ = none.  Where helpful, inline citations point to bundle dumps. */

zerounbound â€” repo root; Imports: Â·; Exports: Â·
zerounbound/.eslintrc.cjs â€” ESLint ruleset; Imports: eslintâ€‘configâ€‘next; Exports: module.exports
zerounbound/.gitignore â€” git ignore list; Imports: Â·; Exports: Â·
zerounbound/.prettierrc â€” Prettier config; Imports: Â·; Exports: module.exports
zerounbound/.yarnrc.yml â€” YarnÂ 4 settings; Imports: Â·; Exports: Â·
zerounbound/.yarn/ â€” Yarn data; Imports: Â·; Exports: Â·
zerounbound/.github/CODEOWNERS â€” repo ownership map; Imports: Â·; Exports: Â·
zerounbound/.github/PULL_REQUEST_TEMPLATE.md â€” PR template; Imports: Â·; Exports: Â·
zerounbound/.github/ci.yml â€” CI workflow; Imports: Â·; Exports: Â·
zerounbound/.next/ â€” Next build output (ephemeral); Imports: Â·; Exports: Â·
zerounbound/next-env.d.ts â€” Next.js TS globals; Imports: Â·; Exports: Â·
zerounbound/bundle.config.json â€” bundle glob mapÂ (I14); Imports: Â·; Exports: Â·
zerounbound/LICENSE â€” MIT licence text; Imports: Â·; Exports: Â·
zerounbound/AGENTS.md â€” contributor & Codex guide; Imports: Â·; Exports: Â·
zerounbound/README_contract_management.md (retired 512c275) â€” former overview; Imports: Â·; Exports: Â·
zerounbound/docs/AI_CUSTOM_INSTRUCTIONS.md â€” collaboration instructions; Imports: Â·; Exports: Â·
zerounbound/docs/TZIP_Compliance_Invariants_ZeroContract_V4.md â€” TZIP invariants (companion). Imports: Â·; Exports: Â·
zerounbound/docs/AI_SYSTEM_INSTRUCTIONS.txt â€” assistant system rules; Imports: Â·; Exports: Â·
zerounbound/docs/Master_Overview_And_Manifest_zerounbound_contractmanagement.md â€” **this file**; Imports: Â·; Exports: Â·
zerounbound/next.config.js â€” Next.js config; Imports: nextâ€‘mdx,@next/font; Exports: module.exports
zerounbound/jest.config.cjs â€” Jest config; Imports: Â·; Exports: module.exports
zerounbound/jest.setup.js â€” Jest setup (polyfills, env); Imports: Â·; Exports: Â·
zerounbound/package.json â€” NPM manifest; Imports: Â·; Exports: scripts,dependencies
zerounbound/tsconfig.json â€” TS path hints; Imports: Â·; Exports: compilerOptions
zerounbound/yarn.lock â€” Yarn lockfile; Imports: Â·; Exports: Â·

â•­â”€â”€ __tests__ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/__tests__/dummy.test.js â€” placeholder test; Imports: Â·; Exports: Â·
zerounbound/__tests__/sliceResume.test.js â€” resume-safe slicer tests; Imports: planHead,cutTail; Exports: Â·
zerounbound/__tests__/svgDataUri.test.js â€” data-URI validation tests; Imports: isValidDataUri; Exports: Â·
zerounbound/__tests__/v2aLedger.test.js â€” tests v2a ledger fallback; Imports: getLedgerBalanceV2a; Exports: Â·

â•­â”€â”€ buildÂ / infra â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/scripts/ensureDevManifest.js â€” CI guard for dev manifest; Imports: fs,path; Exports: main
zerounbound/scripts/generateBundles.js â€” dumps bundles â†’ summarized_files; Imports: globby,fs; Exports: main
zerounbound/scripts/generateManifest.js â€” rebuilds this manifest; Imports: fs,globby; Exports: main
zerounbound/scripts/setTarget.js â€” switches TARGET (I63/I132); Imports: fs; Exports: setTarget
zerounbound/scripts/startDev.js â€” custom dev wrapper; Imports: child_process; Exports: main
zerounbound/scripts/updatePkgName.js â€” rewrites package.json name; Imports: fs; Exports: main
zerounbound/scripts/codex-setup.sh â€” Codex CI bootstrap; Imports: Â·; Exports: Â·

â•­â”€â”€ contractsÂ (michelson & refs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/contracts/Zero_Contract_V3.tz â€” legacy v3 contract; Imports: Â·; Exports: Â·
zerounbound/contracts/Zero_Contract_V4.tz â€” legacy v4 (readâ€‘only); Imports: Â·; Exports: Â·
zerounbound/contracts/Zero_Contract_v4e.tz â€” **canonical v4e**; Imports: Â·; Exports: Â·
zerounbound/contracts/ZeroSum.tz â€” ZeroSum marketplace; Imports: Â·; Exports: Â·
zerounbound/contracts/ZeroSum - Copy.txt â€” backup of ZeroSum; Imports: Â·; Exports: Â·
zerounbound/contracts/metadata/views/Zero_Contract_v4_views.json â€” offâ€‘chain views; Imports: Â·; Exports: Â·
zerounbound/contracts/Marketplace/MarketplaceViews/ZeroSum.views.json â€” compiled views for ZeroSum marketplace.
zerounbound/contracts/Marketplace/ZeroSumMarketplace-KT19kipdLiWyBZvP7KWCPdRbDXuEiu3gfjBR.tz â€” deployed marketplace (mainnet); Imports: Â·; Exports: Â·
zerounbound/contracts/Marketplace/NewZeroSumMarketplace-KT19yn9fWP6zTSLPntGyrPwc7JuMHnYxAn1z.tz â€” deployed marketplace (alt); Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_1 entrypoints.txt â€” v1 entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_3 entrypoints.txt â€” v3 entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_V2a entrypoints.txt â€” v2a entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_V2b entrypoints.txt â€” v2b entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_V4 entrypoints.txt â€” v4 entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/EntrypointsReference/Zero_Contract_V4a entrypoints.txt â€” v4a entrypoints; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/v1-KT1R3kYYCâ€¦.tz â€” legacy v1; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/v2a-KT1CdzcHâ€¦.tz â€” legacy v2a; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/v2b-KT1SQuymâ€¦.tz â€” legacy v2b; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/v3-KT1VupZWHâ€¦.tz â€” legacy v3; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/v4a-KT1RnPq7â€¦.tz â€” legacy v4a; Imports: Â·; Exports: Â·
zerounbound/contracts/LegacyZeroContractVersions/Zero_Contract_V4.tz â€” legacy v4 code; Imports: Â·; Exports: Â·
zerounbound/contracts/ContractFactory/KT1H8myPr7EmVPFLmBcnSxgiYigdMKZu3ayw.tz â€” ZeroWorks factory (compiled).
zerounbound/contracts/ContractFactory/CF deployed contract/v4e-KT1SadkkZeeLdzxh3NTGngEzkg6evvSbJn2F.tz â€” reference of deployed v4e via factory.

â•­â”€â”€ publicÂ assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/public/embla-left.svg â€” carousel arrow â¬…; Imports: Â·; Exports: Â·
zerounbound/public/embla-right.svg â€” carousel arrow âž¡; Imports: Â·; Exports: Â·
zerounbound/public/favicon.ico â€” site favicon; Imports: Â·; Exports: Â·
zerounbound/public/manifest.base.json â€” PWA base manifest; Imports: Â·; Exports: Â·
zerounbound/public/manifest.json â€” PWA build manifest; Imports: manifest.base.json; Exports: Â·
zerounbound/public/sw.js â€” WorkboxÂ 7 serviceâ€‘worker; Imports: workboxâ€‘sw; Exports: self.addEventListener
zerounbound/public/fonts/PixeloidMono-d94EV.ttf â€” mono pixel font; Imports: Â·; Exports: Â·
zerounbound/public/fonts/PixeloidSans-mLxMm.ttf â€” sans pixel font; Imports: Â·; Exports: Â·
zerounbound/public/fonts/PixeloidSansBold-PKnYd.ttf â€” bold pixel font; Imports: Â·; Exports: Â·
zerounbound/public/sprites/Banner.png â€” hero banner; Imports: Â·; Exports: Â·
zerounbound/public/sprites/Banner.psd â€” banner PSD; Imports: Â·; Exports: Â·
zerounbound/public/sprites/Burst.svg â€” celebration burst; Imports: Â·; Exports: Â·
zerounbound/public/sprites/cover_default.svg â€” fallback NFT cover; Imports: Â·; Exports: Â·
zerounbound/public/sprites/ghostnet_logo.png â€” Ghostnet logo; Imports: Â·; Exports: Â·
zerounbound/public/sprites/ghostnet_logo.svg â€” Ghostnet logo; Imports: Â·; Exports: Â·
zerounbound/public/sprites/ghostnetBanner.png â€” Ghostnet banner; Imports: Â·; Exports: Â·
zerounbound/public/sprites/loading.svg â€” large loading spinner; Imports: Â·; Exports: Â·
zerounbound/public/sprites/loading16x16.gif â€” 16â€¯px loading GIF; Imports: Â·; Exports: Â·
zerounbound/public/sprites/loading48x48.gif â€” 48â€¯px loading GIF; Imports: Â·; Exports: Â·
zerounbound/public/sprites/logo.png â€” logo raster; Imports: Â·; Exports: Â·
zerounbound/public/sprites/logo.psd â€” logo PSD; Imports: Â·; Exports: Â·
zerounbound/public/sprites/logo.svg â€” Zero logo; Imports: Â·; Exports: Â·

â•­â”€â”€ src/config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/config/deployTarget.js â€” network config & single divergence
  point (I10/I132); defines TARGET (**mainnet** default), NET, RPC lists,
  **TzKT API base** (host without `/v1`; callers normalize or use `tzktBase()`),
  theme/site values, FACTORY_ADDRESS/ES, selectFastestRpc(),
  DOMAIN_CONTRACTS/FALLBACK_RPCS for .tez reverse lookups.

â•­â”€â”€ src/constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/constants/funLines.js â€” rotating overlay quotes; Exports: FUN_LINES
zerounbound/src/constants/integrityBadges.js â€” onâ€‘chain badge map; Exports: INTEGRITY_* helpers
zerounbound/src/constants/mimeTypes.js â€” MIME map + preferredExt('.mp3'); Exports: MIME_TYPES,preferredExt
zerounbound/src/constants/views.hex.js â€” hexâ€‘encoded contract views; Exports: default viewsHex

â•­â”€â”€ src/contexts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/contexts/ThemeContext.js â€” dark/light palette ctx; Imports: react,styledâ€‘components; Exports: ThemeProvider,useTheme
zerounbound/src/contexts/WalletContext.js â€” Beacon wallet context; silent session restore; toolkit init; Imports: React,@taquito/beacon-wallet,TezosToolkit,DEFAULT_NETWORK,chooseFastestRpc; Exports: WalletProvider,useWallet

â•­â”€â”€ src/core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/core/batch.js â€” batch opsÂ (v1â€‘v4); Imports: @taquito/utils,net.js; Exports: forgeBatch,sendBatch,buildAppendTokenMetaCalls,sliceHex,splitPacked
zerounbound/src/core/batchV4a.js â€” v4aâ€‘specific batch ops; Imports: @taquito/taquito; Exports: SLICE_SAFE_BYTES,sliceHex,buildAppendTokenMetaCalls
zerounbound/src/core/feeEstimator.js â€” chunkâ€‘safe fee/burn estimator; Imports: @taquito/taquito; Exports: estimateChunked,calcStorageMutez,toTez
zerounbound/src/core/marketplace.js â€” ZeroSum helpers; Imports: net.js,@taquito/taquito,@taquito/tzip16;  
  **Exports**:  
  â€¢ `getMarketContract`, `fetchListings`, `fetchLowestListing`, `fetchOffers`, `fetchListingDetails`,  
  â€¢ onâ€‘chain view readers: `fetchOnchainListings`, `fetchOnchainOffers`, `fetchOnchainListingDetails`, `fetchOnchainListingsForSeller`, `fetchOnchainOffersForBuyer`, `fetchOnchainListingsForCollection`, `fetchOnchainOffersForCollection`,  
  â€¢ param builders: `buildBuyParams`, `buildListParams`, `buildCancelParams`, `buildAcceptOfferParams`, `buildOfferParams`,  
  â€¢ **preflight**: `getFa2BalanceViaTzkt(account, nftContract, tokenId)`, **`preflightBuy()`** (throws `STALE_LISTING_NO_BALANCE`).
zerounbound/src/core/marketplaceHelper.js â€” collectionâ€‘level listing helpers (TzKT view + bigâ€‘map fallback); Imports: net.js,deployTarget,tzkt.js;  
  **Exports**: `getCollectionListings(nftContract, net)`, `countActiveListingsForCollection(nftContract, tokenIds?, net)` (dedupes per tokenId; viewâ€‘preferred).
zerounbound/src/core/net.js â€” network helpers (jFetch limiter/backâ€‘off, safe fetch), forging; Imports: Parser,@taquito/michelson-encoder,deployTarget; Exports: jFetch,forgeOrigination,injectSigned
zerounbound/src/core/slicing.js â€” canonical head/tail slicer; Imports: @taquito/utils; Exports: planHead,computeOnChainPrefix,cutTail,buildAppendCalls,SLICE_MAX_BYTES,SLICE_MIN_BYTES,PACKED_SAFE_BYTES,HEADROOM_BYTES
zerounbound/src/core/validator.js â€” schema & form validators; Exports: validateContract,validateToken,validateMintFields,validateDeployFields

â•­â”€â”€ src/data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/data/entrypointRegistry.json â€” EP button matrix (v1â†’v4e).
zerounbound/src/data/hashMatrix.json â€” SHAâ€‘1â€¯â†’â€¯version map incl. v4eÂ 2058538150.
zerounbound/src/utils/allowedHashes.js â€” **programmatic allowâ€‘list** accessor built from hashMatrix; Imports: hashMatrix.json; Exports: isAllowed,set,keys

â•­â”€â”€ src/hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/hooks/useConsent.js â€” persistent consent flags + broadcast; Exports: useConsent.
zerounbound/src/hooks/useHeaderHeight.js â€” setsÂ --hdr var; Exports: useHeaderHeight
zerounbound/src/hooks/useViewportUnit.js â€” setsÂ --vh var; Exports: useViewportUnit
zerounbound/src/hooks/useTxEstimate.js â€” gas/fee estimator hook; Exports: useTxEstimate

â•­â”€â”€ src/pagesÂ (Next.js) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/pages/_app.js â€” root providers; Imports: ThemeContext,WalletContext,GlobalStyles; Exports: MyApp
zerounbound/src/pages/_document.js â€” custom document (I20); Imports: next/document; Exports: default
zerounbound/src/pages/index.js â€” landing page; Imports: Layout,CRTFrame; Exports: Home
zerounbound/src/pages/deploy.js â€” collection deployment UI; factory bytes param; full views injection; Exports: default (DeployPage)
zerounbound/src/pages/manage.js â€” manage page; Imports: Layout,AdminTools; Exports: ManagePage
zerounbound/src/pages/terms.js â€” ToS page; Imports: Layout; Exports: TermsPage

â€” explore â€”
zerounbound/src/pages/explore/[[...filter]].jsx â€” dynamic explore grid (admin/contract search, filters); **shared discovery + idbCache**; Exports: Explore
zerounbound/src/pages/explore/secondary.jsx â€” secondary explore route; Imports: React; Exports: SecondaryExplore.
zerounbound/src/pages/explore/listings/index.jsx â€” marketplace listings grid; shows live ZeroSum listings; metadata prefetch; **tzktBase already `/v1`**; never doubleâ€‘append (r7).
zerounbound/src/pages/explore/tokens.jsx â€” **ZeroContract tokens grid** with scanâ€‘ahead minâ€‘yield, accurate totals reconciliation, preview/supply guard, admin filter parity; Exports: ExploreTokens

â€” my â€”
zerounbound/src/pages/my/collections.jsx â€” walletâ€‘scoped grid of all ZeroContracts the user created/admins (v1â†’v4e). Uses discovery + idbCache; allows empty collections; Exports: MyCollections
zerounbound/src/pages/my/listings.jsx â€” user listings view; Imports: React,marketplace helpers; Exports: MyListings
zerounbound/src/pages/my/offers.jsx â€” offers to accept / made; Imports: Tzip16Module,decodeHexFields,marketplace helpers; Exports: MyOffers.
zerounbound/src/pages/my/tokens.jsx â€” minted/owned discovery; liveâ€‘balance filter; decodeHexFields; Exports: MyTokens.

â€” contracts/tokens â€”
zerounbound/src/pages/contracts/[addr].jsx â€” collection detail; Imports: ContractMetaPanelContracts,TokenCard,hazards; Exports: ContractPage
zerounbound/src/pages/tokens/[addr]/[tokenId].jsx â€” token detail; integrates MAINTokenMetaPanel, extrauri viewer with prev/next navigation & hazard overlays; fetches get_extrauris via RPC (tzip16) with TzKT fallback; Exports: TokenDetailPage

â•­â”€â”€ src/styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/styles/globalStyles.js â€” root CSS + scrollbar; Imports: styledâ€‘components,palettes.json; Exports: GlobalStyles
zerounbound/src/styles/palettes.json â€” theme palettes; Imports: Â·; Exports: Â·

â•­â”€â”€ src/uiÂ (shell & components) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/ui/CollectionCard.jsx â€” responsive contract card; accepts string KT1 or object; loads via contractMeta; Imports: hazards,useConsent,RenderMedia; Exports: CollectionCard
zerounbound/src/ui/CRTFrame.jsx â€” CRT screen border; Imports: react; Exports: CRTFrame
zerounbound/src/ui/ExploreNav.jsx â€” sticky explore nav (search + consent toggles); **mandatory on explore/* and my/***; Exports: ExploreNav
zerounbound/src/ui/FiltersPanel.jsx â€” explore filters sidebar; Exports: FiltersPanel
zerounbound/src/ui/Header.jsx â€” top navÂ + network switch; Exports: Header
zerounbound/src/ui/Layout.jsx â€” app shellÂ & scrollâ€‘lock; Exports: Layout
zerounbound/src/ui/LoadingSpinner.jsx â€” 8â€‘bit spinner; Exports: LoadingSpinner
zerounbound/src/ui/PixelButton.jsx â€” pixel artÂ <button>; **adopt transient props for nonâ€‘DOM attrs**; Exports: PixelButton
zerounbound/src/ui/PixelConfirmDialog.jsx â€” confirm modal; Exports: PixelConfirmDialog
zerounbound/src/ui/PixelHeading.jsx â€” pixel art headings; Exports: PixelHeading
zerounbound/src/ui/PixelInput.jsx â€” pixel art inputs; Exports: PixelInput
zerounbound/src/ui/ThemeToggle.jsx â€” palette switch button; Exports: ThemeToggle
zerounbound/src/ui/WalletNotice.jsx â€” wallet status banner; Exports: WalletNotice
zerounbound/src/ui/ZerosBackground.jsx â€” animated zeros field; Exports: ZerosBackground
zerounbound/src/ui/IntegrityBadge.jsx â€” onâ€‘chain integrity badge; Exports: IntegrityBadge
zerounbound/src/ui/MAINTokenMetaPanel.jsx â€” token detail meta panel with extrauri navigation & downloadable MIME links; Imports: RenderMedia, hazards; Exports: MAINTokenMetaPanel

â€” marketplace bars & dialogs â€”
zerounbound/src/ui/BuyDialog.jsx â€” buy modal; Imports: buildBuyParams,preflightBuy; Exports: BuyDialog
zerounbound/src/ui/ListTokenDialog.jsx â€” singleâ€‘sig listing wizard; Imports: marketplace helpers; Exports: ListTokenDialog
zerounbound/src/ui/MakeOfferDialog.jsx â€” offer modal with dynamic method resolution; Exports: MakeOfferDialog
zerounbound/src/ui/MarketplaceBar.jsx â€” token action bar (buy/list/offer); Imports: BuyDialog,ListTokenDialog,MakeOfferDialog; Exports: MarketplaceBar
zerounbound/src/ui/MarketplaceBuyBar.jsx â€” compact buy/list UI for listing cards; Imports: BuyDialog; Exports: MarketplaceBuyBar
zerounbound/src/ui/TokenListingCard.jsx â€” listing grid card; Imports: RenderMedia, MarketplaceBuyBar/MarketplaceBar; Exports: TokenListingCard

â€” discovery & carousels â€”
zerounbound/src/ui/ContractCarousels.jsx â€” creator/admin carousels on Manage page; **uses contractDiscovery + idbCache**; Exports: ContractCarousels

â€” entrypoints & admin â€”
zerounbound/src/ui/AdminTools.jsx â€” dynamic entryâ€‘point modal; Exports: AdminTools
zerounbound/src/ui/OperationConfirmDialog.jsx â€” tx summary dialog; Exports: OperationConfirmDialog
zerounbound/src/ui/OperationOverlay.jsx â€” progress overlay; Exports: OperationOverlay
zerounbound/src/ui/ContractMetaPanel.jsx â€” contract stats; Exports: ContractMetaPanel
zerounbound/src/ui/ContractMetaPanelContracts.jsx â€” banner panel on /contracts; Exports: ContractMetaPanelContracts
zerounbound/src/ui/DeployCollectionForm.jsx â€” collection deploy UI; Exports: DeployCollectionForm
zerounbound/src/ui/FullscreenModal.jsx â€” fullscreen viewer + pixel upscale; Exports: FullscreenModal
zerounbound/src/ui/EnableScripts.jsx â€” scriptâ€‘consent components; Exports: EnableScriptsOverlay,EnableScriptsToggle
zerounbound/src/ui/MakeOfferBtn.jsx â€” XS makeâ€‘offer button; Exports: MakeOfferBtn

â€” Entrypoints (v4 & v4a) â€”
zerounbound/src/ui/Entrypoints/index.js â€” lazy EP resolver; Exports: resolveEp
zerounbound/src/ui/Entrypoints/AcceptOffer.jsx â€” accept marketplace offers; dynamic accept_offer resolution; Exports: AcceptOffer
zerounbound/src/ui/Entrypoints/AddRemoveCollaborator.jsx â€” collab mutator; Exports: AddRemoveCollaborator
zerounbound/src/ui/Entrypoints/AddRemoveCollaboratorsv4a.jsx â€” v4a bulk collab; Exports: AddRemoveCollaboratorsv4a
zerounbound/src/ui/Entrypoints/AddRemoveParentChild.jsx â€” relation manager; Exports: AddRemoveParentChild
zerounbound/src/ui/Entrypoints/AppendArtifactUri.jsx â€” slice uploader (I60); Exports: AppendArtifactUri
zerounbound/src/ui/Entrypoints/AppendExtraUri.jsx â€” extra media uploader; Exports: AppendExtraUri
zerounbound/src/ui/Entrypoints/BalanceOf.jsx â€” balance viewer; Exports: BalanceOf
zerounbound/src/ui/Entrypoints/Burn.jsx â€” burn token; Exports: Burn
zerounbound/src/ui/Entrypoints/BurnV4.jsx â€” burn v4aâ€‘safe; Exports: BurnV4
zerounbound/src/ui/Entrypoints/CancelListing.jsx â€” cancel marketplace listings; paginated table; Exports: CancelListing
zerounbound/src/ui/Entrypoints/CancelOffer.jsx â€” withdraw offers; Exports: CancelOffer
zerounbound/src/ui/Entrypoints/ClearUri.jsx â€” clear artifactUri; Exports: ClearUri
zerounbound/src/ui/Entrypoints/Destroy.jsx â€” destroy contract; Exports: Destroy
zerounbound/src/ui/Entrypoints/EditContractMetadata.jsx â€” contract meta editor; Exports: EditContractMetadata
zerounbound/src/ui/Entrypoints/EditTokenMetadata.jsx â€” token meta editor; Exports: EditTokenMetadata
zerounbound/src/ui/Entrypoints/ManageCollaborators.jsx â€” v3/v4 collab GUI; Exports: ManageCollaborators
zerounbound/src/ui/Entrypoints/ManageCollaboratorsv4a.jsx â€” v4a collab GUI; Exports: ManageCollaboratorsv4a
zerounbound/src/ui/Entrypoints/ManageParentChild.jsx â€” parent/child GUI; Exports: ManageParentChild
zerounbound/src/ui/Entrypoints/Mint.jsx â€” mint NFTs; Exports: Mint
zerounbound/src/ui/Entrypoints/MintPreview.jsx â€” preâ€‘mint gallery; Exports: MintPreview
zerounbound/src/ui/Entrypoints/MintUpload.jsx â€” drag/upload step with onChainValidator; Exports: MintUpload
zerounbound/src/ui/Entrypoints/MintV4a.jsx â€” v4a mint UI; Exports: MintV4a
zerounbound/src/ui/Entrypoints/RepairUri.jsx â€” diff repair; Exports: RepairUri
zerounbound/src/ui/Entrypoints/RepairUriV4a.jsx â€” v4a diff repair; Exports: RepairUriV4a
zerounbound/src/ui/Entrypoints/TokenPreviewWindow.jsx â€” portalâ€‘based draggable preview; Exports: TokenPreviewWindow
zerounbound/src/ui/Entrypoints/Transfer.jsx â€” FA2 transfer; Exports: Transfer
zerounbound/src/ui/Entrypoints/TransferRow.jsx â€” reusable transfer row; Exports: TransferRow
zerounbound/src/ui/Entrypoints/UpdateContractMetadatav4a.jsx â€” v4a contract meta; Exports: UpdateContractMetadatav4a
zerounbound/src/ui/Entrypoints/UpdateOperators.jsx â€” operator set; Exports: UpdateOperators
zerounbound/src/ui/Entrypoints/UpdateTokenMetadatav4a.jsx â€” v4a token meta editor; Exports: UpdateTokenMetadatav4a

â•­â”€â”€ src/utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/utils/chooseFastestRpc.js â€” RPC race chooser (deployTarget selectFastestRpc); Exports: chooseFastestRpc
zerounbound/src/utils/contractDiscovery.js â€” **walletâ€‘centric discovery** (initiator/creator/manager/minted/owned â†’ validate â†’ enrich); Exports: discoverContracts
zerounbound/src/utils/contractMeta.js â€” **contract miniâ€‘fetch** (counts, metadata digest); Exports: fetchContractMeta
zerounbound/src/utils/countAmount.js â€” count editions excluding burns; Exports: countAmount
zerounbound/src/utils/countOwners.js â€” distinct owner counter; Imports: net.js; Exports: countOwners
zerounbound/src/utils/countTokens.js â€” onâ€‘chain token count; Imports: jFetch; Exports: countTokens
zerounbound/src/utils/decodeHexFields.js â€” hexâ†’UTFâ€‘8 deep repair; Exports: default
zerounbound/src/utils/formatAddress.js â€” tz/KT1 truncator + copy; Exports: shortKt,copyToClipboard
zerounbound/src/utils/getLedgerBalanceV2a.cjs â€” v2a ledger fallback; Exports: getLedgerBalanceV2a
zerounbound/src/utils/hazards.js â€” detect nsfw/flashing/script flags; Exports: detectHazards
zerounbound/src/utils/idbCache.js â€” **IndexedDB wrapper with TTL & namespacing**; Exports: idbGet,idbSet,idbDel,idbClear,withTtl
zerounbound/src/utils/listLiveTokenIds.js â€” TzKT id fetcher (TTLÂ 30â€¯s); Exports: listLiveTokenIds
zerounbound/src/utils/marketplaceListings.js â€” **listings aggregator** (active collections, bigmap fetchers, onâ€‘chain view readers); Exports: listings helpers.  
  (The listings page derives the TzKT base via `tzktBase(net)`; r7 explicitly warns to **not** append `/v1` twice.)
zerounbound/src/utils/onChainValidator.js â€” fast FOC heuristic (I99); Exports: checkOnChainIntegrity
zerounbound/src/utils/pixelUpscale.js â€” css helpers for pixelâ€‘art upscaling; Exports: pixelUpscaleStyle
zerounbound/src/utils/RenderMedia.jsx â€” dataâ€‘URI media viewer; Exports: RenderMedia
zerounbound/src/utils/resolveTezosDomain.js â€” reverse resolver; imports DOMAIN_CONTRACTS/FALLBACK_RPCS; Exports: resolveTezosDomain
zerounbound/src/utils/sliceCache.js â€” IndexedDB-only slice checkpoint cache (migrates legacy localStorage); Exports: saveSliceCheckpoint,loadSliceCheckpoint,clearSliceCheckpoint,purgeExpiredSliceCache
zerounbound/src/utils/sliceCacheV4a.js â€” v4a slice cache (IndexedDB); Exports: saveSliceCheckpoint,loadSliceCheckpoint,clearSliceCheckpoint,purgeExpiredSliceCache,strHash
zerounbound/src/utils/toNat.js â€” addressâ†’nat util; Exports: toNat
zerounbound/src/utils/uriHelpers.js â€” dataâ€‘URI helpers; Exports: URI_KEY_REGEX,listUriKeys,mimeFromDataUri,isValidDataUri,isLikelySvg,ensureDataUri
zerounbound/src/utils/useIsoLayoutEffect.js â€” SSRâ€‘safe layout effect; Exports: useIsoLayoutEffect
zerounbound/src/utils/useWheelTunnel.js â€” wheel event tunnel (I64); Exports: useWheelTunnel

â•­â”€â”€ src/workers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/src/workers/originate.worker.js â€” webâ€‘worker origination; Imports: @taquito/taquito,net.js; Exports: onmessage

â•­â”€â”€ summarized_filesÂ (bundle drops) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
zerounbound/summarized_files/contracts_bundle.txt â€” Michelson sources + views; Imports: Â·; Exports: Â·
zerounbound/summarized_files/assets_bundle.txt â€” fonts, sprites, sw.js; Imports: Â·; Exports: Â·
zerounbound/summarized_files/engine_bundle.txt â€” Node/core dump; Imports: Â·; Exports: Â·
zerounbound/summarized_files/frontend_bundle.txt â€” UI dump; Imports: Â·; Exports: Â·
zerounbound/summarized_files/infra_bundle.txt â€” infra dump; Imports: Â·; Exports: Â·
zerounbound/summarized_files/master_bundle.txt â€” contains everything in all the above bundles
zerounbound/summarized_files/render_media_bundle.txt â€” mediaâ€‘centric UI modules
zerounbound/summarized_files/explore_bundle.txt â€” explore pages, listings utils, dialogs and helpers + **discovery/idb**  
  (r7: tzktBase includes `/v1`; do not append.)

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
5 Â· BUNDLE INDEX (How to read) â€” each textâ€‘dump lives in summarized_files/
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
contracts_bundle.txtâ€ƒâ†’ Michelson sources + views  
assets_bundle.txtâ€ƒâ€ƒâ†’ fonts, sprites, sw.js  
engine_bundle.txtâ€ƒâ€ƒâ†’ scripts/, core/, data/, config/, constants/, utils/  
frontend_bundle.txtâ€ƒâ†’ contexts/, hooks/, ui/, pages/, styles/  
infra_bundle.txtâ€ƒâ€ƒ â†’ root configs, next.config.js, package.json, CI helpers  
master_bundle.txtâ€ƒâ€ƒâ†’ contains everything in all the above bundles  
render_media_bundle.txt â†’ mediaâ€‘centric UI modules  
explore_bundle.txt â†’ explore + marketplace listings/dialogs/helpers **and discovery/idb**

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
6 Â· QUICKâ€‘STARTÂ &Â CIÂ PIPELINE
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
corepack enable && corepack prepare yarn@4.9.1 --activate  
yarn install

###Â OpenAIÂ Codex setup script
Codex pulls scripts/codex-setup.sh automatically:

#!/usr/bin/env bash
corepack enable
corepack prepare yarn@4.9.1 --activate
yarn install --immutable --inline-builds
###Â Vercel

ProjectÂ Â Â Â Â  Â BuildÂ CommandÂ Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â Â  Â Domains
ghostnetÂ Â Â Â  Â yarnÂ set:ghostnetÂ &&Â yarnÂ buildÂ Â Â Â Â Â Â ghostnet.zerounbound.art
mainnetÂ Â Â Â Â  Â yarnÂ set:mainnetÂ Â &&Â yarnÂ buildÂ Â Â Â Â Â Â zerounbound.art,Â www.*

Local development
â€¢ Default target: mainnet (I132). deployTarget.js must export const TARGET='mainnet'.
â€¢ To switch network locally:

yarn set:ghostnet   # writes TARGET='ghostnet'
yarn dev:current    # runs on the selected target/port without resetting TARGET
# To return to mainnet:
yarn set:mainnet && yarn dev:current
â€¢ Clearing the IndexedDB discovery cache may be necessary after network
switches to prevent stale data (see src/utils/idbCache.js). Prefer a targeted
cache clear (keyâ€‘space: zu:disc:<network>:<address>).

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
7 Â· APPENDICES (HowÂ toÂ read) â€” machineâ€‘readables live inÂ code
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
A.Â hashMatrix.json â€” typeHashes used to label contract versions
and ensure backâ€‘compat across loaders and UIs; includes v4e hash
2058538150 â†’ "v4e".
B.Â entrypointRegistry.json â€” canonical entrypoints per version,
including v4e as an $extends of v4 where applicable.
C.Â allowedHashes.js â€” programmatic accessor over A; appendâ€‘only.
D. ZeroContract Version Map:
v1 â€” original zerocontract
v2 series â€” community â€œhomebrewsâ€; v2b = â€œoriginal without lock adding parent/childâ€
v3 â€” first collaborator contract
v4 â€” legacy append contract (our append_* and edit_* entrypoints)
v4a â€” zeroterminal main contract (ZT entrypoints, different names/order)
v4b â€” sifrzero (default collaborative, like HEN collection; no add/remove_collaborator, anyone can mint)
v4c â€” zeroterminal default collaborative
v4d â€” zeroterminal updated with add collaborators
v4e â€” current grail, canonical deployable contract on zerounbound.art (extends v4 where applicable)

Entrypoint differences (canonical, from our registry):
v1/v3/v4 mint(nat, map(string,bytes), address); v2a/v2b mint(map(string,bytes), address); v4a/v4d (ZT) mint(address, nat, map(string,bytes)). v4e extends v4. Using these signatures is required; do not mix ZTâ€™s append_token_metadata/update_token_metadata with our append_artifact_uri/edit_token_metadata.

Who can mint <32,768 bytes vs >32,768 bytes (multisig batching + diffâ€‘aware repairs/retries):

Our v4 / v4e: support chunked appends via append_artifact_uri and edit_token_metadata. These are the contracts we batch and repair automatically (multisigâ€‘safe, retryable).

ZT v4a/v4c/v4d: use different entrypoints (append_token_metadata, update_token_metadata). In our UI, v4a UX opens Zeroterminalâ€”we do not run our append/repair pipeline on ZT contracts to avoid mangling parameters.

Why the delineation matters: AdminTools introspects the typeHash â†’ version to choose the correct UX component and entrypoint names/argument order. We gate discoverability and version badges using hashMatrix.json + allowedHashes.js, and we pick perâ€‘version entrypoints directly from entrypointRegistry.json. This is what prevents calling, e.g., append_artifact_uri on a ZT v4a (which would 100% â€œcodexâ€‘wreckâ€ metadata).
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CHANGELOG

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
r1187 â€” Consolidate Share appendix; enforce liveâ€‘supply semantics across explore/collections, explore/tokens, contract page, and cards; add invariants I200â€“I221; ASCII cleanup in CancelListing.
r1186 â€” Share system overhaul: global share bus; scopeâ€‘aware ShareDialog; collection/listing SHARE buttons; handle resolver API; docs updated.
r1185 â€” Token detail page fetches get_extrauris via RPC (tzip16) with TzKT fallback, removing Better Call Dev dependency.
r1184 â€” Add extrauri viewer with navigation and downloadable MIME links on token detail page.
r1183 â€” Introduce canonical slicer, migrate slice checkpoints to IndexedDB only, add dataâ€‘URI tests.
r1182 â€” Document marketplace dialogs (Buy/List/MakeOffer) and
Accept/Cancel entrypoints; extend manifest coverage for completeness.
r1181 â€” Add Explore/Tokens documentation (scanâ€‘ahead minâ€‘yield pagination,
accurate totals reconciliation, preview/supply gating), clarify TzKT `/v1`
normalization, reaffirm listings staleâ€‘listing guard & transientâ€‘prop rule.

r1180 â€” Add ZeroSum staleâ€‘listing guard based on TzKT balances,
enforce /v1 base normalization, codify transientâ€‘prop rule, reaffirm noâ€‘sentinel.

/* What changed & why: Token page now calls get_extrauris via RPC (tzip16) with TzKT fallback, removing BCD dependency; appended changelog. */

-------------------------------------------------------------------------------
ADDENDUM r1188 — Static Explore Feed, Hybrid Loader, CI, and Invariants
-------------------------------------------------------------------------------

A. New Files & Paths

- Generator:
  - scripts/exploreFeed.mjs — builds a static Explore feed under feed-dist/<network>/ with:
    - meta.json: { network, pageSize, pages, total, lastUpdated }
    - page-N.json: arrays of accepted tokens (contract, tokenId, metadata, holdersCount)

- GitHub Actions Workflow:
  - .github/workflows/explore-feed.yml — Detects repo root (./ or ./zerounbound), runs generator for mainnet and ghostnet, writes to feed-dist (root), adds .nojekyll, uploads artifact, deploys to GitHub Pages.

- Serverless Proxies (CORS-safe; no env vars):
  - src/pages/api/explore/static/[net]/[page].js → proxies FEED_STATIC_BASE/<net>/page-<page>.json
  - src/pages/api/explore/static/[net]/meta.js → proxies FEED_STATIC_BASE/<net>/meta.json

- Client Integration:
  - src/pages/explore/tokens.jsx — prefers the static feed via proxy; hybrid overlay (merge live /api/explore/feed burst + static slice) for pages 0..1; meta-aware paging to avoid 404 loops; hasRenderablePreview accepts data: and tezos-storage: URIs; always-visible pagination control; single-request bursts.

- Config (identical across branches):
  - src/config/deployTarget.js — exports FEED_STATIC_BASE (Pages root) and FEED_PAGE_SIZE (must match generator --page-size). TARGET remains the only diverging constant across branches.

B. Generator Semantics

- Source: TzKT /v1 tokens endpoint with contract.typeHash.in over all ZeroContract versions (v1, v2a, v2b, v3, v4, v4a, v4b, v4c, v4d, v4e) from src/data/hashMatrix.json.
- Acceptance:
  - decodeHexFields() before checks
  - hasRenderablePreview accepts data: and tezos-storage: URIs
  - Burn filter (fast/correct): For tokens with holdersCount==1, query balances for tz1burnburnburnburnburnburnburjAYjjX; exclude if that is the only holder.
- Performance knobs (CI defaults): RAW_STEP=360; HARD_TIME≈180s for dense page-0; Page size=100; Max pages=120 (mainnet)/60 (ghostnet).

C. Client Loader — Rules

- Preference: static via proxy → hybrid overlay for pages 0..1 → live /api/explore/feed bursts → direct TzKT (rare fallback). One request per burst.
- Meta awareness: fetch /api/explore/static/<net>/meta once; if next static page index is beyond coverage, use live burst and mark end when empty (no infinite spinner; no 404 loops).
- UX: “Load More” always rendered in generic mode; spinner while fetching; “No more” only when end=true.

D. Invariants (Append-only)

I100 [F] Static Explore feed lives under FEED_STATIC_BASE/<net>/page-N.json and meta.json.
I101 [E] Pages deploy via GitHub Actions; deployTarget.js is the only diverging file.
I102 [F] FEED_PAGE_SIZE is authoritative across branches; matches generator --page-size.
I103 [F] hasRenderablePreview accepts data: and tezos-storage: URIs (no IPFS).
I104 [F,E] Burn filter excludes tokens whose ONLY holder is the burn address; multi-holder tokens remain.
I105 [E] Client fetches /api/explore/static/<net>/meta to avoid paging past static coverage.
I106 [F] Explore loader uses one request per burst; first two pages merge live + static and de-duplicate by `${contract}:${tokenId}`.
I107 [F] Pagination control is always visible (generic mode); disabled only during fetch or end=true.
I108 [F] Offsets advance by raw pages scanned; client dedupe enforced before commit.
I109 [E] Generator RAW_STEP/HARD_TIME tuned for dense page-0; adjustable without API signature changes.
I110 [E] No app env vars; FEED_STATIC_BASE comes from deployTarget.js.

E. Operations

- Enable Actions (repo): Settings→Actions→Allow all actions; Workflow permissions: Read & write.
- Pages: Settings→Pages→Source=GitHub Actions.
- Run workflow; verify:
  - https://jams2blues.github.io/zerounbound/mainnet/meta.json
  - https://jams2blues.github.io/zerounbound/mainnet/page-0.json
  - https://jams2blues.github.io/zerounbound/ghostnet/meta.json
- Adjust cadence: cron '*/5 * * * *' for 5-min updates; increase coverage via --page-size/--max-pages.

F. Change Log (r1188)

- Added static Explore feed generator and CI workflow publishing to GitHub Pages.
- Implemented serverless static proxies and hybrid top-of-feed loader.
- Broadened preview acceptance (data:+ tezos-storage:), aligned generator & client.
- Eliminated 404 loops via meta-aware paging; “Load More” always visible.
- Preserved branch invariant: deployTarget.js is the only diverging file.
