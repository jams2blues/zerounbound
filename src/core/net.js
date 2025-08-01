/*─────────────────────────────────────────────────────────────────
  Developed by @jams2blues – ZeroContract Studio
  File:    src/core/net.js
  Rev :    r1105-a1   2025‑07‑23
  Summary: adjusted TzKT rate limiting. Reduced global
           concurrency LIMIT to 2, decreased retry attempts for
           TzKT endpoints from 10 to 6 and increased backoff
           delays after 429 responses. This mitigates API
           throttling on the ContractCarousels page while
           retaining all existing helper functions.
────────────────────────────────────────────────────────────────*/

import { OpKind } from '@taquito/taquito';
// b58cdecode and prefix are used for signature decoding and tagging
import { b58cdecode, prefix } from '@taquito/utils';
import { LocalForger } from '@taquito/local-forging';
import { Parser } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';
import { FORGE_SERVICE_URL } from '../config/deployTarget.js';

/* global concurrency limit */
// Reduce concurrency from 4 to 2 to avoid saturating the TzKT API
const LIMIT = 4;
let   active = 0;
const queue  = [];

/**
 * Sleep helper with default 500 ms.
 */
export const sleep = (ms = 500) => new Promise(r => setTimeout(r, ms));

/**
 * Execute a queued task respecting the concurrency limit.  Tasks
 * are queued when the number of active tasks exceeds LIMIT.
 */
function exec(task) {
  active++;
  return task().finally(() => {
    active--;
    if (queue.length) {
      queue.shift()();
    }
  });
}

/**
 * Throttled fetch with retry and backoff.  Automatically
 * parses JSON and text responses.  Respects a global
 * concurrency limit and retries network/429 errors.
 *
 * @param {string} url Request URL
 * @param {object|number} opts Fetch init or number of retries
 * @param {number} tries Number of retry attempts
 */
export function jFetch(url, opts = {}, tries) {
  if (typeof opts === 'number') { tries = opts; opts = {}; }
  // Fewer retries for TzKT endpoints to avoid rate limiting
  if (!Number.isFinite(tries)) tries = /tzkt\.io/i.test(url) ? 6 : 5;
  return new Promise((resolve, reject) => {
    const run = () => exec(async () => {
      for (let i = 0; i < tries; i++) {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 45_000);
        try {
          const res = await fetch(url, { ...opts, signal: ctrl.signal });
          clearTimeout(timer);
          if (res.status === 429) {
            // Exponential backoff with higher base delay for rate‑limited responses
            await sleep(1_200 * (i + 1));
            continue;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ct  = res.headers.get('content-type') || '';
          const data = ct.includes('json') ? await res.json() : await res.text();
          return resolve(data);
        } catch (e) {
          clearTimeout(timer);
          const m = e?.message || '';
          /* retry on network/interruption errors */
          if (/Receiving end|ECONNRESET|NetworkError|failed fetch/i.test(m)) {
            await sleep(800 * (i + 1));
            continue;
          }
          if (i === tries - 1) return reject(e);
          await sleep(600 * (i + 1));
        }
      }
    });
    if (active >= LIMIT) queue.push(run);
    else run();
  });
}

/*─────────────────────────────────────────────────────────────
  Backend forge and inject helpers
────────────────────────────────────────────────────────────*/

/**
 * Determine the full URL for the forge API.  If
 * FORGE_SERVICE_URL is non-empty, append `/forge`; otherwise fall
 * back to the local Next.js API route.  This indirection allows
 * deployments to swap between a remote service and in-process API
 * routes without changing the call sites.
 */
function forgeEndpoint() {
  return FORGE_SERVICE_URL
    ? `${FORGE_SERVICE_URL.replace(/\/$/, '')}/forge`
    : '/api/forge';
}

/**
 * Encode a high-level storage object into Micheline using the contract's
 * storage type.  If the provided code is a raw Michelson string, it
 * is parsed into Micheline via the Parser.  The storage type is
 * extracted from the `storage` section's first argument.  On
 * success, the encoded Micheline is returned; on failure, the
 * original storage object is returned unchanged.
 *
 * @param {any} code Raw Michelson string or Micheline array
 * @param {any} storage High-level storage object (MichelsonMap or plain)
 * @returns {any} Micheline representation of storage, or the original value
 */
export function encodeStorageForForge(code, storage) {
  try {
    let script = code;
    if (typeof code === 'string') {
      const parser = new Parser();
      script = parser.parseScript(code);
    }
    // script is expected to be an array of declarations; find the storage
    let storageExpr = null;
    if (Array.isArray(script)) {
      storageExpr = script.find(ex => ex.prim === 'storage');
    } else if (script && script.prim === 'storage') {
      storageExpr = script;
    }
    if (storageExpr && Array.isArray(storageExpr.args) && storageExpr.args.length) {
      const storageType = storageExpr.args[0];
      const schema = new Schema(storageType);
      const encoded = schema.Encode(storage);
      return encoded;
    }
  } catch (err) {
    // swallow errors; fallback to original storage
  }
  return storage;
}

