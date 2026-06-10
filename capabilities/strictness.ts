/**
 * Validation strictness — the D5 policy knob of epic #203 (story #207).
 *
 * **One orthogonal `silent | warn | error` knob** lives in the base definition (overridable per scope
 * via the D6 cascade, see `cascade.ts`). It governs **how loudly** a resolution problem is reported,
 * not *whether* one exists — the problem is a fact of the matrix; the knob is the reaction:
 *
 *   - **`error`** → *strict* conformance tier. The problem throws (CI bumps to this so a wrong guess
 *     fails the build).
 *   - **`warn`** → *standard* tier, **the base default**. The problem is reported but resolution
 *     proceeds, honoring progressive enhancement — a wrong guess **degrades**, it does not break.
 *   - **`silent`** → *lenient* tier. The problem is swallowed (runtime PE-degradation uses this).
 *
 * It applies **identically** to the two ways a slot can be wrong (the #203 D5 ruling):
 *   1. a **rejected concrete pin** — a slot pinned to an impl whose *required* capability tiers to
 *      `capability-hard` there; and
 *   2. a **policy that resolves to a capability-hard wall** — `native-first` found no eligible impl
 *      (`NoEligibleImplError`).
 *
 * The validator never hard-codes capability facts: it asks the same {@link CapabilityProvider} the
 * resolver does, so the page, the resolver, and strictness can never drift apart.
 */
import type { CapabilityProvider } from './provider.js';
import {
  resolveSlot,
  requiredCapabilitiesFor,
  isPin,
  NoEligibleImplError,
  type Slot,
  type Resolution,
} from './resolver.js';

/** The orthogonal strictness knob (D5). `warn` is the base default. */
export type Strictness = 'silent' | 'warn' | 'error';

export const STRICTNESSES: readonly Strictness[] = ['silent', 'warn', 'error'];

/** The base default — progressive enhancement: a wrong guess degrades, it does not break. */
export const DEFAULT_STRICTNESS: Strictness = 'warn';

/** The conformance tier each strictness maps onto (the D5 ruling). */
export type ConformanceTier = 'lenient' | 'standard' | 'strict';

const TIER_BY_STRICTNESS: Record<Strictness, ConformanceTier> = {
  silent: 'lenient',
  warn: 'standard',
  error: 'strict',
};

const STRICTNESS_BY_TIER: Record<ConformanceTier, Strictness> = {
  lenient: 'silent',
  standard: 'warn',
  strict: 'error',
};

/** Map a strictness knob onto its conformance tier (error = strict, warn = standard, silent = lenient). */
export function conformanceTierFor(strictness: Strictness): ConformanceTier {
  return TIER_BY_STRICTNESS[strictness];
}

/** The inverse — the strictness a conformance tier selects. */
export function strictnessForTier(tier: ConformanceTier): Strictness {
  return STRICTNESS_BY_TIER[tier];
}

/** Why a slot is invalid — the two D5 cases, reported identically. */
export interface ValidationProblem {
  /** A pinned impl can't serve a required capability, or a policy found no eligible impl. */
  kind: 'pin-rejected' | 'policy-unresolvable';
  /** The rejected pin's impl id; `null` for an unresolvable policy. */
  impl: string | null;
  /** The required capabilities that tier to `capability-hard` (why it's invalid), in input order. */
  blockers: string[];
  /** The full required-capability set considered. */
  requiredCapabilities: string[];
  message: string;
}

/** The outcome of validating a slot under a strictness knob. */
export interface ValidationOutcome {
  /** No problem — the pin serves every required capability, or the policy resolved cleanly. */
  valid: boolean;
  /** The knob in force. */
  strictness: Strictness;
  /** The conformance tier it maps onto. */
  conformanceTier: ConformanceTier;
  /**
   * How loud the problem is. `'ok'` when valid; otherwise **equal to `strictness`** — that is the
   * whole point of the knob: the same problem is `silent` / `warn` / `error` depending only on it.
   */
  severity: 'ok' | Strictness;
  /**
   * The resolution to use. A rejected *pin* still resolves to its impl (PE-degraded at silent/warn);
   * an unresolvable *policy* has nothing to use → `null`.
   */
  resolution: Resolution | null;
  /** The problem, or `null` when valid. */
  problem: ValidationProblem | null;
}

