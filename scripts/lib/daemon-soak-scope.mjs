/**
 * @file daemon-soak-scope.mjs — the ONE canonical copy of "does this path touch daemon code" (#4075 soak
 * harness scope, epic #3383). `.github/workflows/ci.yml`'s `daemon-soak` job's "Does this PR touch daemon
 * code?" step embeds this same pattern by hand, as a bash `grep -E`, because that step runs before `npm ci`
 * (no node_modules yet) and shells a plain grep rather than a node script — so it cannot `import` this module.
 * `DAEMON_SOAK_SCOPE_SOURCE` below is instead kept as the single SOURCE OF TRUTH string; ci.yml's grep is
 * copied from it by hand, and `scripts/lib/__tests__/daemon-soak-scope.test.mjs` reads ci.yml's own step text
 * and asserts the embedded pattern is byte-identical to this module's, so any future drift between the two
 * reddens a unit test immediately rather than silently diverging.
 *
 * DELIBERATELY NOT touched here: `.github/workflows/ci.yml` itself is left untouched by this module's own PR.
 * PR #2770 (open at the time this module was added) restructures the single `daemon-soak` job into
 * `daemon-soak-scope` / `soak-shard` / `daemon-soak`, and its diff carries this exact regex forward
 * character-for-character unchanged — so extracting it into this shared module needs no ci.yml edit at all,
 * and none was made, specifically to avoid conflicting with that in-flight restructuring. Once #2770 lands, the
 * still-unmodified grep line keeps matching this module's `DAEMON_SOAK_SCOPE_SOURCE`, so the drift test above
 * keeps passing across that merge with no further change here.
 *
 * Consumers: `scripts/lib/soak-replay-gate.mjs` (the "does this PR fix a live daemon break" gate) reuses this
 * exact pattern as the "touches daemon code" half of that gate's AND condition, rather than restating it.
 */

// Byte-identical to the grep -E pattern in .github/workflows/ci.yml's "Does this PR touch daemon code?" step
// (search that file for `daemon-soak-scope.mjs` to find the paired comment). Kept as a plain string (not a
// template literal) so a diff of this file reads as plainly as the ci.yml grep line does.
export const DAEMON_SOAK_SCOPE_SOURCE =
  '^(skills-src/conveyor/|scripts/conveyor/|scripts/lib/daemon-|scripts/lib/gh-app-shim|scripts/lib/main-staleness|scripts/lane-pool|scripts/review-set-label\\.mjs$|scripts/operations/[^/]*dispatch[^/]*$|vitest\\.soak\\.config\\.ts$)';

export const DAEMON_SOAK_SCOPE_PATTERN = new RegExp(DAEMON_SOAK_SCOPE_SOURCE);

/** True if `path` (a repo-relative file path, no leading slash) falls inside the daemon-soak scope. */
export function isDaemonSoakScopePath(path) {
  return typeof path === 'string' && DAEMON_SOAK_SCOPE_PATTERN.test(path);
}

/** True if ANY of `paths` (repo-relative file paths) falls inside the daemon-soak scope. */
export function touchesDaemonSoakScope(paths) {
  return (Array.isArray(paths) ? paths : []).some(isDaemonSoakScopePath);
}
