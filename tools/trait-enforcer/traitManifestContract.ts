/**
 * @file tools/trait-enforcer/traitManifestContract.ts
 * @description The neutral, bundler-agnostic trait-manifest contract — the language- and
 * toolchain-neutral source of truth for usage-scanned, tree-shakable trait composition (backlog #716,
 * keystone of the #715 epic). The trait-side analogue of the MaaS serve-path IR
 * ({@link ../../blocks/renderers/module-service/servePathIR.ts}, #505).
 *
 * Today the "contract" exists only as the Vite plugin's *implementation*
 * ({@link ./vite-plugin.ts}: `scanTraitsInHtml`, `scanTraitDeliveryOverrides`, `generateManifestModule`).
 * This module lifts the format + scan semantics out of that one bundler so every per-bundler
 * implementation (webpack / Rollup / esbuild / Parcel / SWC) and the MaaS serve path derive from one
 * definition and emit **byte-identical** manifests from the same input. The split #715 rests on: this
 * file is the **definition**; the Vite plugin is the **reference implementation**, not the definition —
 * when the two disagree the contract wins and the plugin is fixed, which is enforceable because the
 * plugin imports its byte-determining constants ({@link DEFAULT_DELIVERY}, {@link USED_TRAIT_PATTERN_TEMPLATE},
 * {@link DELIVERY_OVERRIDE_PATTERN_TEMPLATE}, {@link SCAN_FLAGS}, {@link DELIVERY_OVERRIDE_SUFFIX},
 * {@link PRELOAD_OVERRIDE_VALUE}) from here rather than declaring its own.
 *
 * Neutrality rules this file holds to (same as servePathIR): pure data + types, **no imports** (not Node,
 * not Vite, not DOM), and the scan grammar is shipped as regex-*source* string templates with a documented
 * `{NAME}` substitution rule — never as a compiled `RegExp` — so a code generator that has never seen
 * TypeScript's runtime can read it and emit an equivalent scanner in .NET / Java / Go.
 *
 * It defines three things, the keystone every implementation builds against:
 *   1. **The manifest entry shapes** — the three forms a value in the emitted `traitManifest` table takes
 *      (lazy thunk, lazy + preload, eager static binding). See {@link TraitManifestEntry}.
 *   2. **The attribute-scan contract** — what counts as a *used* trait, and the per-usage `eager` override.
 *      See {@link USED_TRAIT_PATTERN_TEMPLATE} / {@link DELIVERY_OVERRIDE_PATTERN_TEMPLATE}.
 *   3. **The chunk-isolation guarantee** — unused trait → zero bytes. See {@link CHUNK_ISOLATION}.
 */

// ── 1. Input contract: the trait Map (attribute name → module specifier) ─────────

/** How a trait is delivered. `lazy` (default) → code-split + load on demand; `eager` → baked in. */
export type TraitDelivery = 'eager' | 'lazy';

/** The default delivery when a Map entry omits it (a bare-string entry, or an object with no `delivery`). */
export const DEFAULT_DELIVERY: TraitDelivery = 'lazy';

/**
 * A build-time Map entry with an explicit `delivery` dimension. Use the object form to override the
 * default (`lazy`) — typically `{ module, delivery: 'eager' }` for a tiny / always-on trait baked into
 * the main bundle.
 */
export interface TraitMapEntry {
  /** The trait's module specifier (a literal import path the bundler resolves). */
  module: string;
  /** How the trait is delivered. Default {@link DEFAULT_DELIVERY}. */
  delivery?: TraitDelivery;
}

/**
 * The build-time Map: attribute name → its module specifier. A bare string is the default
 * (`delivery: 'lazy'`); use a {@link TraitMapEntry} object to set `delivery: 'eager'`. This is the one
 * input every conformant implementation consumes.
 */
export type TraitMap = Record<string, string | TraitMapEntry>;

/** The normalized form of a Map value — `{ module, delivery }` with delivery defaulted. */
export type NormalizedTraitEntry = Required<TraitMapEntry>;

// ── 2. Output contract: the emitted manifest entry shapes ────────────────────────

/**
 * A bare lazy thunk — the default emitted form: `() => import(spec)`. The bundler code-splits the trait
 * into its own chunk; the runtime loads it on the trait's first DOM appearance. `T` is the loaded module
 * (a generator in another language emits the equivalent deferred-load form).
 */
export type LazyTraitThunk<T = unknown> = () => Promise<T>;

/**
 * A lazy trait whose chunk is *warmed at bootstrap* because a usage site carried the per-usage
 * `<trait>-delivery="eager"` override (#202). Still code-split — `preload` only tells the runtime to
 * prefetch the chunk early so it's ready when a not-yet-mounted element appears later.
 */
export interface LazyPreloadTraitEntry<T = unknown> {
  delivery: 'lazy';
  preload: true;
  load: () => Promise<T>;
}

/**
 * An eager trait: statically imported and baked into the main bundle (no split chunk). `attribute` is
 * the trait's module binding the runtime registers up front.
 */
