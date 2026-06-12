/**
 * Capability-manifest plane — the *declare + verify* meta-layer for the validation standard
 * (#266, the foundation slice of #005's spec-versioning + capability-adherence epic).
 *
 * The validation standard is an interop contract with two orthogonal axes: **conformance tiers**
 * (depth — L0 Intent-aware → L1 State & event → L2 Shape & concern, ratified in #004 OP-11) and
 * **features** (breadth — optional, trait-like capability bundles like `async`, `cross-field`,
 * `schema`). Partial compliance is first-class: an app that needs no async validation installs an
 * implementation that omits it. That is only safe if (a) an implementation *declares* what it
 * supports and (b) out-of-capability usage is **detectable and reported**, never a silent no-op.
 *
 * This module ships the artifact every downstream slice consumes — the `CapabilityManifest` shape an
 * implementation publishes, the ratified feature vocabulary (#266 OP-18: which features are Core),
 * the static-export convention by which a manifest is exposed (#266 OP-19), and the semver scheme
 * over the vocabulary (deprecate-don't-rename; additive → minor, removal → major). Like the
 * validity-merge (#212) and validator-resolution (#214) planes this is a standalone, dependency-free
 * model of the contract: the build-time check (#267), runtime guard (#268), report format (#269) and
 * conformance fixtures (#270) all read *this* shape — they do not re-derive it.
 *
 * **Generalizes beyond validation.** The `{ specVersion, conformanceLevel, features, concerns }`
 * shape and the semver helpers are vocabulary-agnostic; only `VALIDATION_*` / `*_FEATURES` carry the
 * validation feature ids. Another WE standard with optional features reuses the shape and supplies
 * its own feature constants + spec version.
 */

/**
 * The conformance tier an implementation claims (#004 OP-11, ratified). Depth, orthogonal to the
 * feature breadth: L0 renders the intent; L1 emits the observable state & event surface (swappable);
 * L2 adds shape & concern conformance (combinable). A manifest at any tier may carry any features.
 */
export type ConformanceLevel = 'L0' | 'L1' | 'L2';

export const CONFORMANCE_LEVELS: readonly ConformanceLevel[] = ['L0', 'L1', 'L2'];

/**
 * A stable validation feature id (`validation.feature.*`, dot-path, append-only). The union is the
 * vocabulary as of {@link VALIDATION_SPEC_VERSION}; an implementation lists the subset it supports in
 * a manifest's `features[]`. Ids are **never renamed** — deprecate-don't-rename keeps `#NNN` and tool
 * references stable (the semver scheme below encodes the rule).
 */
export type ValidationFeatureId =
  // Core (#266 OP-18 — mandatory for any L1+ conformance).
  | 'validation.feature.control-validity'
  | 'validation.feature.interaction'
  | 'validation.feature.display'
  | 'validation.feature.native-source'
  // Optional — declared only when supported; absence is reportable, never a silent no-op.
  | 'validation.feature.async'
  | 'validation.feature.cross-field'
  | 'validation.feature.conditional'
  | 'validation.feature.field-array'
  | 'validation.feature.wizard'
  | 'validation.feature.error-summary'
  | 'validation.feature.severity'
  | 'validation.feature.schema'
  | 'validation.feature.server-reconciliation';

/**
 * **OP-18, ratified (2026-06-11)** — the Core feature set: mandatory for any L1+ conformance claim.
 * Control validity (error level), interaction state (dirty/touched), display decision, and the native
 * Constraint Validation source. An implementation that omits any of these cannot claim L1 — the
 * build-time check (#267) and runtime guard (#268) enforce it against this set. Everything else
 * (async, cross-field, schema, …) is optional and declared per-implementation.
 */
export const CORE_FEATURES: readonly ValidationFeatureId[] = [
  'validation.feature.control-validity',
  'validation.feature.interaction',
  'validation.feature.display',
  'validation.feature.native-source',
];

/** The optional (non-Core) features — declared only when an implementation supports them. */
export const OPTIONAL_FEATURES: readonly ValidationFeatureId[] = [
  'validation.feature.async',
  'validation.feature.cross-field',
  'validation.feature.conditional',
  'validation.feature.field-array',
  'validation.feature.wizard',
  'validation.feature.error-summary',
  'validation.feature.severity',
  'validation.feature.schema',
  'validation.feature.server-reconciliation',
];