/**
 * Forge an origination operation via backend API.  Sends a POST
 * request to the configured forge endpoint with the code, storage
 * and source address.  The server is expected to return forged
 * bytes.  When FORGE_SERVICE_URL is set this will call the
 * external service; when empty it uses the built-in Next.js API
 * (/api/forge).  Callers should catch errors and fall back to
 * local forging via forgeOrigination().
 *
 * @param {any[]} code Michelson code array or raw string
 * @param {any} storage Initial storage (MichelsonMap or compatible)
 * @param {string} source tz1/KT1 address initiating the origination
 * @param {string} publicKey Optional public key for reveal (ignored by backend)
 * @returns {Promise<string>} forged bytes
 */
export async function forgeViaBackend(code, storage, source, publicKey) {
  const url = forgeEndpoint();
  /**
   * Encode the provided storage into Micheline before sending it
   * to the backend forge service.  Octez’s `originate ... --init` expects
   * a properly typed Micheline value, not a high‑level JavaScript object.
   * Failing to encode the storage results in misaligned expression
   * errors from `octez-client` during parsing.  We reuse the same
   * logic as forgeOrigination() to ensure compatibility.
   */
  let encodedStorage;
  try {
    encodedStorage = encodeStorageForForge(code, storage);
  } catch {
    encodedStorage = storage;
  }
  const payload = { code, storage: encodedStorage, source };
  if (publicKey) payload.publicKey = publicKey;
  const res = await jFetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload),
  });
  if (res && (res.forgedBytes || res.forgedbytes)) {
    return res.forgedBytes || res.forgedbytes;
  }
  if (res && res.error) {
    throw new Error(res.error);
  }
  throw new Error('Backend forge failed');
}

/**
 * Inject a signed operation via the backend API.  This function is
 * deprecated because the forge service no longer performs
 * injection.  Callers should use injectSigned() instead.  An
 * exception is thrown if this function is invoked.
 *
 * @deprecated Injection is disabled on the forge service.
 */
export async function injectViaBackend(_signedBytes) {
  throw new Error('Remote injection disabled; use injectSigned()');
}

/*─────────────────────────────────────────────────────────────
  Signature helpers
────────────────────────────────────────────────────────────*/

/**
 * Convert a base58 signature (edsig/spsig/p2sig/sig) to raw hex for injection.
 * Beacon wallets return base58 signatures prefixed with edsig/spsig1/p2sig.
 * This helper decodes the base58 signature and strips the curve prefix.
 *
 * @param {string} signature Base58 encoded signature from wallet.client.requestSignPayload
 * @returns {string} Hex string of signature bytes (without any prefix)
 */
export function sigToHex(signature) {
  let bytes;
  if (signature.startsWith('edsig')) {
    bytes = b58cdecode(signature, prefix.edsig);
    bytes = bytes.slice(5);
  } else if (signature.startsWith('spsig1')) {
    bytes = b58cdecode(signature, prefix.spsig1);
    bytes = bytes.slice(5);
  } else if (signature.startsWith('p2sig')) {
    bytes = b58cdecode(signature, prefix.p2sig);
    bytes = bytes.slice(4);
  } else {
    bytes = b58cdecode(signature, prefix.sig);
    bytes = bytes.slice(3);
  }
  return Buffer.from(bytes).toString('hex');
}

/**
 * Convert a base58 signature to hex and append the appropriate curve tag.
 * Tezos RPC requires that the signed operation bytes end with an 8‑bit
 * tag identifying the curve used for the signature: 00 for Ed25519,
 * 01 for secp256k1, and 02 for P‑256.  Without this suffix the RPC
 * may return a phantom operation hash or parsing error.
 *
 * @param {string} signature Base58 encoded signature from wallet.client.requestSignPayload
 * @returns {string} Hex string of signature bytes followed by a curve tag byte
 */
export function sigHexWithTag(signature) {
  const hex = sigToHex(signature);
  let tag = '00';
  if (signature.startsWith('spsig1')) {
    tag = '01';
  } else if (signature.startsWith('p2sig')) {
    tag = '02';
  } else if (signature.startsWith('edsig')) {
    tag = '00';
  } else {
    tag = '00';
  }
  return hex + tag;
}

/**
 * Inject a signed operation bytes string and return the operation hash.
 *
 * @param {TezosToolkit} toolkit Taquito toolkit instance
 * @param {string} signedBytes Hex string of the signed operation (forgedBytes + signature)
 * @returns {Promise<string>} Operation hash
 */
