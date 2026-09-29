/**
 * git-patch-equivalence.mjs — the single-target `git cherry` patch-equivalence parse (#4313/#xuyjss1).
 *
 * `we:scripts/conveyor/lease-reaper.mjs`'s `defaultGitIsAncestor` and `we:scripts/lane-pool.mjs`'s
 * `cherryAllPatchEquivalent` each independently ran `git cherry <upstream> <head>` and applied the SAME
 * 3-line parse of its output — "every line prefixed `-` (or no lines at all) means already patch-equivalent" —
 * for two different callers (branch-vs-one-merge-commit containment in the former, a lane's ahead commits vs
 * a live remote head in the latter). `lease-reaper.mjs` cannot import `lane-pool.mjs` (that file already
 * imports FROM `lease-reaper.mjs`, so the reverse would cycle), so this was a small, deliberately-accepted
 * duplication rather than a shared primitive.
 *
 * This module extracts ONLY the pure output parse, not the spawn: each call site's own `git cherry` invocation
 * carries genuinely different surrounding contracts (`lease-reaper.mjs` distinguishes a definitive `false` from
 * an unresolvable `null`, and its own spawn adds a `--` separator since its `sha` argument is untrusted data;
 * `lane-pool.mjs` folds every failure to `false` and runs through its own `tryGit`/`git` helpers, which apply
 * env/timeout hardening uniformly across ~40 call sites in that file) — re-deriving a shared SPAWNING primitive
 * would either drop that hardening for one call site or require threading each file's own execution contract
 * through as options, neither of which this single-sourcing-only item asks for. Each call site keeps its own
 * spawn (options, separators, null-handling) and delegates only the parse below.
 */

/**
 * Given raw stdout from `git cherry <upstream> <head>`, is every commit `<head>` carries beyond `<upstream>`
 * already patch-equivalent to something in `<upstream>`'s history — or are there none at all (already
 * ancestor-contained)?
 *
 * `git cherry` prefixes each line `-` when an equivalent patch already exists upstream, `+` when it does not.
 * Blank lines (a trailing newline, or no output at all) are filtered out before the check, matching the
 * `.filter(Boolean)` behavior both original call sites already relied on.
 *
 * Deliberately does NOT default a non-string input: both original inline call sites called `.split(...)`
 * directly on their own `exec`/`tryGit` result with no null-coalesce, so a non-string `cherryOutput` throws
 * here exactly as it did before extraction (#4313 round-1 convergence, simplicity/standards-conformance/
 * claim-accuracy findings, independently: an added `?? ''` default would have made a previously-thrown,
 * caught-as-`null`-or-`false` case instead read as `true` — the unsafe direction for a "contained" check).
 *
 * @param {string} cherryOutput - raw stdout from `git cherry <upstream> <head>` (or its `--` separated form).
 * @returns {boolean} true iff every listed commit is prefixed `-`, or there are no lines at all.
 */
export function isCherryOutputAllPatchEquivalent(cherryOutput) {
  const lines = cherryOutput.split('\n').filter(Boolean);
  return lines.length === 0 || lines.every((l) => l.startsWith('-'));
}
