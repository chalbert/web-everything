/**
 * @file scripts/lib/dispatch-task-type.mjs
 * @description THE `taskType` DERIVATION (#3717) — one pure table turning a DISPATCH (its kind, its cause and
 *   its declared scope) into the router's `taskType`, or into a named REFUSAL. Nothing here reads a brief, a
 *   model's opinion or a human's sentence.
 *
 * ── WHY THIS FILE IS THE WHOLE POINT OF #3717 ───────────────────────────────────────────────────────────────
 *
 * `we:scripts/lib/provider-routing.mjs#selectProvider` reads `taskType` from its caller and silently defaults
 * it to `bugfix` (`task?.taskType || 'bugfix'`). A router fed a GUESSED `taskType` is exactly as mechanical as
 * the guess — which is to say, not at all. The operator's acceptance test for #3717 is:
 *
 *   > **no model judgment anywhere between the dispatch kind and the chosen provider** (2026-09-19).
 *
 * So the `taskType` must be DERIVED from facts the machinery already holds at dispatch time, and a dispatch
 * whose `taskType` cannot be derived is REFUSED with a named reason rather than routed on a default. This
 * module is that derivation and nothing else: it makes no provider choice, loads no scorecards and calls no
 * router. {@link ../lib/dispatch-contracts.mjs#decideDispatchRoute} is the one thing that composes it with
 * `routeDispatch`.
 *
 * ── THE THREE OUTCOMES, AND WHY THERE ARE THREE RATHER THAN TWO ─────────────────────────────────────────────
 *
 *   | outcome      | means                                                                      |
 *   |--------------|----------------------------------------------------------------------------|
 *   | `task-type`  | a code-change dispatch: `taskType` is derived and the router may see it     |
 *   | `role`       | an authoring or judging dispatch: it has NO router `taskType`, by nature    |
 *   | `refused`    | nothing in the table produces a `taskType` for this dispatch — fail closed  |
 *
 * `role` is NOT a refusal and NOT a `taskType`. #3717's own table says so in its last row: `review`, `prepare`
 * and `prepare-decision` are "authoring or judging roles, not code changes". Collapsing them into `other`
 * would hand `selectProvider` a fabricated code-change envelope for work that changes no code; collapsing them
 * into a refusal would stop the conveyor dispatching the three kinds it dispatches most. The honest answer is
 * that the question does not apply, so the route is taken WITHOUT consulting the provider cascade at all.
 *
 * ── THE TABLE (#3717's own, verbatim; `investigate` added because this branch dispatches it) ────────────────
 *
 *   | dispatch                              | taskType            | why                                      |
 *   |---------------------------------------|---------------------|------------------------------------------|
 *   | `build`, scope is ALL doc paths       | `doc-fix`           | derived from the item's scope, not kind  |
 *   | `build`                               | `build-new-feature` | `BRIEF_REQUIRED_BY_KIND.build`           |
 *   | `fix`, cause `conflict`               | `conflict-resolution` | a CAUSE, not a kind (#3717)            |
 *   | `fix`                                 | `bugfix`            | derivable                                |
 *   | `ci-heal`                             | `bugfix`            | derivable                                |
 *   | `prepare`, `prepare-decision`         | (role)              | authoring, changes no product code       |
 *   | `investigate`                         | (role)              | triage-research, changes no product code |
 *   | `review`                              | (role)              | judging, changes no product code         |
 *   | anything else                         | REFUSED             | never guessed                            |
 *
 * ── THE THREE `taskType`s WITH NO PRODUCING DISPATCH KIND ───────────────────────────────────────────────────
 *
 * {@link TASK_TYPES_WITHOUT_PRODUCING_KIND}. `self-fix` and `other` are UNREACHABLE from this derivation —
 * no kind, and no cause, produces either, which is deliberate: `other` is the catch-all `selectProvider`'s
 * own scorecards are full of, and routing on it would be routing on "we did not know". `conflict-resolution`
 * is reachable ONLY through a cause (`we:scripts/conveyor/reconcile-fix-dispatch.mjs` reads the
 * `merge-status:conflicting` label), never through a kind. Its own test asserts each of these.
 *
 * PURE. No fs, no clock, no process, no network. Everything is data handed in.
 */

/** A dispatch kind that changes code, and therefore has a router `taskType`. */
export const CODE_CHANGE_DISPATCH_KINDS = Object.freeze(['build', 'fix', 'ci-heal']);

/**
 * A dispatch kind that AUTHORS or JUDGES rather than changing product code. It takes the role path: no
 * `taskType`, and the provider cascade is never consulted for it. See the file docblock for why this is a
 * third outcome rather than a `taskType` or a refusal.
 */
export const ROLE_DISPATCH_KINDS = Object.freeze(['prepare', 'prepare-decision', 'investigate', 'review']);

