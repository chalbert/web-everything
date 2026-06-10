/**
 * Native-first resolver — fills an impl-provider slot (#205, story of epic #203).
 *
 * A provider slot holds one of two things:
 *   - a **concrete impl id** (a *pin*) — returned as-is, no resolution runs;
 *   - a **named policy** — resolved against the capability provider (#204).
 *
 * `native-first` is the first-class policy the shipped base uses. Its algorithm is
 * **eligible → lightest → native wins ties** (the #025 ruling, generalized in #203):
 *   1. **Eligible** — every required capability id (the union of the slot's intents'
 *      `requiresCapabilities`) tiers to `native-ok` or `polyfill-ok` on the impl; none is
 *      `capability-hard`. The tiers come from the provider — capability facts are never hard-coded.
 *   2. **Lightest** — among eligible impls, fewest polyfills (the `polyfill-ok` count is the cost
 *      proxy for least JS over baseline).
 *   3. **Native wins ties** — among equally-light eligibles, prefer the native substrate.
 *
 * This is **check-before-choose**: eligibility is computed for *every* impl before a winner is
 * picked, so the resolver never commits to native and only then discovers a capability-hard required
 * capability (the privileged-before-check alternative #025 rejected).
 *
 * **Venue-agnostic** — the same algorithm runs at build / runtime / edge; only the provider differs
 * (the static build-matrix here; runtime feature-detection and the edge service are #208). A
 * constrained-target provider whose matrix marks a required capability `capability-hard` on the
 * native substrate is exactly how the policy falls through to a custom impl.
 */
import type { CapabilityProvider, Tier } from './provider.js';

/** The named resolution policies a slot may carry. `native-first` is the shipped base default. */
export type Policy = 'native-first';

export const POLICIES: readonly Policy[] = ['native-first'];

/** A provider slot: a concrete impl id (a pin) or a named resolution policy. */
export type Slot = string | { policy: Policy };

/** A slot pinned to a concrete impl id — no resolution runs. */
export function isPin(slot: Slot): slot is string {
  return typeof slot === 'string';
}

/** A slot carrying a named policy — resolution runs against the capability provider. */
export function isPolicy(slot: Slot): slot is { policy: Policy } {
  return typeof slot === 'object' && slot !== null && 'policy' in slot;
}

/** Per-impl eligibility against a required-capability set — the resolver's working data. */
export interface EligibilityReport {
  impl: string;
  /** Is this the native substrate? (The native-first tiebreak.) */
  native: boolean;
  /** No required capability is `capability-hard` on this impl. */
  eligible: boolean;
  /** `polyfill-ok` count — the lightness cost proxy (fewer polyfills = lighter). */
  cost: number;
  /** Required capabilities that are `capability-hard` here (why it is ineligible), in input order. */
  blockers: string[];
  /** Every (required capability → tier) considered, in input order. */
  tiers: Array<{ capabilityId: string; tier: Tier }>;
}

/** The outcome of resolving a slot. */
export interface Resolution {
  /** The chosen impl id. */
  impl: string;
  /** The policy that resolved it, or `null` when the slot was a concrete pin. */
  policy: Policy | null;
  /** True when the slot was a concrete impl (no resolution ran). */
  pinned: boolean;
  /** Human-readable why — `eligible → lightest → native-tiebreak`, or `pinned`. */
  reason: string;
  /** Every impl evaluated (empty for a pin) — for the demo, transparency, and strictness (#207). */
  candidates: EligibilityReport[];
}

/** No impl can serve the required capabilities without hitting a `capability-hard` wall. */
export class NoEligibleImplError extends Error {
  readonly requiredCapabilities: string[];
  readonly candidates: EligibilityReport[];
  constructor(requiredCapabilities: string[], candidates: EligibilityReport[]) {
    const why = candidates
      .map((c) => `${c.impl} (hard: ${c.blockers.join(', ') || 'none'})`)
      .join('; ');
    super(
      `native-first: no impl can serve required capabilities ` +
        `[${requiredCapabilities.join(', ') || 'none'}] without a capability-hard wall — ${why}`,
    );
    this.name = 'NoEligibleImplError';
    this.requiredCapabilities = requiredCapabilities;
    this.candidates = candidates;
  }
}

