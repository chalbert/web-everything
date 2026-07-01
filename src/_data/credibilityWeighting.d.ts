// Co-located type surface for the CommonJS `credibilityWeighting` meta-schema (#1588/#1591).
//
// The runtime module stays CommonJS (`module.exports = {…}`) because it is an 11ty `_data` global
// consumed via `require()` (11ty + scripts/__tests__/credibility-weighting.test.mjs). This `.d.ts`
// gives TypeScript consumers (plateau-app's #1626 weight-tuning panel) the named-export TYPES and a
// default-export shape for the whole module object — so a consumer does a default-import + destructure
// (values) and named type-imports (types), never named VALUE imports of a CJS module (which Rollup
// cannot statically resolve → the #1984 build red). See #1984.

/** A named weight modifier: a direction + a fixed `delta` applied to the baseline tier (axis 2). */
export interface CredibilityModifier {
  direction: 'up' | 'down';
  delta: number;
  label: string;
  /** Only `staleness` is deterministic (computed, needs no human rationale). */
  deterministic?: boolean;
}

/** One applied modifier on a source: its id plus (unless deterministic) a rationale + attribution. */
export interface CredibilityAppliedModifier {
  id: string;
  rationale?: string;
  attribution?: string;
  asOf?: string | number | Date;
  date?: string | number | Date;
}

/** An admitted source scored by `computeCredibilityWeight`: a `kind` + optional applied modifiers. */
export interface CredibilitySource {
  kind: string;
  modifiers?: CredibilityAppliedModifier[];
  /** Admission-gate booleans (`identifiable`, `traceable`, `on-topic`, …). */
  [gate: string]: unknown;
}

/** The portable opts a project emits to retune the WE default flavor (config-extends-platform-default). */
export interface CredibilityWeightOpts {
  sourceKinds?: Record<string, number>;
  weightModifiers?: Record<string, CredibilityModifier>;
  floor?: number;
  stalenessHorizonYears?: number;
}

/** The result of scoring an admitted source: the clamped weight, its baseline tier, and applied ids. */
export interface CredibilityWeightResult {
  weight: number;
  baseline: number;
  applied: string[];
}

export const sourceKindDefault: Record<string, number>;
export const weightModifierDefault: Record<string, CredibilityModifier>;
export const admissionGateDefault: Record<string, string>;
export const weightFloorDefault: number;
export const stalenessHorizonYearsDefault: number;

export function admit(
  source: Record<string, unknown>,
  opts?: { gates?: Record<string, string> },
): { admitted: boolean; failed: string[] };

export function computeCredibilityWeight(
  source: CredibilitySource,
  opts?: CredibilityWeightOpts,
): CredibilityWeightResult;

/** The whole CommonJS module object (what a default-import binds to under esModuleInterop). */
declare const credibilityWeighting: {
  sourceKindDefault: Record<string, number>;
  weightModifierDefault: Record<string, CredibilityModifier>;
  admissionGateDefault: Record<string, string>;
  weightFloorDefault: number;
  stalenessHorizonYearsDefault: number;
  admit: typeof admit;
  computeCredibilityWeight: typeof computeCredibilityWeight;
};

export default credibilityWeighting;