/**
 * THE CLOSED CAUSE VOCABULARY. A cause is WHY a dispatch of a given kind was made — the axis #3717 names as
 * distinct from the kind. An UNKNOWN non-empty cause is REFUSED rather than ignored: a caller that had a
 * reason the table does not know about is a caller whose `taskType` this module cannot honestly derive.
 */
export const DISPATCH_CAUSES = Object.freeze(['conflict', 'review-finding', 'ci-failure']);

/** The cause `we:scripts/conveyor/reconcile-fix-dispatch.mjs` reports for a `merge-status:conflicting` bounce. */
export const CONFLICT_CAUSE = 'conflict';

/**
 * Router `taskType`s that NO dispatch kind produces, each with the reason. Exported so the derivation's own
 * test can assert the negative rather than trusting a comment, and so the generated routing table
 * (`we:scripts/gen-dispatch-routing-table.mjs`) prints the gap instead of hiding it.
 */
export const TASK_TYPES_WITHOUT_PRODUCING_KIND = Object.freeze({
  'self-fix': 'no dispatch kind produces it: nothing in the conveyor dispatches an agent to repair its own output',
  other: 'the catch-all; routing on it would be routing on "we did not know what this was"',
  'conflict-resolution': 'no KIND produces it — only the `conflict` CAUSE on a `fix` dispatch does',
});

/**
 * WHICH PATHS COUNT AS DOCUMENTATION for the all-docs `build` → `doc-fix` rule. Deliberately tight and
 * auditable rather than clever: a markdown/text file anywhere, or anything under `docs/`. A `build` whose
 * declared `scope:` is entirely these paths writes prose, and `doc-fix` is the envelope the router has trial
 * history for (100 LOC / 2 files) — see `provider-routing.mjs#PROVEN_TASK_ENVELOPES`.
 *
 * Widening this table widens what may be routed as a doc change, so it is a table, not a regex to tweak.
 */
export const DOC_PATH_SUFFIXES = Object.freeze(['.md', '.mdx', '.markdown', '.txt']);
/** Directory prefixes whose every file counts as documentation. */
export const DOC_PATH_PREFIXES = Object.freeze(['docs/']);

/**
 * Strip the repo qualifier a declared `scope:` path carries (`we:scripts/x.mjs`, `frontierui:src/y.ts`) and
 * the `./` a hand-written one sometimes does, leaving the repo-relative path. Mirrors
 * `dispatch-contracts.mjs#deriveDispatchProfile`'s own normalisation so the two never disagree about what a
 * scope path IS.
 *
 * @param {string} entry
 * @returns {string}
 */
export function normalizeScopePath(entry) {
  return String(entry ?? '').trim()
    .replace(/^we:/, '')
    .replace(/^([A-Za-z0-9._-]+):/, '$1/')
    .replace(/^\.\//, '');
}

/**
 * Is this scope path a documentation path? See {@link DOC_PATH_SUFFIXES} / {@link DOC_PATH_PREFIXES}.
 *
 * @param {string} entry - a raw or repo-qualified scope path.
 * @returns {boolean}
 */
export function isDocScopePath(entry) {
  const path = normalizeScopePath(entry).toLowerCase();
  if (!path) return false;
  if (DOC_PATH_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p))) return true;
  return DOC_PATH_SUFFIXES.some((s) => path.endsWith(s));
}

/**
 * THE DERIVATION. Pure, total, and the ONLY place a dispatch becomes a router `taskType`.
 *
 * @param {{kind?: string, cause?: string|null, scopePaths?: string[]}} dispatch
 *   - `kind`   the dispatch kind (`we:scripts/operations/dispatch-lane.mjs#LAUNCH_KINDS`, or `review`).
 *   - `cause`  why this dispatch was made ({@link DISPATCH_CAUSES}); `null`/`''`/absent means "no cause given".
 *   - `scopePaths` the dispatch's declared scope, repo-qualified or not.
 * @returns {{outcome: 'task-type'|'role'|'refused', taskType: string|null, role: string|null, reason: string}}
 */
