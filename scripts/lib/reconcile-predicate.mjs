/**
 * @file scripts/lib/reconcile-predicate.mjs
 * @description #2859 — the ONE canonical argv→flags reduction and reconcile predicate `merge-ai-prs.mjs` uses,
 *   pulled out to a dependency-free leaf (no imports of its own — not even node: builtins) so it is SAFE for
 *   `plateau-app:tools/drain-daemon/lib.test.mjs` to import cross-repo off the sibling WE checkout that repo's
 *   CI already provides (`plateau-app:vitest.config.ts`'s `weRoot`/`@webeverything/*` aliases) without pulling
 *   in `merge-ai-prs.mjs`'s full graph, which transitively imports the `markdown-it` npm package via
 *   `scripts/lib/review-escalation.mjs` — a dependency `plateau-app`'s CI does not install for the WE sibling
 *   checkout (verified during #2859 prep: `ERR_MODULE_NOT_FOUND` in CI, though it happens to resolve locally
 *   by an unrelated coincidental `plateau-app` devDependency).
 */

/**
 * Parse a raw argv into a flags object, exactly as `merge-ai-prs.mjs` does at its module scope. A bare
 * `--name` records `true`; a valued `--name=value` records the raw string `value`. Non-matching tokens
 * (a script path, a positional) are silently skipped. Pure.
 * @param {string[]} argv
 * @returns {Record<string, true|string>}
 */
export function parseArgvFlags(argv) {
  const flags = {};
  for (const a of Array.isArray(argv) ? argv : []) {
    const m = typeof a === 'string' && a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

/**
 * Would a `merge-ai-prs.mjs` pass built from this argv run the label/hold reconcile? Mirrors
 * `runCli`'s own `RECONCILE = label && !flags['no-reconcile-labels']` (`merge-ai-prs.mjs:2465`), except this
 * is a pure function of an arbitrary argv (not `process.argv`) so it is directly callable by a test or a
 * cross-repo caller. A present-but-EMPTY `--label=` is treated as "no label" (`Boolean(label)`, not `label`),
 * closing the #2859 divergence where a token being present and its value being meaningful were conflated.
 * @param {string[]} argv
 * @returns {boolean}
 */
export function reconcileWouldRunFor(argv) {
  const flags = parseArgvFlags(argv);
  const label = typeof flags.label === 'string' ? flags.label : null;
  return Boolean(label) && !flags['no-reconcile-labels'];
}
