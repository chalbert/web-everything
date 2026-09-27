/**
 * @file no-search-backed-pr-list.mjs — pure scanner for the #no-label-search footgun (2026-09-27 live
 *   incident): `gh pr list`/`gh issue list` invoked with `--label`/`--search`/`--author` is served by GitHub's
 *   issue-SEARCH index, a separate, much smaller rate-limit budget than the ordinary GraphQL list the SAME
 *   call already is. The drain (`scripts/merge-ai-prs.mjs`) failed every pass on "API rate limit already
 *   exceeded" from that search bucket while its real GraphQL budget still had 2000+ points to spare, because
 *   `gh pr list --label ready-to-merge` filtered server-side. The fix (this incident, and every prior
 *   conversion in this same change): list the OPEN PRs plainly (`--json …,labels`) and filter the result
 *   client-side. This module is that invariant's static guard, so a future caller cannot silently reintroduce
 *   the same shape — see `scripts/__tests__/no-search-backed-pr-list.test.mjs`, which runs it repo-wide.
 *
 *   NOT a ban on `--search` categorically: `gh pr list --search '<title> in:title' --state merged` (a
 *   duplicate-title check against merged PR HISTORY — `scripts/operations/dispatch-lane-io.mjs`'s
 *   `defaultCheckAlreadyDone` and its concurrent sibling, and `scripts/readiness/conveyor-instrument.mjs`'s
 *   ad hoc reporting `--search` passthrough) is a genuinely different pattern: merged-PR history is
 *   unbounded, so "list everything, then filter" is not a safe client-side alternative there the way it is
 *   for the OPEN-PR set (bounded, already fetched in full for other reasons). Those are the only sanctioned
 *   exceptions and are named explicitly in the test's ALLOWLIST — anything else this scanner flags is a real
 *   regression of the incident, not a false positive to allowlist reflexively.
 */

/** How far past a `--label`/`--search`/`--author` occurrence's start we look BACKWARD for the `'pr'`/`'issue'`
 *  + `'list'` argv pair that makes it a `gh … list` invocation, not some unrelated flag. Generous enough to
 *  span the multi-line `listArgs = [...]` construction style this repo's call sites use, tight enough that it
 *  will not reach into an unrelated preceding statement in practice (calibrated against every real call site
 *  in this repo at authoring time). */
const BACKWARD_WINDOW = 400;

const FLAG_RE = /(['"])(--label|--search|--author)\1/g;
const LIST_CMD_RE = /(['"])(pr|issue)\1\s*,\s*(['"])list\3/;

/**
 * Find every `--label`/`--search`/`--author` flag literal in `content` that sits inside (or immediately after)
 * a `gh pr list` / `gh issue list` argv construction. PURE — text in, findings out. A finding is `{flag,
 * index, line}` (1-based line number of the flag itself, for a readable error message).
 * @test-only-export-ok: this IS the guard — its own test
 *   (scripts/lib/__tests__/no-search-backed-pr-list.test.mjs) is the sole intended consumer, exercising the
 *   pure scan function directly rather than shelling a CLI wrapper.
 * @param {string} content
 * @returns {{flag:string, index:number, line:number}[]}
 */
export function findSearchBackedGhListCalls(content) {
  const text = String(content ?? '');
  const findings = [];
  let m;
  FLAG_RE.lastIndex = 0;
  while ((m = FLAG_RE.exec(text))) {
    const start = Math.max(0, m.index - BACKWARD_WINDOW);
    const before = text.slice(start, m.index);
    if (LIST_CMD_RE.test(before)) {
      const line = text.slice(0, m.index).split('\n').length;
      findings.push({ flag: m[2], index: m.index, line });
    }
  }
  return findings;
}
