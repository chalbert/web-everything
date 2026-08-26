/**
 * @file scripts/lib/reasonless-bounce.mjs
 * @description THE REASONLESS-BOUNCE RULE (#3334) — one answer to "may this `changes` verdict be published?",
 *   in a leaf module with NO imports at all, so every sanctioned write path can hold it without inheriting a
 *   capability it must not have.
 *
 * WHAT WENT WRONG. #1572 refused a `changes` verdict carrying zero juror findings and no stated reason, and put
 * that refusal in ONE caller: `we:scripts/operations/review-pr.mjs`'s `record` step. Two other sanctioned paths
 * write the same label and carried no such check — `we:scripts/operations/record-verdict.mjs` (the transport used
 * on any host that cannot authenticate to GitHub, which on a cloud runner is every host) and
 * `we:scripts/review-set-label.mjs`'s own CLI. A real reasonless bounce landed on PR #1593: a comment reading
 * "✅ pass — no blocking findings … Findings (0) … _No findings._" directly above "Decision: `changes`", with no
 * reason anywhere. A rule enforced in one caller of a single-home function is not enforced; it is merely usually
 * encountered.
 *
 * WHY THE RULE LIVES HERE AND NOT IN THE SINGLE HOME ITSELF. `we:scripts/review-set-label.mjs` IS the single home
 * of the label swap (#2644) and `decideSetLabel` is where the refusal is DECIDED — this file states no decision,
 * it holds the predicate that decision asks. The split exists for exactly one reason: `record-verdict.mjs` is a
 * declaration whose suite asserts `importGraph(...).external` is EMPTY — it must not be able to shell out from a
 * `compute` step — and the single home reaches `node:child_process` through `computeNetDiffText`. Importing the
 * home into the declaration would have traded a capability guarantee for a rule, and the rule can be shared
 * without the trade. Importing it is what makes a second enforcement point different from a second ANSWER.
 */

/**
 * we:scripts/lib/reasonless-bounce.mjs#REASONLESS_BOUNCE_REFUSAL — the refusal text.
 *
 * A CONSTANT, NOT AN INTERPOLATION, because two other things match on it: `PRE_WRITE_REFUSALS` in
 * `we:scripts/operations/review-pr-io.mjs` (matching one PROVES nothing landed, so the effect entry is marked
 * `failed` and retried rather than left indeterminate) and the per-route tests. A refusal nobody can recognise
 * is classified as an unknown outcome, which is the fail-closed path — correct, but it costs a person.
 */
export const REASONLESS_BOUNCE_REFUSAL = 'reasonless bounce: the write-up records 0 findings and states no '
  + 'reason, so `review:changes` would park this PR behind a hold the author cannot act on — it buys a full '
  + 'round and says nothing (#3334, observed on PR #1593). Either record the findings, or state a reason '
  + '(--reason="<what must change>") so the bounce carries something to fix.';

/**
 * we:scripts/lib/reasonless-bounce.mjs#isReasonlessBounce — the predicate. PURE.
 *
 * `findingCount` IS DELIBERATELY TRI-STATE. `null`/`undefined` mean UNKNOWN — the caller could not establish how
 * many findings the juror raised — and unknown NEVER fires the refusal. Fail-open on unknown is the right way
 * round, and the negative direction is why: the whole risk of this guard is blocking a LEGITIMATE bounce, which
 * is worse than the hole it closes, and a caller with no finding count (a hand-written prose body, say) is not
 * evidence of an empty one. What closes the hole is not a fail-closed default but that every route which HAS a
 * count now passes it — asserted per route, because a shared helper one caller forgets to invoke is the exact
 * defect #3334 is about.
 *
 * THE CONDITION IS AS NARROW AS IT CAN BE. A bounce carrying ANY finding needs no reason (the findings ARE the
 * reason, and they are already rendered to the author); a bounce carrying a reason needs no findings; and no
 * target other than `changes` is touched at all.
 *
 * @param {{to?:string, findingCount?:number|null, reason?:string}} [o]
 * @returns {boolean} true iff this is a `changes` with a KNOWN zero finding count and no stated reason.
 */
export function isReasonlessBounce({ to, findingCount = null, reason = '' } = {}) {
  if (to !== 'changes') return false;
  if (findingCount === null || findingCount === undefined) return false;
  const n = Number(findingCount);
  if (!Number.isFinite(n)) return false;
  return n <= 0 && String(reason ?? '').trim() === '';
}

/**
 * we:scripts/lib/reasonless-bounce.mjs#RENDERED_FINDINGS_HEADING — the `### Findings (N)` heading
 * `we:scripts/lib/review-render.mjs#renderPanelComment` emits. Already parsed on the READING side by
 * `we:scripts/review-corpus/mine-review-corpus.mjs`; named here so the two sides can be compared rather than
 * each carrying its own copy of the shape.
 */
export const RENDERED_FINDINGS_HEADING = /^#{2,6}\s+Findings\s+\((\d+)\)\s*$/m;

/**
 * we:scripts/lib/reasonless-bounce.mjs#bounceEvidenceFromWriteUp — read the two decision inputs back out of the
 * write-up a caller is about to publish. PURE.
 *
 * WHY THE BODY IS A SOURCE AT ALL. The label CLI never sees the juror's verdict object; it sees the rendered
 * write-up, which is also the only thing the author will read. `we:scripts/operations/review-pr-io.mjs`'s label
 * sink builds argv with `--body-file=` and NO `--reason` — `renderVerdictWriteUp` renders the operator's reason
 * INTO the body — so a guard that consulted only the `--reason` flag would refuse a bounce that does carry one.
 * That false refusal is the failure mode this function exists to avoid.
 *
 * `findingCount` IS `null` WHEN THE BODY CARRIES NO RENDERED HEADING. That case is a hand-written body, and a
 * hand-written body IS the statement of what to fix; the pre-existing #xd6moh1 guard already refuses an empty
 * one. Only a RENDERED write-up can assert "zero findings", so only a rendered one can be reasonless.
 *
 * THE REASON IS ANY NON-EMPTY TOP-LEVEL BLOCKQUOTE. `renderPanelComment` emits none of its own — its finding
 * lines are bullets and its panel verdicts are a pipe table — and with zero findings it emits no finding lines
 * at all. So in the one body shape this is ever consulted for, a `>` line is the operator's quoted reason and
 * nothing else. It is read as a PRESENCE signal, not parsed for meaning.
 *
 * @param {string} body - the rendered verdict write-up.
 * @returns {{findingCount:number|null, reason:string}}
 */
export function bounceEvidenceFromWriteUp(body) {
  const text = String(body ?? '');
  const m = RENDERED_FINDINGS_HEADING.exec(text);
  const quoted = text.split('\n').filter((l) => /^\s{0,3}>\s*\S/.test(l)).join('\n').trim();
  return { findingCount: m ? Number(m[1]) : null, reason: quoted };
}
