/**
 * Partial-implementation conformance fixtures (#270) — the **shared fixture base** the other
 * spec-versioning slices exercise: the build-time check (#267), the runtime dev-mode guard (#268),
 * and the adherence report format (#269) all run against *these* known cases so each slice is tested
 * against the same out-of-capability scenarios rather than re-inventing ad-hoc manifests.
 *
 * Two sets, matching the two things every consumer does with a manifest:
 *
 *  1. {@link CAPABILITY_FIXTURES} — **valid** manifests paired with the feature set a consuming app
 *     actually *uses*, plus the expected **out-of-capability** diff (used − declared). This is the
 *     core scenario: partial compliance is first-class (#266), so an app that uses `async` against an
 *     implementation that omits it must be *detectable*. Each fixture pins exactly which used features
 *     fall outside the declared capability — empty for the fully-in-capability cases.
 *
 *  2. {@link INVALID_MANIFEST_FIXTURES} — values offered as manifests that must be **rejected** by
 *     {@link assertCapabilityManifest} (malformed shape, unknown feature id, or an L1+ claim missing a
 *     Core feature). The build-time check and guard both trust a manifest only after asserting it, so
 *     these pin the reject path.
 *
 * The out-of-capability diff itself is `used − declared` — computed with {@link manifestSupports} —
 * and the fixtures' `expectedOutOfCapability` is the pinned answer. {@link outOfCapability} is the
 * canonical helper the downstream slices share so the diff is defined once, here, with the fixtures.
 */

import {
  CORE_FEATURES,
  manifestSupports,
  type CapabilityManifest,
  type ValidationFeatureId,
} from './provider.js';

/**
 * The features a consuming app *uses* that the implementation does **not** declare (`used − declared`).
 * Empty iff every used feature is in-capability. This is the single diff the build-time check (#267),
 * the runtime guard (#268), and the report format (#269) all compute — defined once here with the
 * fixtures so the three slices agree on the contract.
 */
export function outOfCapability(
  manifest: CapabilityManifest,
  usedFeatures: readonly ValidationFeatureId[],
): ValidationFeatureId[] {
  return usedFeatures.filter((f) => !manifestSupports(manifest, f));
}

/** A valid manifest + the features a consuming app uses + the pinned out-of-capability diff. */
export interface CapabilityFixture {
  /** Stable fixture id (kebab-case) the downstream slices reference. */
  name: string;
  /** One-line description of the scenario this case pins. */
  description: string;
  /** A contract-valid manifest (passes `assertCapabilityManifest`). */
  manifest: CapabilityManifest;
  /** The validation features the consuming app actually exercises. */
  usedFeatures: ValidationFeatureId[];
  /** Expected `used − declared`: the features used but not declared (empty = fully in-capability). */
  expectedOutOfCapability: ValidationFeatureId[];
}

const SPEC = '1.0.0';

/**
 * The valid-manifest scenarios — fully-in-capability through several out-of-capability shapes, plus
 * the L0 render-only tier (which may omit Core). Ordered general → specific.
 */
