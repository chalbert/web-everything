/**
 * @file webcases/generateCase.ts
 * @description Conformance-case generator (backlog #868) — the **AI-proposes** front-end that
 *   `compileRequirement.ts` explicitly defers to: *"requirements that don't ground are the AI
 *   test-generator's domain (a Plateau-served provider, #475 no-leakage)."* It closes the
 *   AI-proposes/standard-verifies loop for webcases: a natural-language description becomes a typed
 *   `RequirementRecord`, the **deterministic** `validateRequirement` (slice A, #100) grounds it against
 *   the live registries, and only a grounded record is projected to webcase(s) by `compileRequirement`
 *   (slice B, #797) — feeding docs + tests + the conformance badge from the same source of truth.
 *
 * The "AI" never lives here. The proposer is an **injected** seam (`RequirementProposer`): a
 * Plateau-served provider at dev time (#475 no-leakage — the standard imports no AI SDK, only consumes
 * the proposer's output). The deterministic validator is the authority — an AI proposal that doesn't
 * ground is **rejected, not trusted** (the #095 autofix precedent: AI proposes, the suite verifies).
 * On rejection the verifier's slot-pointed findings are fed back to the proposer for a bounded retry,
 * so grounding *steers* generation rather than just gating it.
 *
 * This core is pure orchestration over injected pieces — no I/O, no clock, no `_data` coupling — so the
 * full propose→verify→compile loop is unit-tested offline with a stub proposer. A real run wires the
 * Plateau proposer; `heuristicProposer` is a dependency-free fallback that grounds a description which
 * names real registry ids, useful for the offline demo + tests.
 */
import {
  validateRequirement,
  type RequirementRecord,
  type RequirementRegistries,
  type RequirementValidation,
  type RequirementFinding,
} from './requirementValidator';
import { compileRequirement, type WebCase } from './compileRequirement';

/**
 * The injected "AI proposes" seam. A Plateau-served provider (#475) maps a natural-language description
 * to a candidate typed record; on a retry it receives the prior verifier findings so it can correct the
 * exact slots that failed to ground. NEVER an imported SDK — the standard only consumes its output.
 */
export interface RequirementProposer {
  (nl: string, ctx: {
    registries: RequirementRegistries;
    /** Slot-pointed findings from the previous attempt's verification (empty on the first attempt). */
    previousFindings: readonly RequirementFinding[];
  }): Promise<RequirementRecord> | RequirementRecord;
}

/** One propose→verify round — the record the AI proposed and what the standard made of it. */
export interface GenerationAttempt {
  readonly record: RequirementRecord;
  readonly validation: RequirementValidation;
}

/** The generation outcome: the accepted (or last) attempt, the compiled cases, and the full audit trail. */
export interface GenerateResult {
  readonly accepted: boolean;
  readonly record: RequirementRecord;
  readonly validation: RequirementValidation;
  /** Empty unless `validation.valid` — the standard never compiles an ungrounded proposal. */
  readonly cases: readonly WebCase[];
  /** Every propose→verify round, oldest first (the AI-proposes/standard-verifies audit trail). */
  readonly attempts: readonly GenerationAttempt[];
}

/**
 * Generate conformance webcase(s) from a natural-language description: AI proposes, the standard
 * verifies, and only a grounded record compiles. Re-proposes up to `maxAttempts` times, feeding each
 * round's findings back to the proposer, then stops at the first grounded record (or returns the last
 * rejected one, `accepted:false`, with its findings for the caller to surface).
 */
export async function generateCase(
  nl: string,
  { propose, registries, maxAttempts = 3 }: {
    propose: RequirementProposer;
    registries: RequirementRegistries;
    maxAttempts?: number;
  },
): Promise<GenerateResult> {
  const attempts: GenerationAttempt[] = [];
  let previousFindings: readonly RequirementFinding[] = [];

  for (let i = 0; i < Math.max(1, maxAttempts); i++) {
    const record = await propose(nl, { registries, previousFindings });
    const validation = validateRequirement(record, registries);
    attempts.push({ record, validation });
    if (validation.valid) {
      return { accepted: true, record, validation, cases: compileRequirement(record), attempts };
    }
    previousFindings = validation.findings;
  }

  // Exhausted attempts without grounding — return the last proposal, rejected, for the caller to report.
  const last = attempts[attempts.length - 1];
  return { accepted: false, record: last.record, validation: last.validation, cases: [], attempts };
}

/**
 * A dependency-free fallback proposer — NOT the AI. It grounds a description that *names* real registry
 * ids by scanning the injected registries for an id/term/value that appears (case-insensitively) in the
 * text, falling back to each registry's first entry. Deterministic; useful for the offline demo and as
 * a test double. A real generator injects the Plateau provider instead.
 */
export function heuristicProposer(nl: string, { registries }: { registries: RequirementRegistries }): RequirementRecord {
  const hay = nl.toLowerCase();
  const mentions = (s: string) => s.length > 0 && hay.includes(s.toLowerCase());

  const intent = registries.intents.find((i) => mentions(i.id)) ?? registries.intents[0];
  const dimNames = intent ? Object.keys(intent.dimensions ?? {}) : [];
  const dimension = dimNames.find((d) => mentions(d)) ?? dimNames[0] ?? '';
  const values = (intent?.dimensions?.[dimension]?.values ?? []) as readonly string[];
  const value = values.find((v) => mentions(v)) ?? values[0] ?? '';

  const term = registries.semantics.find((t) => mentions(t.term))?.term ?? registries.semantics[0]?.term ?? '';
  const protocol = registries.protocols.find((p) => mentions(p.id))?.id ?? registries.protocols[0]?.id ?? '';

  return {
    description: nl.trim(),
    given: { intent: intent?.id ?? '', dimension, value },
    when: { event: term },
    then: { protocol, observe: 'state-observed', tier: 'L1' },
  };
}
