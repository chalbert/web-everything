/**
 * Build-time worked-example generator (#213) — the /capabilities "Native-first resolution" section
 * renders its native-branch worked example from the artifact this produces, instead of restating the
 * algorithm's conclusion as hand-authored prose that can drift from the matrix silently.
 *
 * 11ty can't run the TypeScript resolver at build time, so this module computes the example once from
 * the *real* shipped provider (`createDefaultProvider`) and emits a small JSON artifact
 * (`src/_data/capabilityWorkedExample.json`) that the page reads like any other `_data` file. The
 * committed artifact is pinned to this function by `__tests__/worked-example-artifact.test.ts`: edit
 * the matrix so the resolution changes and the artifact goes stale → the test reddens (the #213 DoD).
 *
 * Only the **native branch** is computed here — it's the one derived from the shipped build-matrix, so
 * it's the one that can drift. The page's fallback branch stays prose: it illustrates a *hypothetical*
 * constrained target, not the shipped matrix, so there is nothing in the shipped data for it to
 * disagree with (its claimed winner is still pinned by the resolver tests).
 */
import { createDefaultProvider } from './index.js';
import { resolveSlot, requiredCapabilitiesFor } from './resolver.js';
import type { Tier } from './provider.js';

/** The droplist slot the page walks: intents whose union is the required-capability set. */
export const WORKED_EXAMPLE_INTENTS = ['selection', 'anchor'] as const;

/** One impl's evaluation in the worked example — the page renders a row per candidate. */
export interface WorkedExampleCandidate {
  impl: string;
  /** Human label from the registered adapter (#206), for the page. */
  label: string;
  /** The native substrate? (The native-first tiebreak.) */
  native: boolean;
  /** No required capability is `capability-hard` here. */
  eligible: boolean;
  /** `polyfill-ok` count — the lightness cost proxy the page quotes. */
  cost: number;
  /** Required capabilities that are `capability-hard` here (why it's ineligible), in input order. */
  blockers: string[];
  /** Every (required capability → tier) considered, in input order. */
  tiers: Array<{ capabilityId: string; tier: Tier }>;
}

/** The computed native-branch worked example — the shape `capabilityWorkedExample.json` holds. */
export interface WorkedExample {
  /** Provenance, so a hand-edit of the JSON is obviously wrong (it's generated). */
  _generatedBy: string;
  intents: string[];
  /** Union of the intents' required capabilities (order-stable, de-duplicated). */
  requiredCapabilities: string[];
  /** The impl `native-first` resolves to on the shipped matrix. */
  winner: string;
  winnerLabel: string;
  /** The resolver's human-readable why (eligible → lightest → native-tiebreak). */
  reason: string;
  /** Every impl evaluated, in matrix order. */
  candidates: WorkedExampleCandidate[];
}

const GENERATED_BY =
  'capabilities/workedExample.ts — regenerate with ' +
  '`UPDATE_WORKED_EXAMPLE=1 npx vitest run worked-example-artifact` (#213)';

/**
 * Compute the native-branch worked example from the real shipped provider. Pure (no I/O) — the test
 * compares its output to the committed artifact, and (in update mode) serializes it to disk.
 */
export function buildNativeFirstWorkedExample(): WorkedExample {
  const provider = createDefaultProvider();
  const intents = [...WORKED_EXAMPLE_INTENTS];
  const requiredCapabilities = requiredCapabilitiesFor(provider, intents);
  const resolution = resolveSlot(provider, { policy: 'native-first' }, intents);
  const labelOf = new Map(provider.adapters().map((a) => [a.id, a.label]));

  return {
    _generatedBy: GENERATED_BY,
    intents,
    requiredCapabilities,
    winner: resolution.impl,
    winnerLabel: labelOf.get(resolution.impl) ?? resolution.impl,
    reason: resolution.reason,
    candidates: resolution.candidates.map((c) => ({
      impl: c.impl,
      label: labelOf.get(c.impl) ?? c.impl,
      native: c.native,
      eligible: c.eligible,
      cost: c.cost,
      blockers: c.blockers,
      tiers: c.tiers,
    })),
  };
}