export interface EagerTraitEntry<A = unknown> {
  delivery: 'eager';
  attribute: A;
}

/**
 * A value in the emitted `traitManifest` table — exactly one of the three shapes. The bare thunk is the
 * common case; the object forms carry the `delivery` discriminant.
 */
export type TraitManifestEntry<T = unknown, A = unknown> =
  | LazyTraitThunk<T>
  | LazyPreloadTraitEntry<T>
  | EagerTraitEntry<A>;

/** The emitted manifest: attribute name → its {@link TraitManifestEntry}, **sorted by key** (see {@link MANIFEST_KEY_ORDER}). */
export type TraitManifest<T = unknown, A = unknown> = Record<string, TraitManifestEntry<T, A>>;

// ── 3. The attribute-scan contract ──────────────────────────────────────────────

/** The placeholder in the pattern templates an implementation replaces with the regex-escaped trait name. */
export const TRAIT_NAME_PLACEHOLDER = '{NAME}' as const;

/** Regex flags both scan patterns are compiled with (multiline — `^`/`$` match per line). */
export const SCAN_FLAGS = 'm' as const;

/**
 * What counts as a *used* trait: the trait's attribute name appears as an attribute token in template
 * HTML — preceded by whitespace or start, followed by `=`, `/`, `>`, whitespace, or end. So `sortable`
 * matches `<div sortable>` and `<div sortable="">` but **not** `sortableness`. Names may contain `:` /
 * `-` (`nav:list`, `export-csv`). Errs toward inclusion: a stray match only means an extra never-loaded
 * chunk, never a missing trait.
 *
 * Shipped as regex *source* with the {@link TRAIT_NAME_PLACEHOLDER} standing in for the escaped name;
 * an implementation substitutes the placeholder and compiles with {@link SCAN_FLAGS}.
 */
export const USED_TRAIT_PATTERN_TEMPLATE = `(?:^|\\s)${TRAIT_NAME_PLACEHOLDER}(?=[\\s=/>]|$)` as const;

/** The reserved suffix that forms a per-usage delivery-override attribute (`<trait>-delivery`). */
export const DELIVERY_OVERRIDE_SUFFIX = '-delivery' as const;

/** The only override value that warms a lazy trait (preload); any other value is the no-op default. */
export const PRELOAD_OVERRIDE_VALUE = 'eager' as const;

/**
 * The per-usage preload override (#202): `<trait>-delivery="eager"` (quotes optional, whitespace
 * tolerated) marks a lazy trait to be warmed at bootstrap rather than on first appearance. Only `eager`
 * flips preload; `delivery="lazy"` (or anything else) is ignored. Shipped as regex source with the
 * {@link TRAIT_NAME_PLACEHOLDER} substitution, compiled with {@link SCAN_FLAGS}.
 */
export const DELIVERY_OVERRIDE_PATTERN_TEMPLATE =
  `(?:^|\\s)${TRAIT_NAME_PLACEHOLDER}${DELIVERY_OVERRIDE_SUFFIX}\\s*=\\s*["']?${PRELOAD_OVERRIDE_VALUE}(?=[\\s"'/>]|$)` as const;

/**
 * The character class an implementation must regex-escape in a trait name before substituting it for
 * {@link TRAIT_NAME_PLACEHOLDER}, so a name's metacharacters are matched literally. (A JS implementation
 * does `name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`; this constant is the same set for a generator that
 * isn't reading JS.)
 */
export const TRAIT_NAME_ESCAPE_CHARS = '.*+?^${}()|[]\\' as const;

// ── 4. Determinism & the chunk-isolation guarantee ───────────────────────────────

/**
 * The emitted manifest's keys are sorted ascending (lexicographic), so the same Map + same used set
 * produce a byte-identical manifest under any bundler — the cross-toolchain equality #715 asserts.
 */
export const MANIFEST_KEY_ORDER = 'ascending-lexicographic' as const;

/**
 * The chunk-isolation guarantee every conformant implementation must hold: a trait whose attribute is
 * **not** found by the scan (and is not pulled in by a preload override) is **omitted** from the emitted
 * manifest, and a `lazy` trait is emitted only as an `import()` the bundler splits into its own chunk —
 * so an unused trait contributes **zero bytes** to the main bundle, and a used lazy trait contributes
 * zero bytes until first loaded. `eager` traits are the explicit opt-out: they are baked into the main
 * bundle by design.
 */
export const CHUNK_ISOLATION = {
  /** An unused trait (not scanned, not preloaded) → not in the manifest → no chunk, no bytes. */
  unusedEmitsNothing: true,
  /** A used `lazy` trait → an `import()` the bundler isolates into its own on-demand chunk. */
  lazyIsCodeSplit: true,
  /** A `preload` override warms a lazy chunk at bootstrap but does NOT bake it into the main bundle. */
  preloadStaysSplit: true,
  /** `eager` is the only form that bakes a trait into the main bundle (explicit opt-out of isolation). */
  eagerIsBakedIn: true,
} as const;