/** A slot named a policy the resolver does not know. */
export class UnknownPolicyError extends Error {
  constructor(policy: string) {
    super(`Unknown resolution policy "${policy}" — known policies: ${POLICIES.join(', ')}`);
    this.name = 'UnknownPolicyError';
  }
}

/**
 * Union the required capabilities of several intents (order-stable, de-duplicated). The slot's
 * component embodies multiple intents; native-first weighs every required capability together.
 */
export function requiredCapabilitiesFor(
  provider: CapabilityProvider,
  intentIds: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const intentId of intentIds)
    for (const capId of provider.requiredCapabilities(intentId))
      if (!seen.has(capId)) {
        seen.add(capId);
        out.push(capId);
      }
  return out;
}

/**
 * Tier every required capability on every impl the provider knows — the resolver's working set.
 * Pure: it never throws on ineligibility, it *reports* it (the resolver picks from this, and #207
 * strictness reads the same reports). Defaults to all impls; pass a subset to scope the search.
 */
export function evaluate(
  provider: CapabilityProvider,
  requiredCapabilities: string[],
  impls: string[] = provider.impls(),
): EligibilityReport[] {
  return impls.map((impl) => {
    const tiers = requiredCapabilities.map((capabilityId) => ({
      capabilityId,
      tier: provider.tier(impl, capabilityId),
    }));
    const blockers = tiers.filter((t) => t.tier === 'capability-hard').map((t) => t.capabilityId);
    const cost = tiers.filter((t) => t.tier === 'polyfill-ok').length;
    return { impl, native: provider.isNative(impl), eligible: blockers.length === 0, cost, blockers, tiers };
  });
}

/**
 * The native-first pick over pre-computed reports: eligible → lightest → native wins ties. Returns
 * `null` when no impl is eligible. Stable — the first impl (matrix order) wins a residual tie.
 */
export function pickNativeFirst(candidates: EligibilityReport[]): EligibilityReport | null {
  const eligible = candidates.filter((c) => c.eligible);
  if (!eligible.length) return null;
  return eligible.reduce((best, c) => {
    if (c.cost !== best.cost) return c.cost < best.cost ? c : best; // lightest
    if (c.native !== best.native) return c.native ? c : best; // native wins ties
    return best; // residual tie → stable, keep the earlier impl
  });
}

function reasonFor(
  winner: EligibilityReport,
  candidates: EligibilityReport[],
  required: string[],
): string {
  const eligible = candidates.filter((c) => c.eligible);
  const tied = eligible.filter((c) => c.cost === winner.cost);
  const parts = [
    `native-first over [${required.join(', ') || 'no required capabilities'}]`,
    `${eligible.length}/${candidates.length} impls eligible`,
    `"${winner.impl}" lightest (${winner.cost} polyfill${winner.cost === 1 ? '' : 's'})`,
  ];
  if (tied.length > 1 && winner.native) parts.push('native wins the tie');
  return parts.join('; ');
}

/**
 * Resolve a provider slot. A concrete impl id is a pin (returned as-is, no resolution). A named
 * policy resolves against the capability provider: `native-first` composes the intents' required
 * capabilities, tiers them across every impl, and picks eligible → lightest → native-tiebreak.
 *
 * Throws `UnknownPolicyError` for an unknown policy and `NoEligibleImplError` when no impl can serve
 * the required capabilities. (How a strict/lenient venue *reacts* to "no eligible impl" is #207's
 * strictness knob; the base resolver fails honestly.)
 */
export function resolveSlot(
  provider: CapabilityProvider,
  slot: Slot,
  intentIds: string[],
): Resolution {
  if (isPin(slot))
    return {
      impl: slot,
      policy: null,
      pinned: true,
      reason: `pinned to "${slot}" (concrete impl, no resolution)`,
      candidates: [],
    };

  if (slot.policy !== 'native-first') throw new UnknownPolicyError(slot.policy);

  const required = requiredCapabilitiesFor(provider, intentIds);
  const candidates = evaluate(provider, required);
  const winner = pickNativeFirst(candidates);
  if (!winner) throw new NoEligibleImplError(required, candidates);

  return {
    impl: winner.impl,
    policy: 'native-first',
    pinned: false,
    reason: reasonFor(winner, candidates, required),
    candidates,
  };
}