/** Every known validation feature id (Core + optional) — the closed vocabulary a manifest draws from. */
export const ALL_FEATURES: readonly ValidationFeatureId[] = [...CORE_FEATURES, ...OPTIONAL_FEATURES];

/**
 * The spec version a feature id **first appeared in** (its `since`). A consumer that uses feature X
 * needs an implementation whose `specVersion >= since[X]` *and* whose `features[]` lists X — the
 * build-time check (#267) diffs used-vs-declared against this map. Append-only: a new feature lands
 * with the minor version that introduced it; existing entries never change (deprecate-don't-rename).
 */
export const FEATURE_SINCE: Readonly<Record<ValidationFeatureId, string>> = {
  // The 1.0.0 baseline — Core + the features present when the vocabulary was first versioned.
  'validation.feature.control-validity': '1.0.0',
  'validation.feature.interaction': '1.0.0',
  'validation.feature.display': '1.0.0',
  'validation.feature.native-source': '1.0.0',
  'validation.feature.async': '1.0.0',
  'validation.feature.cross-field': '1.0.0',
  'validation.feature.conditional': '1.0.0',
  'validation.feature.field-array': '1.0.0',
  'validation.feature.wizard': '1.0.0',
  'validation.feature.error-summary': '1.0.0',
  'validation.feature.severity': '1.0.0',
  'validation.feature.schema': '1.0.0',
  'validation.feature.server-reconciliation': '1.0.0',
};

/**
 * The current validation spec version — semver over the vocabulary (below). Bumped when the vocabulary
 * changes; an implementation declares the version it targets in its manifest's `specVersion`. This is
 * the canonical home (a `const`, not an `intents.json` field): the manifest is a conformance/protocol
 * artifact, kept out of the UX-only Validation Intent per the intent-UX-only rule. The downstream
 * tooling (#267–#270) imports this; nothing re-types the version.
 */
export const VALIDATION_SPEC_VERSION = '1.0.0';

/**
 * **OP-19, ratified (2026-06-11)** — how an implementation publishes its manifest: a **static export**
 * named {@link MANIFEST_EXPORT_NAME}. The implementation's entry module exports a const `manifest`
 * (or a class carries it as a static) holding a conformant {@link CapabilityManifest}. This is the
 * lean baseline (zero runtime, statically inspectable by #267); a richer exposure (an element /
 * `ElementInternals` property, or an injector provider resolved via `InjectorRoot.getProviderOf`) can
 * be layered later without breaking the static export — the manifest *value* is the contract, the
 * channel is additive.
 */
export const MANIFEST_EXPORT_NAME = 'manifest' as const;

/**
 * The capability manifest an implementation declares (#266 — the artifact the whole epic gates on).
 * `specVersion` is the vocabulary version it targets (semver); `conformanceLevel` the tier it claims;
 * `features` the subset of {@link ValidationFeatureId} it supports (must include every Core id at
 * L1+); `concerns` records the swappable-concern strategy it ships per pluggable plane (e.g.
 * `validity-merge: 'source-reduction'`, `validator-resolution: 'versioning'`) so a consumer knows the
 * default behavior without instantiating it. A manifest is data — serializable, statically exportable.
 */
export interface CapabilityManifest {
  specVersion: string;
  conformanceLevel: ConformanceLevel;
  features: ValidationFeatureId[];
  /** Per-plane strategy key (concern → strategy), e.g. `{ 'validity-merge': 'source-reduction' }`. Optional planes omitted. */
  concerns: Record<string, string>;
}

/** A value was offered as a `CapabilityManifest` but does not conform to the schema. */
export class ManifestContractError extends Error {
  constructor(why: string) {
    super(`CapabilityManifest contract broken: ${why}`);
    this.name = 'ManifestContractError';
  }
}

