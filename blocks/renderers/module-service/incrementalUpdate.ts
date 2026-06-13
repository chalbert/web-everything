/**
 * @file blocks/renderers/module-service/incrementalUpdate.ts
 * @description Incremental / delta module updates — backlog #103, built on the #087/#088 MaaS
 *   distribution + versioning contract.
 *
 * A shared MaaS bundle (#081/#087) can change many times a day. #088 makes each version's URL
 * content-addressed and `immutable`, so a URL caches forever — but a frequently-changing bundle still
 * mints a *new* immutable URL each change, and a naive client re-downloads the whole thing. This module
 * is the complementary lever: move a cached client from `fromHash` to `toHash` by fetching a **delta**
 * (a patch from the previous version) and applying it locally — the unchanged ~95% never crosses the
 * wire — falling back to a full download whenever a patch is unavailable or fails integrity.
 *
 * **Web Everything owns the contract + the invariant, not the diff algorithm.** Per the #103 design
 * notes (native-first / don't-reinvent-the-wheel) the binary-diff `apply` is **injected** — a real
 * deployment supplies bsdiff / VCDIFF / a Worker codec; WE never ships a diff implementation. Likewise
 * the patch/full *sources* (the Cache API + a service worker + the origin) and the previous bytes are
 * injected, so this core is pure, framework-free, and runs identically in a service worker, a test, or
 * Node. What WE does own — and what makes the feature safe — is the **orchestration**:
 *   1. patch is resolved **on demand**, keyed on `(fromHash → toHash)` (the recommended default — no
 *      eager per-version-pair pre-computation at the origin);
 *   2. the patched result is **integrity-verified against `toHash`** (the #088 content-address = SRI),
 *      and on *any* mismatch is discarded and the full module fetched — a corrupt patch can never be
 *      installed;
 *   3. a full download is always integrity-verified too, and is the path taken when there is no cached
 *      previous, no patch, or a failed patch.
 *
 * Only Web standards used directly (`crypto.subtle`, `Uint8Array`); everything stateful is injected.
 */

/** A content-addressed module version id — `sha256-<base64>`, the #088 identity = SRI integrity value. */
export type ContentHash = string;

/** The essay's two delivery shapes: a `patch` applied on top of the previous, or a `full` replacement. */
export type DeliveryShape = 'patch' | 'full';

// ── Injected primitives — the impl-swappable seams (#103 native-first) ───────────────────────────

/**
 * Apply a binary patch to the previous module bytes, yielding the new module. **Injected** so WE does
 * not reinvent binary diff — a deployment plugs in bsdiff/VCDIFF/etc. Must be the exact inverse of
 * whatever produced the patch; WE verifies the *result*, never trusts the algorithm.
 */
export type ApplyPatch = (previous: Uint8Array, patch: Uint8Array) => Uint8Array | Promise<Uint8Array>;

/**
 * Resolve the on-demand patch that moves `fromHash → toHash`, or `null` when none is available (the
 * origin has not computed this pair, or declines to). `null` ⇒ the orchestrator falls back to full.
 */
export type ResolvePatch = (fromHash: ContentHash, toHash: ContentHash) => Promise<Uint8Array | null>;

/** Resolve the full module bytes for `toHash` — the fallback path and the no-previous path. */
export type ResolveFull = (toHash: ContentHash) => Promise<Uint8Array>;

/** Content-hash bytes into the `sha256-<base64>` identity to verify against. Defaults to {@link sha256OfBytes}. */
export type HashBytes = (bytes: Uint8Array) => Promise<ContentHash>;

// ── Delivery-shape decision (patch vs full) ──────────────────────────────────────────────────────

export interface DeliveryDecisionInput {
  /** Size in bytes of the full new module. */
  readonly fullSize: number;
  /** Size in bytes of the patch from the previous version. */
  readonly patchSize: number;
  /**
   * A patch is only worth it below this fraction of the full size (default `0.5`). Above it, the bytes
   * saved don't justify the apply + double-buffer cost, so ship the full module. Drive this from the
   * changelog manifest (#102), which already knows which modules changed and by how much.
   */
  readonly threshold?: number;
}