export const CAPABILITY_FIXTURES: readonly CapabilityFixture[] = [
  {
    name: 'full-l2-in-capability',
    description: 'L2 implementation declaring Core + rich optionals; the app uses a subset — nothing out of capability.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L2',
      features: [
        ...CORE_FEATURES,
        'validation.feature.async',
        'validation.feature.cross-field',
        'validation.feature.schema',
        'validation.feature.severity',
      ],
      concerns: { 'validity-merge': 'source-reduction', 'validator-resolution': 'versioning' },
    },
    usedFeatures: [...CORE_FEATURES, 'validation.feature.async', 'validation.feature.schema'],
    expectedOutOfCapability: [],
  },
  {
    name: 'core-only-l1-in-capability',
    description: 'L1 implementation declaring only the Core set; the app uses only Core — in capability.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    },
    usedFeatures: [...CORE_FEATURES],
    expectedOutOfCapability: [],
  },
  {
    name: 'core-only-l1-uses-async',
    description: 'L1 Core-only implementation, but the app validates asynchronously — async is out of capability.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    },
    usedFeatures: [...CORE_FEATURES, 'validation.feature.async'],
    expectedOutOfCapability: ['validation.feature.async'],
  },
  {
    name: 'core-only-l1-uses-several-optional',
    description: 'L1 Core-only implementation; the app reaches for async + cross-field + conditional — all three out of capability.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    },
    usedFeatures: [
      ...CORE_FEATURES,
      'validation.feature.async',
      'validation.feature.cross-field',
      'validation.feature.conditional',
    ],
    expectedOutOfCapability: [
      'validation.feature.async',
      'validation.feature.cross-field',
      'validation.feature.conditional',
    ],
  },
  {
    name: 'partial-optional-l2-uses-undeclared-schema',
    description: 'L2 implementation declaring Core + async only; the app also uses schema validation — schema is out of capability.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L2',
      features: [...CORE_FEATURES, 'validation.feature.async'],
      concerns: { 'validity-merge': 'source-reduction' },
    },
    usedFeatures: [...CORE_FEATURES, 'validation.feature.async', 'validation.feature.schema'],
    expectedOutOfCapability: ['validation.feature.schema'],
  },
  {
    name: 'l0-render-only',
    description: 'L0 (intent-render only) implementation declaring no features; the app uses none — in capability (L0 may omit Core).',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L0',
      features: [],
      concerns: {},
    },
    usedFeatures: [],
    expectedOutOfCapability: [],
  },
  {
    name: 'l0-overreach',
    description: 'L0 implementation declaring no features, but the app drives control validity — out of capability against an intent-only impl.',
    manifest: {
      specVersion: SPEC,
      conformanceLevel: 'L0',
      features: [],
      concerns: {},
    },
    usedFeatures: ['validation.feature.control-validity'],
    expectedOutOfCapability: ['validation.feature.control-validity'],
  },
];

/** A value offered as a manifest that must be rejected, with the reason it fails the contract. */
export interface InvalidManifestFixture {
  /** Stable fixture id (kebab-case). */
  name: string;
  /** Why this value is not a conformant manifest. */
  reason: string;
  /** The malformed value — intentionally `unknown` so the fixtures can carry off-schema shapes. */
  value: unknown;
}

/**
 * Values that {@link assertCapabilityManifest} must reject — the reject path the build-time check
 * (#267) and runtime guard (#268) rely on before trusting a declared manifest.
 */
export const INVALID_MANIFEST_FIXTURES: readonly InvalidManifestFixture[] = [
  {
    name: 'l1-missing-core-feature',
    reason: 'conformanceLevel L1 claimed but the Core feature native-source is absent (#266 OP-18).',
    value: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [
        'validation.feature.control-validity',
        'validation.feature.interaction',
        'validation.feature.display',
        // native-source intentionally omitted
      ],
      concerns: {},
    },
  },
  {
    name: 'malformed-spec-version',
    reason: 'specVersion is not a MAJOR.MINOR.PATCH triple.',
    value: {
      specVersion: '1.0',
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    },
  },
  {
    name: 'unknown-feature-id',
    reason: 'features[] contains an id outside the closed vocabulary.',
    value: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES, 'validation.feature.telepathy'],
      concerns: {},
    },
  },
  {
    name: 'wrong-conformance-level',
    reason: 'conformanceLevel is not one of L0 | L1 | L2.',
    value: {
      specVersion: SPEC,
      conformanceLevel: 'L3',
      features: [...CORE_FEATURES],
      concerns: {},
    },
  },
  {
    name: 'concerns-not-a-record',
    reason: 'concerns must be a string→string record, not an array.',
    value: {
      specVersion: SPEC,
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: [],
    },
  },
  {
    name: 'not-an-object',
    reason: 'a non-object value is not a manifest.',
    value: null,
  },
];
