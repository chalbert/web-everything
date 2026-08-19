#!/usr/bin/env node
/**
 * @file scripts/collect-review-requests.mjs
 * @description Name the staged review requests that ONE push added, for
 *   `we:.github/workflows/apply-review-request.yml` to hand to `we:scripts/apply-review-request.mjs`.
 *
 * WHY IT IS A SCRIPT AND NOT FOUR LINES OF YAML. It was four lines of YAML, and the encoded `review-pr`
 * operation found a blocker in them: on the push that CREATES the branch, GitHub sends an all-zero `before`,
 * and the fallback listed only the tip commit's own tree delta. Two verdicts staged as two commits and pushed
 * together meant the FIRST one was never read, never applied — and the job still went green, because the
 * failure counter only tracks requests that were actually attempted. Silent under-delivery of a review
 * verdict. Shell inside a workflow cannot be unit-tested; this can, and every branch below is pinned.
 *
 * THE TWO CASES, and why each is right:
 *
 *   · A push to an EXISTING branch has a real `before`. Diff the two — exact, whatever the push's shape.
 *   · A push that CREATES the branch has no `before` at all, so there is nothing to diff against. List the
 *     whole request directory at the pushed commit instead. On a branch that did not exist a moment ago,
 *     everything present in it was put there by the push that created it — true no matter how many commits
 *     that push carried, and it needs no merge-base and no guess about which refs the runner fetched.
 *
 * ITS ONE HONEST LIMIT: delete the branch and recreate it from a commit that still carries already-applied
 * requests, and those are applied a second time (the single home is not idempotent in its comment half — a
 * second run posts a second comment). That is deliberate. Over-applying is LOUD: a duplicate comment on a PR,
 * seen immediately. Under-applying is SILENT, and silent is what the review caught.
 *
 * Usage:
 *   node scripts/collect-review-requests.mjs --before=<sha|zeros> --after=<sha>
 * Prints one repo-relative path per line, in git's order; prints nothing when the push added no request.
 */
import { execFileSync } from 'node:child_process';
import { writeLineSync } from './lib/write-all-sync.mjs';

/** The one directory a request may live in. Anything outside it is not a request, whatever it is named. */
export const REQUEST_DIR = 'ops/review-requests';

/** What GitHub sends as `before` when the push created the ref. */
export const NO_PARENT_SHA = '0'.repeat(40);

/**
 * Is this the push that created the branch? Treated as such for a missing/blank `before` too: both mean the
 * same thing here — there is no earlier state to diff against — and guessing one would be worse.
 */
export function isGenesisPush(before) {
  const sha = String(before ?? '').trim();
  // The all-zero form is what GitHub literally sends; the widened `^0+$` is not paranoia about GitHub but
  // about the hand-run case — an operator reproducing a genesis push locally types as many zeros as they type.
  return sha === '' || sha === NO_PARENT_SHA || /^0+$/.test(sha);
}

/**
 * The git argv to run. PURE, and exported so a test can assert the exact command without a repository —
 * the same discipline `we:scripts/lib/review-label-provider.mjs` applies to its `gh` argv.
 */
export function collectArgv({ before, after } = {}) {
  if (typeof after !== 'string' || !/^[0-9a-f]{7,40}$/i.test(after.trim())) {
    throw new TypeError(`\`after\` must be a commit sha, got ${JSON.stringify(after)}`);
  }
  const head = after.trim();
  if (isGenesisPush(before)) {
    // No earlier state exists. Everything in the directory at `head` arrived with the push that made the branch.
    return ['ls-tree', '-r', '--name-only', head, '--', REQUEST_DIR];
  }
  // A (dded) or M (odified) only: a request DELETED by this push is not a verdict to carry out.
  return ['diff', '--name-only', '--diff-filter=AM', before.trim(), head, '--', REQUEST_DIR];
}

/**
 * Keep only what is actually a request file. Filtering HERE rather than in the git pathspec keeps the rule
 * one testable predicate instead of git's fnmatch dialect — and `ls-tree` on a directory returns everything
 * under it, including a README somebody adds later.
 */
export function parseNames(stdout) {
  return String(stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => new RegExp(`^${REQUEST_DIR}/[^/]+\\.json$`).test(line));
}

/** IO shell: run the command `collectArgv` chose. `exec` is injected so the whole path stays testable. */
export function collectRequests({ before, after, exec = defaultExec } = {}) {
  return parseNames(exec(collectArgv({ before, after })));
}

function defaultExec(argv) {
  return execFileSync('git', argv, { encoding: 'utf8' });
}

function flag(argv, name) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const argv = process.argv.slice(2);
    for (const name of collectRequests({ before: flag(argv, 'before'), after: flag(argv, 'after') })) {
      writeLineSync(1, name);
    }
  } catch (e) {
    writeLineSync(2, `collect-review-requests: ${e.message}`);
    process.exitCode = 2;
  }
}
