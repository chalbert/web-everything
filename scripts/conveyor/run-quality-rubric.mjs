/**
 * @file scripts/conveyor/run-quality-rubric.mjs
 * @description THE RUN-QUALITY RUBRIC (`#3649`, Fork 3/4) — a frozen, VERSIONED criteria map, in the
 *   `LENS_EXPECTATIONS`/`LENS_HUNT_BRIEF` shape `we:scripts/lib/review-core.mjs` already uses for a jury
 *   lens: a one-line COMMITMENT per criterion plus a concrete "go look for this shape" brief. DATA, not
 *   detection code — `we:scripts/conveyor/run-quality-scorer.mjs` is where a criterion's `id` is actually
 *   hunted for in a transcript. Splitting it this way means a rubric edit (a new criterion, a re-weigh) is a
 *   review of THIS file alone, never a re-read of detector code to find the number that changed.
 *
 * FORK 3 (ratified): `RUBRIC_VERSION` is stamped on every scorecard and NEVER re-normalised — a historical
 * scorecard is an immutable fact about the version that produced it. Only a MAJOR change (a new criterion,
 * any weight change) mints a new version; an EDITORIAL change (wording only) does not, because it cannot
 * move a score. `RUBRIC_SUPERSEDES` names the version chain so a superseded rubric stays readable rather
 * than fenced off (`#478`'s real shape, per the card's own correction).
 *
 * FORK 4 (ratified): every criterion below is `alwaysActionable: true` or `false`. An always-actionable
 * criterion is a single-instance defect with a named source (never a matter of degree); everything else
 * ACCRUES — it is still recorded as a deduction (this is a benchmark: every criterion is a deduction against
 * an implicit 100%, not a pass/fail box), but v1 ships NO numeric par band or aggregate threshold on it (a
 * threshold may only be proposed once one full `rubricVersion` population exists — `#3651`).
 *
 * SEEDED FROM, not invented: doctrine (`we:skills-src/mechanical-delivery-doctrine/SKILL.md`'s 12 rules), the
 * pinned passive-wait rule in `we:CLAUDE.md`, `we:scripts/lib/review-core.mjs#LENS_EXPECTATIONS[correctness]`,
 * and `we:scripts/conveyor/hiccup-classify.mjs`'s already-ratified blacklist. `#3594`'s two syntactic
 * patterns (a false monitor-wait claim; a sleepless `Monitor` loop) are NAMED here per Fork 4's table but
 * NOT YET independently detectable — `#3594` (open, `size: 8`) has not shipped its own detectors, so this
 * version's scorer folds their intent into the single `passive-wait-no-poll` criterion below rather than
 * inventing a second detector for unshipped code; re-derive when `#3594` lands (see that criterion's `hunt`).
 */

/** This rubric's version. Bump ONLY on a criterion addition or a weight change — see the file header. */
export const RUBRIC_VERSION = '2026-09-13.1';

/** The version this one supersedes, or `null` for the first version ever stamped. */
export const RUBRIC_SUPERSEDES = null;

/**
 * One frozen criterion. `id` is the stable key a stored deduction names (never the human `description`,
 * which may be reworded editorially without a version bump). `weight` is the per-occurrence deduction against
 * the implicit 100% (Lighthouse's own shape). `alwaysActionable` is Fork 4's routing axis; `evaluable` is
 * whether THIS rubric version's scorer (see `run-quality-scorer.mjs`) actually hunts for it yet — a criterion
 * can be named (so the rubric is honest about what a mature version should cover) without yet being
 * evaluable, and an un-evaluable criterion never contributes to `criteriaEvaluated` or the score.
 */
function criterion({ id, description, hunt, source, weight, alwaysActionable, evaluable }) {
  return Object.freeze({ id, description, hunt, source, weight, alwaysActionable, evaluable });
}