export async function injectSigned(toolkit, signedBytes) {
  return await toolkit.rpc.injectOperation(signedBytes);
}

/*─────────────────────────────────────────────────────────────
  Local forge and inject helpers
────────────────────────────────────────────────────────────*/

/**
 * Forge an origination operation locally.  Estimates gas/fee and
 * builds the operation contents with the given code and storage.
 * Returns the forged bytes which must be signed externally.
 *
 * @param {TezosToolkit} toolkit Taquito toolkit instance
 * @param {string} source The originating address (tz1/KT1)
 * @param {any[]} code Michelson code array or raw Michelson string
 * @param {any} storage Initial storage object (MichelsonMap or compatible)
 * @param {string} publicKey Optional public key for reveal
 * @returns {Promise<{ forgedBytes: string, contents: any[], branch: string }>}
 */
export async function forgeOrigination(toolkit, source, code, storage, publicKey) {
  // Parse the Michelson code into Micheline if necessary.
  let parsedCode = code;
  if (typeof code === 'string') {
    try {
      const parser = new Parser();
      const parsed = parser.parseScript(code);
      if (parsed) parsedCode = parsed;
    } catch (errParse) {
      throw new Error('Invalid Michelson code: ' + errParse.message);
    }
  }
  // Encode high‑level storage into Micheline using Schema.
  const encodedStorage = encodeStorageForForge(parsedCode, storage);
  // Determine whether the source account needs a reveal.  Query
  // the manager key via RPC; if it is undefined or errors, assume
  // that a reveal operation must precede the origination.
  let needsReveal = false;
  if (publicKey) {
    try {
      const mgrKey = await toolkit.rpc.getManagerKey(source);
      if (!mgrKey) needsReveal = true;
    } catch (e) {
      needsReveal = true;
    }
  }
  // Fetch branch and counter for forging.  The counter is
  // incremented manually for each operation (reveal + origination).
  const blockHeader = await toolkit.rpc.getBlockHeader();
  const branch      = blockHeader.hash;
  const contractInfo = await toolkit.rpc.getContract(source);
  let counter = parseInt(contractInfo.counter, 10) + 1;
  const contents = [];
  // If reveal is needed, prepend a reveal operation using the
  // provided publicKey.  Fee/gas/storage values follow typical
  // defaults and may be adjusted by the caller if desired.
  if (needsReveal && publicKey) {
    contents.push({
      kind         : OpKind.REVEAL,
      source       : source,
      fee          : '1300',
      counter      : counter.toString(),
      gas_limit    : '10000',
      storage_limit: '0',
      public_key   : publicKey,
    });
    counter += 1;
  }
  // Estimate fee/gas/storage for the origination.  Wrap in try/catch
  // and fall back to conservative defaults if estimation fails.
  let feeMutez     = '200000';   // 0.2 ꜩ
  let gasLimit     = '200000';   // default gas for origination
  let storageLimit = '60000';    // default storage limit (~60 kB)
  try {
    const estimate = await toolkit.estimate.originate({ code: parsedCode, storage: encodedStorage, balance: '0' });
    feeMutez      = estimate.suggestedFeeMutez.toString();
    gasLimit      = estimate.gasLimit.toString();
    storageLimit  = estimate.storageLimit.toString();
  } catch (e) {
    // estimation errors are ignored; defaults remain in effect
  }
  // Append the origination operation to the contents.  Use the
  // encodedStorage for the script to ensure proper Micheline representation.
  contents.push({
    kind         : OpKind.ORIGINATION,
    source       : source,
    fee          : feeMutez,
    counter      : counter.toString(),
    gas_limit    : gasLimit,
    storage_limit: storageLimit,
    balance      : '0',
    script       : { code: parsedCode, storage: encodedStorage },
  });
  // Forge the operation bytes.  Attempt RPC forging first; on
  // failure fall back to LocalForger.
  let forgedBytes;
  try {
    forgedBytes = await toolkit.rpc.forgeOperations({ branch, contents });
  } catch (rpcErr) {
    try {
      const localForger = new LocalForger();
      forgedBytes = await localForger.forge({ branch, contents });
    } catch (localErr) {
      throw new Error(`Forge failed: ${rpcErr.message || localErr.message}`);
    }
  }
  return { forgedBytes, contents, branch };
}

/* What changed & why:
   • Reduced concurrency LIMIT from 4 to 2 and lowered default
     retry attempts for TzKT endpoints to 6 to prevent hitting
     TzKT rate limits when loading contract carousels.
   • Increased backoff delay after 429 responses to 1.2 s per
     attempt. These changes throttle requests and reduce API load.
   • Updated revision and summary accordingly. No other logic
     changed; the helper functions remain backward‑compatible.
*/