/**
 * Validate a provider slot under a strictness knob — the D5 entry point. Pure: it **reports** the
 * problem with a severity, it does not act on it (no throw, no console). {@link applyStrictness}
 * turns that outcome into the reaction — throw on `error`, call `onWarn` on `warn`, swallow on
 * `silent` — for callers (the resolver, CI) that want the strict tier to fail hard.
 *
 * Both wrong-slot cases collapse to the same shape:
 *   - **pin** — tier each required capability on the pinned impl; any `capability-hard` → rejected,
 *     but the resolution still points at the pin (degrade, don't drop).
 *   - **policy** — run the resolver; `NoEligibleImplError` → unresolvable, resolution `null`.
 */
export function validateSlot(
  provider: CapabilityProvider,
  slot: Slot,
  intentIds: string[],
  strictness: Strictness = DEFAULT_STRICTNESS,
): ValidationOutcome {
  const conformanceTier = conformanceTierFor(strictness);
  const required = requiredCapabilitiesFor(provider, intentIds);

  if (isPin(slot)) {
    const blockers = required.filter((cap) => provider.tier(slot, cap) === 'capability-hard');
    const resolution = resolveSlot(provider, slot, intentIds); // a pin always resolves to itself
    if (blockers.length === 0) {
      return { valid: true, strictness, conformanceTier, severity: 'ok', resolution, problem: null };
    }
    return {
      valid: false,
      strictness,
      conformanceTier,
      severity: strictness,
      resolution, // degrade onto the pinned impl; only `error` (assertValid) refuses it
      problem: {
        kind: 'pin-rejected',
        impl: slot,
        blockers,
        requiredCapabilities: required,
        message:
          `pinned impl "${slot}" can't serve required ` +
          `capabilit${blockers.length === 1 ? 'y' : 'ies'} [${blockers.join(', ')}] ` +
          `(capability-hard) — under "${strictness}" (${conformanceTier})`,
      },
    };
  }

  // A policy: let the resolver run; a capability-hard wall on every impl is the unresolvable case.
  try {
    const resolution = resolveSlot(provider, slot, intentIds);
    return { valid: true, strictness, conformanceTier, severity: 'ok', resolution, problem: null };
  } catch (e) {
    if (!(e instanceof NoEligibleImplError)) throw e; // UnknownPolicyError etc. are author bugs, not strictness
    return {
      valid: false,
      strictness,
      conformanceTier,
      severity: strictness,
      resolution: null,
      problem: {
        kind: 'policy-unresolvable',
        impl: null,
        blockers: e.candidates.flatMap((c) => c.blockers).filter((b, i, a) => a.indexOf(b) === i),
        requiredCapabilities: e.requiredCapabilities,
        message:
          `policy "${(slot as { policy: string }).policy}" found no eligible impl — every candidate ` +
          `hits a capability-hard wall; under "${strictness}" (${conformanceTier})`,
      },
    };
  }
}

/** Raised when an `error`-tier (strict) outcome is asserted — CI's hard fail. */
export class StrictnessError extends Error {
  readonly problem: ValidationProblem;
  constructor(problem: ValidationProblem) {
    super(problem.message);
    this.name = 'StrictnessError';
    this.problem = problem;
  }
}

/**
 * Act on a validation outcome the way its severity dictates, and return the resolution to use:
 *   - `ok` / `silent` → return the resolution (possibly `null` for an unresolvable policy), no noise;
 *   - `warn` → invoke `onWarn` (default: no-op) with the problem, then return the resolution;
 *   - `error` → throw {@link StrictnessError}.
 * Keeps the reaction policy in one place so the resolver, the demo, and CI all behave identically.
 */
export function applyStrictness(
  outcome: ValidationOutcome,
  onWarn: (problem: ValidationProblem) => void = () => {},
): Resolution | null {
  if (outcome.valid || outcome.severity === 'silent') return outcome.resolution;
  if (outcome.severity === 'error') throw new StrictnessError(outcome.problem!);
  onWarn(outcome.problem!); // 'warn'
  return outcome.resolution;
}