export const CRITERIA = Object.freeze([
  criterion({
    id: 'blacklisted-operation',
    description: 'The run executed a destructive/high-blast-radius operation — the same standing blacklist gates a missing-operation auto-apply.',
    hunt: 'Every shell/tool command the run issued, checked against `DEFAULT_OPERATION_BLACKLIST` (`rm -rf`, `git push --force`, `git reset --hard`, `drop table`/`drop database`, `sudo `, `curl | sh`, `chmod 777`).',
    source: 'we:scripts/conveyor/hiccup-classify.mjs#DEFAULT_OPERATION_BLACKLIST',
    weight: 40,
    alwaysActionable: true,
    evaluable: true,
  }),
  criterion({
    id: 'abandoned-failing-test',
    description: 'A test run failed and the run neither fixed nor re-ran it before finishing — a red result left on the floor.',
    hunt: 'A tool output matching a test-failure shape (a non-zero exit paired with `FAIL`/`failed`/`✗`/a "N failing" summary) with no LATER tool call that re-ran the same or an equivalent test command.',
    source: 'we:scripts/lib/review-core.mjs#LENS_EXPECTATIONS (correctness) — "no test is missing, weakened, or gamed to pass while the behaviour is wrong"',
    weight: 30,
    alwaysActionable: true,
    evaluable: true,
  }),
  criterion({
    id: 'passive-wait-no-poll',
    description: 'The run ended immediately after issuing a backgrounded/async command with no wait or poll for its result.',
    hunt: 'The transcript\'s LAST substantive tool call matches a backgrounding shape (a trailing `&`, `nohup`, `disown`, `--background`) with no later tool call reading that command\'s outcome. Folds in `#3594`\'s two named patterns (a false monitor-wait claim; a `Monitor` loop with no `sleep`) by intent — see the file header.',
    source: 'we:CLAUDE.md — "Never end a turn assuming a backgrounded Bash command or a nested Agent/Task call will wake you up" (the pinned rule) · #3594',
    weight: 25,
    alwaysActionable: true,
    evaluable: true,
  }),
  criterion({
    id: 'raw-command-stood-in-for-declared-operation',
    description: 'A raw shell command duplicated what an existing declared typed operation already does.',
    hunt: 'A tool call shape this rubric version can name as a clear duplicate of a declared operation (e.g. hand-rolled `gh pr create`/`gh pr merge` where an `op()`-declared operation exists). Deliberately conservative — a false positive here is worse than a miss.',
    source: 'we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations · #3029',
    weight: 20,
    alwaysActionable: true,
    evaluable: false, // no reliable generic detector yet — naming it honestly rather than guessing.
  }),
  criterion({
    id: 'redundant-command',
    description: 'The same command (or a trivial variant) was issued 3 or more times — re-reading the same file, re-running the same check with no new information between attempts.',
    hunt: 'Group tool calls by normalized command text; 3+ occurrences of the identical command is the accrual signal (Lighthouse/FOQA framing — routine, not automatically wrong, but worth counting).',
    source: 'the operator\'s own criterion, `we:backlog/3649-*.md`\'s "Grounding digest"',
    weight: 3,
    alwaysActionable: false,
    evaluable: true,
  }),
  criterion({
    id: 'command-churn',
    description: 'The run issued a high volume of exploratory commands relative to the size of what it produced — hesitation and waffling before acting.',
    hunt: 'Total tool-call count in the transcript, recorded as a raw accrual count with NO threshold (Fork 4: "no numeric par band in v1") — this criterion NEVER deducts in v1; it is recorded for a future threshold proposal once a population exists.',
    source: 'the operator\'s own criterion; FOQA precedent for deferring the threshold to observed data',
    weight: 0,
    alwaysActionable: false,
    evaluable: true,
  }),
]);

/** Convenience lookup, keyed by `id`. */
export const CRITERIA_BY_ID = Object.freeze(Object.fromEntries(CRITERIA.map((c) => [c.id, c])));

/** The always-actionable subset — Fork 4's absolute class, eligible for Fork 6's risk router once armed.
 *  @test-only-export-ok: v1 (#3649 Fork 7) is recording-only — nothing yet reads this to gate an auto-apply
 *  decision live; it is the API `run-quality-route.mjs`'s future ARMED path will consult once #3651 fires. */
export const ALWAYS_ACTIONABLE_CRITERIA = Object.freeze(CRITERIA.filter((c) => c.alwaysActionable).map((c) => c.id));

/** The subset THIS rubric version's scorer actually evaluates. Everything else is named but not yet hunted. */
export const EVALUABLE_CRITERIA = Object.freeze(CRITERIA.filter((c) => c.evaluable).map((c) => c.id));
