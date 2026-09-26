/**
 * @file scripts/conveyor/delegation-trial-gate.mjs
 * @description #3690 progressive backdown bar for INTERACTIVE session-delegation trials — is this
 *   {provider, model, taskType} triple graduated to spot-check supervision, computed fresh from the caller's
 *   store. No IO.
 *
 * #3949 — THIS NO LONGER RE-DERIVES THE BAR. Before this fix the function kept its own copy of the streak
 * threshold (a hard-coded `>= 5`) and inferred "informative" from free-text `findings` presence, which
 * disagreed with `platform-decisions.md#delegation-trial-record-graduation` rule 4 (informative is its OWN
 * recorded field, never inferred from `findings`) and rule 1 (every reader of the record uses the SAME
 * predicates). It now delegates straight to `we:scripts/lib/provider-routing.mjs#selectSupervisionLevel` —
 * the same function a mechanical dispatch's provider cascade reads — with the SAME `DEFAULT_BACKDOWN_THRESHOLDS`
 * (so a future retune of `minCleanStreak`/`k` in one place moves both readers), and treats "graduated" as
 * "the router would approve spot-check supervision for this triple today".
 *
 * Filtered to `dispatchKind: 'session-delegation'` rows only, matching the pre-#3949 behaviour: a mechanical
 * dispatch trial for the same identity strings is a DIFFERENT evidence pool (a different dispatch path), never
 * mixed into this gate's decision.
 */
import { selectSupervisionLevel, DEFAULT_BACKDOWN_THRESHOLDS, SUPERVISION_LEVELS } from '../lib/provider-routing.mjs';

/**
 * @param {{provider:string, model:string, taskType:string, subjectClass?:string}} triple - `subjectClass`
 *   defaults to `'work-agent'`, the only subject class session-delegation trials are logged under today
 *   (#3801 Fork 3 reserves other subject classes for role dispatches, which this gate never sees).
 * @param {{records: object[]}} store
 * @returns {boolean}
 */
// @test-only-export-ok: #3949 removed this gate's only production importer (review-set-label.mjs no longer
// stops logging at graduation — see the file header). Kept exported, not deleted, because the graduation READ
// this computes is still the one an interactive orchestrating session needs for its OWN inline supervision-
// depth call (platform-decisions.md, delegation-trial-record-graduation's Reach clause: the router may inform
// that verdict, never replace it) — a session asking whether a triple has earned a lighter check calls this,
// not a re-derivation. Today only this module's own test exercises it.
export function isDelegationTripleGraduated({ provider, model, taskType, subjectClass = 'work-agent' }, store) {
  const sessionDelegationRows = (store?.records ?? []).filter((r) => r && r.dispatchKind === 'session-delegation');
  const { level } = selectSupervisionLevel(
    provider, model, taskType, sessionDelegationRows, DEFAULT_BACKDOWN_THRESHOLDS, subjectClass,
  );
  return level === SUPERVISION_LEVELS.SPOT_CHECK;
}