/**
 * Decide {@link DeliveryShape}: `patch` when the patch is smaller than `threshold × fullSize`, else
 * `full`. A non-positive `fullSize` (unknown) is always `full` — never patch blind.
 */
export function chooseDeliveryShape({ fullSize, patchSize, threshold = 0.5 }: DeliveryDecisionInput): DeliveryShape {
  if (fullSize <= 0) return 'full';
  return patchSize < fullSize * threshold ? 'patch' : 'full';
}

// ── Default integrity hasher (`sha256-<base64>`, matching #088 / the fetch origin) ───────────────

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** `sha256-<base64>` over `bytes` — the #088 content-address / SRI integrity value the origin emits. */
export async function sha256OfBytes(bytes: Uint8Array): Promise<ContentHash> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256-${toBase64(new Uint8Array(digest))}`;
}

// ── The orchestration — try patch (on-demand, verified), fall back to full ───────────────────────

export interface IncrementalUpdateOptions {
  /** The cached previous version's content hash, or `null` when there is no cached previous. */
  readonly fromHash: ContentHash | null;
  /** The target version's content hash (#088) — the integrity check every path must satisfy. */
  readonly toHash: ContentHash;
  /** The cached previous module bytes (from the Cache API), or `null`. */
  readonly previous: Uint8Array | null;
  readonly resolvePatch: ResolvePatch;
  readonly resolveFull: ResolveFull;
  readonly applyPatch: ApplyPatch;
  /** Override the integrity hasher (tests, or a non-SHA-256 scheme). Defaults to {@link sha256OfBytes}. */
  readonly hashBytes?: HashBytes;
}

export interface IncrementalUpdateResult {
  /** The new module bytes — guaranteed to hash to `toHash`. */
  readonly bytes: Uint8Array;
  /** How the bytes were obtained. */
  readonly shape: DeliveryShape;
  /** A patch was attempted but failed (unavailable or integrity) and a full download was used instead. */
  readonly fellBackToFull: boolean;
}

/** Thrown when even the full module fails its integrity check — the version cannot be trusted. */
export class IntegrityError extends Error {
  constructor(expected: ContentHash, got: ContentHash) {
    super(`MaaS incremental update: full module hash ${got} does not match target ${expected}`);
    this.name = 'IntegrityError';
  }
}

/**
 * Move a cached client from `fromHash` to `toHash`. Tries an on-demand patch first (when a cached
 * previous + its hash are present), verifies the patched result against `toHash`, and on any
 * unavailability or mismatch falls back to a full, also-verified download. The returned bytes always
 * hash to `toHash`; a `full` download that fails integrity throws {@link IntegrityError} (the origin is
 * serving a corrupt artifact — there is nothing safe to install).
 */
export async function applyIncrementalUpdate(opts: IncrementalUpdateOptions): Promise<IncrementalUpdateResult> {
  const hash = opts.hashBytes ?? sha256OfBytes;
  let patchAttempted = false;

  // Patch path: only when we actually have a cached previous to apply onto.
  if (opts.previous && opts.fromHash) {
    const patch = await opts.resolvePatch(opts.fromHash, opts.toHash);
    if (patch) {
      patchAttempted = true;
      const patched = await opts.applyPatch(opts.previous, patch);
      if ((await hash(patched)) === opts.toHash) {
        return { bytes: patched, shape: 'patch', fellBackToFull: false };
      }
      // Integrity mismatch — discard the patched result; the full download below is the safe path.
    }
  }

  // Full path: the fallback, the no-previous path, and the no-patch path. Always verified.
  const full = await opts.resolveFull(opts.toHash);
  const got = await hash(full);
  if (got !== opts.toHash) throw new IntegrityError(opts.toHash, got);
  return { bytes: full, shape: 'full', fellBackToFull: patchAttempted };
}