export function taskTypeFor({ kind, cause, scopePaths } = {}) {
  const k = String(kind ?? '').trim();
  const rawCause = cause == null ? '' : String(cause).trim();
  const paths = Array.isArray(scopePaths) ? scopePaths.map(String).filter((p) => p.trim()) : [];

  if (!k) {
    return refuse('a dispatch with no kind has no derivable taskType — the kind is the first column of the table');
  }
  if (rawCause && !DISPATCH_CAUSES.includes(rawCause)) {
    return refuse(
      `cause ${JSON.stringify(rawCause)} is not one of ${DISPATCH_CAUSES.join(', ')} — a cause the table does `
      + 'not know about cannot be mapped to a taskType, and guessing one is exactly what #3717 forbids',
    );
  }

  if (ROLE_DISPATCH_KINDS.includes(k)) {
    return {
      outcome: 'role',
      taskType: null,
      role: k,
      reason: `${k} is an authoring or judging role, not a code change: it has no router taskType and takes the `
        + 'role path, so the provider cascade is never consulted for it (#3717)',
    };
  }

  if (k === 'fix' && rawCause === CONFLICT_CAUSE) {
    return derived('conflict-resolution', 'a `fix` dispatched because a bounce was conflict-caused — the CAUSE, not the kind, produces this taskType');
  }
  if (k === 'fix' || k === 'ci-heal') {
    return derived('bugfix', `\`${k}\` repairs code an earlier build already wrote`);
  }
  if (k === 'build') {
    if (paths.length && paths.every(isDocScopePath)) {
      return derived('doc-fix', `every declared scope path is documentation (${paths.length} path(s)) — derived from the item's scope, not its kind`);
    }
    if (!paths.length) {
      return refuse(
        'a `build` dispatch with no declared scope cannot be told apart from a documentation build — '
        + '`doc-fix` is derived from the scope, so an empty scope has no derivable taskType',
      );
    }
    return derived('build-new-feature', 'a `build` dispatch over at least one non-documentation path');
  }

  return refuse(
    `no row of the #3717 derivation table produces a taskType for dispatch kind ${JSON.stringify(k)} — `
    + `code-change kinds are ${CODE_CHANGE_DISPATCH_KINDS.join(', ')} and role kinds are `
    + `${ROLE_DISPATCH_KINDS.join(', ')}. Refusing rather than defaulting to \`bugfix\` or \`other\``,
  );
}

function derived(taskType, why) {
  return { outcome: 'task-type', taskType, role: null, reason: `${taskType}: ${why}` };
}
function refuse(reason) {
  return { outcome: 'refused', taskType: null, role: null, reason };
}

/**
 * THE TABLE AS DATA — every row of the derivation, in the order {@link taskTypeFor} applies them, for the
 * generated routing table (`we:scripts/gen-dispatch-routing-table.mjs`) and for the derivation's own test to
 * drive rather than restate. Each row names a concrete example dispatch, so the table is EXECUTED rather than
 * described: the test runs `taskTypeFor(row.example)` and asserts it produces `row.outcome`/`row.taskType`.
 *
 * @type {ReadonlyArray<Readonly<{example: object, outcome: string, taskType: string|null, note: string}>>}
 */
// The published routing table (we:scripts/gen-dispatch-routing-table.mjs) keeps its OWN row list, because it
// needs display labels and a size this derivation has no opinion about; both lists are checked against
// LAUNCH_KINDS by their own tests, so neither can silently drop a kind.
// @test-only-export-ok: the table IS the specification — its consumer is the test that executes every row against taskTypeFor
export const DISPATCH_TASK_TYPE_TABLE = Object.freeze([
  Object.freeze({
    example: Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze(['we:docs/agent/conventions.md']) }),
    outcome: 'task-type', taskType: 'doc-fix',
    note: 'a `build` whose declared scope paths are all docs',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'task-type', taskType: 'build-new-feature',
    note: 'a `build` over at least one non-doc path',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze([]) }),
    outcome: 'refused', taskType: null,
    note: 'a `build` with no declared scope — `doc-fix` is scope-derived, so there is nothing to derive from',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'fix', cause: 'conflict', scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'task-type', taskType: 'conflict-resolution',
    note: 'a `fix` dispatched because a bounce was conflict-caused',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'fix', cause: null, scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'task-type', taskType: 'bugfix',
    note: 'an ordinary reviewer-finding `fix`',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'ci-heal', cause: null, scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'task-type', taskType: 'bugfix',
    note: 'a CI-heal repair',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'prepare', cause: null, scopePaths: Object.freeze(['we:backlog/1.md']) }),
    outcome: 'role', taskType: null, note: 'scope authoring — the role path',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'prepare-decision', cause: null, scopePaths: Object.freeze(['we:backlog/1.md']) }),
    outcome: 'role', taskType: null, note: 'decision authoring — the role path',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'investigate', cause: null, scopePaths: Object.freeze(['we:backlog/1.md']) }),
    outcome: 'role', taskType: null, note: 'triage research — the role path',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'review', cause: null, scopePaths: Object.freeze([]) }),
    outcome: 'role', taskType: null, note: 'judging a PR — the role path',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'self-fix', cause: null, scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'refused', taskType: null,
    note: 'not a dispatch kind this repo has — refused, never defaulted',
  }),
  Object.freeze({
    example: Object.freeze({ kind: 'fix', cause: 'cosmic-ray', scopePaths: Object.freeze(['we:scripts/lib/foo.mjs']) }),
    outcome: 'refused', taskType: null,
    note: 'an unknown cause — refused rather than ignored',
  }),
]);
