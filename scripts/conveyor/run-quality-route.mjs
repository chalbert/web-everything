/**
 * @file scripts/conveyor/run-quality-route.mjs
 * @description THE RUN-QUALITY ROUTER (`#3649` Fork 6/7) — BUILT, but DISARMED for v1. Fork 7's ruling:
 *   "the router is built but disarmed behind a single flag, flipped only once one complete `rubricVersion`
 *   population exists" (tracked separately as `#3651`). {@link RUN_QUALITY_ROUTER_ARMED} is that flag, and it
 *   is a literal `false` here — not an env var, not a config read — so arming it is a deliberate, reviewed
 *   CODE CHANGE to this file, never an accidental environment flip.
 *
 * FORK 5 RUNS FIRST, UNCONDITIONALLY, BEFORE THE ARM FLAG IS EVEN CONSULTED. A `driver`-class subject is
 * report-only ALWAYS, regardless of the arm flag's value — the flag governs whether a `work-agent` finding
 * MAY auto-apply once armed; it never overrides the subject-class gate, and this function refuses to let it.
 *
 * FORK 6's AXIS: a risk assessment of the PROPOSED FIX ITSELF (`we:scripts/conveyor/
 * hiccup-classify.mjs#assessMissingOperationConfidence`), blacklist checked first and independently of any
 * confidence judgment — NEVER `#3422`'s blocking/non-blocking dial, which the card's own ruling names as
 * provably the wrong axis for a run that already succeeded. `flaggedCriteria` is REQUIRED on a proposed fix
 * (not optional) so a non-command fix (a doc/brief edit) still keeps `blastRadius`/`baselineCorrectness`
 * operative rather than being vacuously "clean" against a blacklist built for shell commands.
 *
 * A DEDUCTION WITH NO `proposedFix` NEVER ROUTES — it is a recording-only finding (this rubric version's
 * `command-churn`/`redundant-command` accrual criteria, and every currently-`evaluable` always-actionable
 * criterion too, since no criterion in THIS rubric version yet generates an executable fix — see
 * `run-quality-rubric.mjs`). So today, even with `RUN_QUALITY_ROUTER_ARMED` flipped by hand, this router
 * routes NOTHING for the two subjects this build targets — proven in `__tests__/run-quality-route.test.mjs`.
 * That is not a bug: Fork 7 exists precisely because auto-apply should not run ahead of a rubricVersion
 * population, and the honest state today is "no criterion has an executable fix yet either."
 */

import { assessMissingOperationConfidence } from './hiccup-classify.mjs';
import { fileRunQualityFinding } from './run-quality-sink.mjs';

/** Fork 7 — a literal `false`. Flip this via a reviewed code change once `#3651`'s trigger fires; never via
 *  an environment variable (an accidental env flip must not be able to arm auto-apply). */
export const RUN_QUALITY_ROUTER_ARMED = false;

/**
 * Route one SCORED transcript's deductions. For each deduction that carries a `proposedFix`:
 *   - subject is `driver`-class ⇒ ALWAYS report-only (filed, never applied), whatever the arm flag says.
 *   - subject is `work-agent` AND the router is armed ⇒ Fork 6's risk dial decides self-clears/batched/escalate.
 *   - subject is `work-agent` AND the router is DISARMED (v1's real state) ⇒ filed, same as `driver`.
 * A deduction with no `proposedFix` is a recording-only criterion and never reaches the sink at all.
 *
 * @param {{item?:string, handle?:string, subjectClass:'work-agent'|'driver', deductions:object[]}} scorecard
 * @param {{armed?:boolean, applyThroughOperation?:Function, assessRisk?:Function, fileFinding?:Function}} [deps]
 * @returns {{filed:object[], applied:object[]}}
 * @test-only-export-ok: v1 (#3649 Fork 7) ships the router built but disarmed — no permanent caller invokes
 *   it yet by design; #3651 is the tracked follow-on to wire a real caller once the arm trigger fires.
 */
export function routeScorecard(scorecard, {
  armed = RUN_QUALITY_ROUTER_ARMED,
  applyThroughOperation = () => { throw new Error('run-quality-route: applyThroughOperation has no real implementation yet — the router is disarmed in v1 and this must never be reached; see the file header'); },
  assessRisk = assessMissingOperationConfidence,
  fileFinding = fileRunQualityFinding,
} = {}) {
  const filed = [];
  const applied = [];
  const reportOnly = scorecard?.subjectClass !== 'work-agent'; // Fork 5 — checked FIRST, no deduction's own risk verdict can override it.

  for (const d of scorecard?.deductions ?? []) {
    if (!d.proposedFix) continue; // recording-only criteria never route (see file header).
    const risk = assessRisk({
      call: d.proposedFix.command ?? '',
      criteria: d.proposedFix.flaggedCriteria, // REQUIRED on a real proposedFix — see file header.
    });
    if (armed && !reportOnly && risk.selfClears) {
      applyThroughOperation(d.proposedFix.operation, d.proposedFix.input);
      applied.push({ criterion: d.criterion, risk });
      continue;
    }
    const stored = fileFinding({
      summary: d.evidence,
      area: d.criterion,
      proposedFix: d.proposedFix,
      approvalPending: true,
      blocking: risk.escalate,
      dedupKey: `${scorecard.item ?? scorecard.handle ?? 'unknown'}:${d.criterion}`,
    }, { session: scorecard.handle });
    if (stored) filed.push(stored);
  }
  return { filed, applied };
}
