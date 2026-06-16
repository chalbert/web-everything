/**
 * Trait chunks on the MaaS served path (#719) — the integration that brings the
 * code-split trait chunks onto the #461 MaaS distribution origin so a
 * **framework-agnostic** consumer (no Vite, no bundler) can pull only the traits
 * a component binds, over HTTP.
 *
 * It reuses the substrate already built rather than forking it:
 *   - **#505 serve-path IR** (`./servePathIR`): a trait chunk is just another
 *     `<name>[@<pin>].js` artifact, so it rides the **same** `SERVE_PATH.route`
 *     and the **same** `CACHE_POLICY` as a component module — no IR fork. The
 *     only origin-side extension #719 needs is a trait-aware *resolver* (the MaaS
 *     Vite plugin unions component + trait definitions); the wire shape is
 *     unchanged.
 *   - **#716 neutral trait-manifest contract** (`traitManifestContract`): the
 *     plan is derived from the byte-identical manifest every bundler emits, so a
 *     served manifest matches a built one.
 *   - **#462 eager-hot-set / lazy-default policy**: eager traits are inlined into
 *     the component artifact (never fetched); lazy traits are fetched on first
 *     use; lazy+preload traits are warmed at bootstrap. This module turns a
 *     manifest into exactly that fetch plan.
 *
 * Pure and synchronous (no IO) — given a {@link TraitManifest} (already scoped to
 * the traits a component binds) it returns the framework-agnostic
 * {@link TraitDistributionPlan} the consumer executes.
 */
import { DEFAULT_BASE_PATH, CACHE_POLICY, SERVE_PATH } from './servePathIR';
import type {
  TraitManifest,
  TraitManifestEntry,
} from '../../../tools/trait-enforcer/traitManifestContract';

/** How a single served (fetched) trait chunk is delivered. */
export type ServedTraitDelivery = 'lazy' | 'preload';

/** A framework-agnostic fetch descriptor for one served trait chunk. */
export interface TraitServeDescriptor {
  /** The trait name (the attribute token), e.g. `'sortable'`. */
  readonly trait: string;
  /** The MaaS URL to fetch the chunk from (`/_maas/<trait>[@<pin>].js`). */
  readonly url: string;
  /** `lazy` = fetch on first use; `preload` = warm at bootstrap (#202). */
  readonly delivery: ServedTraitDelivery;
  /** The `Cache-Control` a hash-pinned chunk is served with (immutable) vs an unpinned one (floating). */
  readonly cache: string;
}

/**
 * The distribution plan a framework-agnostic consumer executes for one
 * component's bound traits — the served-path realization of #462's policy.
 */
export interface TraitDistributionPlan {
  /** Eager traits — inlined into the component artifact, **never fetched**. */
  readonly inlineEager: readonly string[];
  /** Lazy traits — fetched on first use (the default). */
  readonly lazy: readonly TraitServeDescriptor[];
  /** Lazy+preload traits — fetched at bootstrap (the eager hot-set of the served path). */
  readonly preload: readonly TraitServeDescriptor[];
}

/** Options shared by the path builder and the planner. */
export interface TraitServeOptions {
  /** Origin base path; defaults to the IR's `/_maas/`. */
  readonly basePath?: string;
  /** Per-trait content-hash pin (`sha256-…`). A pinned chunk is served immutable. */
  readonly pins?: Readonly<Record<string, string>>;
}

/**
 * Build the MaaS served-path URL for one trait chunk by filling the neutral
 * `SERVE_PATH.route` template (`<name>[@<pin>].js`) — the same route component
 * artifacts use, so traits need no new wire shape.
 */
export function traitServePath(
  trait: string,
  opts: { basePath?: string; pin?: string } = {},
): string {
  const basePath = opts.basePath ?? DEFAULT_BASE_PATH;
  const filled = SERVE_PATH.route
    .replace('<name>', trait)
    // `[@<pin>]` is the optional pin segment — fill it when pinned, else drop it.
    .replace('[@<pin>]', opts.pin ? `@${opts.pin}` : '');
  return `${basePath}${filled}`;
}

/** Narrow a manifest entry to its delivery class (mirrors the #716 union shapes). */
function classify(
  entry: TraitManifestEntry,
): 'eager' | 'preload' | 'lazy' {
  if (typeof entry === 'function') return 'lazy';
  // Object entries: an eager attribute entry or a lazy+preload entry.
  if (entry.delivery === 'eager') return 'eager';
  if (entry.delivery === 'lazy' && entry.preload === true) return 'preload';
  return 'lazy';
}

/**
 * Turn a {@link TraitManifest} (scoped to the traits a component binds) into the
 * framework-agnostic {@link TraitDistributionPlan} served over the MaaS origin.
 * Deterministic: traits are emitted in ascending-lexicographic key order to match
 * the manifest's `MANIFEST_KEY_ORDER`, so the plan is byte-stable across runs.
 */
export function planTraitDistribution(
  manifest: TraitManifest,
  opts: TraitServeOptions = {},
): TraitDistributionPlan {
  const pins = opts.pins ?? {};
  const inlineEager: string[] = [];
  const lazy: TraitServeDescriptor[] = [];
  const preload: TraitServeDescriptor[] = [];

  for (const trait of Object.keys(manifest).sort()) {
    const kind = classify(manifest[trait]);
    if (kind === 'eager') {
      inlineEager.push(trait);
      continue;
    }
    const pin = pins[trait];
    const descriptor: TraitServeDescriptor = {
      trait,
      url: traitServePath(trait, { basePath: opts.basePath, pin }),
      delivery: kind,
      cache: pin ? CACHE_POLICY.immutable : CACHE_POLICY.floating,
    };
    (kind === 'preload' ? preload : lazy).push(descriptor);
  }

  return { inlineEager, lazy, preload };
}
