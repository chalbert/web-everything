/**
 * @file scripts/conveyor/run-quality-subject-class.mjs
 * @description Fork 5 of `#3649`, ratified: the SUBJECT-CLASS gate — stamped at the point a dispatch is
 *   KNOWN (never inferred afterward from the transcript). A driver/conveyor-class subject is report-only,
 *   ALWAYS, regardless of how clean a finding looks; a bounded one-off work agent is eligible for the normal
 *   risk router once armed (Fork 6/7 — disarmed for all classes in v1 regardless).
 *
 * WHY STAMPED, NOT INFERRED (the card's own finding, re-verified here rather than re-derived): `LAUNCH_KINDS`
 * (`we:scripts/operations/dispatch-lane.mjs`) is `['build','prepare','prepare-decision','fix','ci-heal']` —
 * `review` and `investigation` dispatches are real but absent from it, so an enumeration built off that
 * constant alone would misclassify them. The caller ALREADY knows what it launched (it is the one deciding
 * to launch it), so the class is a fact supplied at the call site, never re-derived from what the transcript
 * happens to contain.
 *
 * THIS BUILD'S TWO SUBJECTS. Codex's `fix`-kind delivery dispatch and its advisory-review judge seat are both
 * a "bounded one-off work agent... that ran and finished" (the card's own Fork 5 wording) — neither queues,
 * dispatches, or supervises other work, so both are `work-agent`, never `driver`.
 */

/** The kinds a caller may name as a bounded one-off work agent — Fork 5's own enumerated list, not derived
 *  from `LAUNCH_KINDS` (which is missing `review`/`investigation` for a reason unrelated to this gate). */
export const WORK_AGENT_KINDS = Object.freeze(['build', 'fix', 'prepare', 'prepare-decision', 'ci-heal', 'review', 'investigation']);

/**
 * Stamp the subject class for a dispatch whose `kind` is known at the call site. PURE.
 *
 * @param {{kind?: string|null}} o - `kind` absent/unknown ⇒ `driver` (fail-closed default per Fork 5: "no
 *   dispatch record ⇒ driver-class").
 * @returns {'work-agent'|'driver'}
 * @test-only-export-ok: real call sites (`we:scripts/operations/dispatch-lane-io.mjs`'s launch stamp, per
 *   this build's own header) are owed follow-on wiring — proven against a REAL Codex `fix` dispatch and
 *   advisory-review call by a scratch integration script this session, not yet a permanent repo call site.
 */
export function classifySubject({ kind } = {}) {
  return WORK_AGENT_KINDS.includes(kind) ? 'work-agent' : 'driver';
}