// ---------------------------------------------------------------------------------------------------
// Semver scheme over the vocabulary
//
// `specVersion` is a SemVer 2.0 `MAJOR.MINOR.PATCH` string. The bump rules over the *vocabulary*:
//   • MINOR — additive: a new feature id / atom appended (ids are append-only), or an existing feature
//     id marked deprecated (the id stays usable). New `FEATURE_SINCE` entries land at the minor.
//   • MAJOR — removal: a previously-deprecated id is finally dropped (a breaking vocabulary change).
//   • PATCH — clarifications/fixes that change no ids and add no features.
// The invariant the scheme buys: a manifest at `specVersion = X` can be read by any tool that knows a
// `specVersion >= X` (ids never silently change meaning — deprecate-don't-rename). Pre-release / build
// metadata (`-rc.1`, `+sha`) is out of scope for this slice; only the numeric core is compared.
// ---------------------------------------------------------------------------------------------------

/** Parse the numeric `MAJOR.MINOR.PATCH` core of a SemVer string; throws on a malformed version. */
export function parseSpecVersion(v: string): [number, number, number] {
  const core = v.split('+')[0].split('-')[0];
  const parts = core.split('.');
  if (parts.length !== 3)
    throw new ManifestContractError(`specVersion "${v}" is not MAJOR.MINOR.PATCH`);
  const nums = parts.map((p) => {
    if (!/^\d+$/.test(p)) throw new ManifestContractError(`specVersion "${v}" has a non-numeric segment`);
    return Number(p);
  });
  return [nums[0], nums[1], nums[2]];
}

/** Compare two spec versions by their numeric core: `-1` if a<b, `0` if equal, `1` if a>b. */
export function compareSpecVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSpecVersion(a);
  const pb = parseSpecVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** Whether `feature` existed as of `specVersion` (i.e. `specVersion >= FEATURE_SINCE[feature]`). */
export function featureAvailableIn(feature: ValidationFeatureId, specVersion: string): boolean {
  const since = FEATURE_SINCE[feature];
  if (since === undefined) return false;
  return compareSpecVersions(specVersion, since) >= 0;
}

/** Whether a manifest declares support for `feature` (it appears in `features[]`). */
export function manifestSupports(manifest: CapabilityManifest, feature: ValidationFeatureId): boolean {
  return manifest.features.includes(feature);
}

/** The Core ids a manifest is **missing** — empty iff it covers the whole {@link CORE_FEATURES} set. */
export function missingCoreFeatures(manifest: CapabilityManifest): ValidationFeatureId[] {
  return CORE_FEATURES.filter((f) => !manifest.features.includes(f));
}

/** Narrow an unknown value to a structurally-valid `CapabilityManifest`. */
export function isCapabilityManifest(v: unknown): v is CapabilityManifest {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (typeof m.specVersion !== 'string') return false;
  if (!(CONFORMANCE_LEVELS as readonly string[]).includes(m.conformanceLevel as string)) return false;
  if (!Array.isArray(m.features)) return false;
  if (!m.features.every((f) => (ALL_FEATURES as readonly string[]).includes(f as string))) return false;
  if (typeof m.concerns !== 'object' || m.concerns === null || Array.isArray(m.concerns)) return false;
  if (!Object.values(m.concerns as Record<string, unknown>).every((s) => typeof s === 'string')) return false;
  return true;
}

/**
 * Assert a value is a conformant `CapabilityManifest` and that an L1+ claim carries every Core feature
 * (#266 OP-18). Returns it typed when valid; throws {@link ManifestContractError} otherwise. The
 * single entry point the downstream tooling calls to trust a declared manifest before diffing usage.
 */
export function assertCapabilityManifest(v: unknown): CapabilityManifest {
  if (!isCapabilityManifest(v))
    throw new ManifestContractError('value is not a structurally-valid manifest');
  // Surfaces a malformed specVersion early (parse throws if not MAJOR.MINOR.PATCH).
  parseSpecVersion(v.specVersion);
  if (v.conformanceLevel !== 'L0') {
    const missing = missingCoreFeatures(v);
    if (missing.length)
      throw new ManifestContractError(
        `conformanceLevel "${v.conformanceLevel}" claimed but Core features missing: ${missing.join(', ')}`,
      );
  }
  return v;
}
