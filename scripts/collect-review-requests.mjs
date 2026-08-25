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
 * PARAMETERISED OVER THE DIRECTORY (#xaoja7a), because a SECOND transport arrived with the identical problem.
 * `we:.github/workflows/stage-pr-view.yml` collects PR-VIEW requests from `ops/pr-views/requests`, and both
 * silent drops above — the genesis push and git's rename heuristic — are properties of git and of GitHub's push
 * payload, not of which directory is being watched. Re-implementing the diff in that workflow's shell would
 * have re-earned both, in a place no unit test can reach. So the directory is an argument and the LOGIC has one
 * home. `REQUEST_DIR` stays the default so every existing caller is byte-identical.
 *
 * Usage:
 *   node scripts/collect-review-requests.mjs --before=<sha|zeros> --after=<sha> [--dir=<path>]
 * Prints one repo-relative path per line, in git's order; prints nothing when the push added no request.
 */
import { execFileSync } from 'node:child_process';
import { writeLineSync } from './lib/write-all-sync.mjs';

/** The one directory a review-verdict request may live in. Anything outside it is not a request, whatever it
 *  is named. It is the DEFAULT of the `dir` parameter below, not the only value — see the header. */
export const REQUEST_DIR = 'ops/review-requests';

/**
 * A watched directory must be a plain repo-relative path. Checked rather than trusted because this string goes
 * into a git PATHSPEC and into a `RegExp`: a `..` segment would collect files outside the transport directory,
 * and an unescaped regex metacharacter in {@link parseNames} would silently widen or narrow the filter with no
 * error anywhere.
 */
/** Escape a string for literal use inside a RegExp. See `parseNames` for why allowlisting is not enough. */
const escapeRegExp = (s) => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function assertDir(dir) {
  const d = String(dir ?? '').trim();
  if (!d || !/^[\w.-]+(?:\/[\w.-]+)*$/.test(d) || d.split('/').includes('..')) {
    throw new TypeError(`\`dir\` must be a plain repo-relative path, got ${JSON.stringify(dir)}`);
  }
  return d;
}

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
export function collectArgv({ before, after, dir = REQUEST_DIR } = {}) {
  if (typeof after !== 'string' || !/^[0-9a-f]{7,40}$/i.test(after.trim())) {
    throw new TypeError(`\`after\` must be a commit sha, got ${JSON.stringify(after)}`);
  }
  const watched = assertDir(dir);
  const head = after.trim();
  if (isGenesisPush(before)) {
    // No earlier state exists. Everything in the directory at `head` arrived with the push that made the branch.
    return ['ls-tree', '-r', '--name-only', head, '--', watched];
  }
  // A (dded) or M (odified) only: a request DELETED by this push is not a verdict to carry out.
  //
  // `--no-renames` IS LOAD-BEARING, and it was found the hard way. Git's rename detection is on by default, so
  // a push that adds `1463-accepted-retry1.json` while deleting `1463-accepted.json` is reported as a single
  // `R099` rename — and `R` is not in `AM`, so the new request was silently dropped and the job went green
  // having applied nothing. Measured live: `--diff-filter=AM` returned zero files for a push whose four
  // request files were all new. Similarity, not intent, decides whether git calls something a rename, so the
  // heuristic must simply be off here: a path that did not exist before and holds a request now IS one.
  return ['diff', '--name-only', '--diff-filter=AM', '--no-renames', before.trim(), head, '--', watched];
}

/**
 * Keep only what is actually a request file. Filtering HERE rather than in the git pathspec keeps the rule
 * one testable predicate instead of git's fnmatch dialect — and `ls-tree` on a directory returns everything
 * under it, including a README somebody adds later.
 */
export function parseNames(stdout, dir = REQUEST_DIR) {
  const watched = assertDir(dir);
  return String(stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    // ESCAPED, not merely allowlisted (PR #1548 r4). `assertDir` permits `.` in a segment — legitimately, a
    // directory may be named `ops.v2` — but splicing that straight into a RegExp makes the dot match ANY
    // character, so `ops.v2/` would also accept `opsXv2/`. This function's own header claims it prevents
    // exactly that class of silent widening; it did not. Allowlisting the input and escaping it are different
    // jobs and both are needed.
    .filter((line) => new RegExp(`^${escapeRegExp(watched)}/[^/]+\\.json$`).test(line));
}

/** IO shell: run the command `collectArgv` chose. `exec` is injected so the whole path stays testable. */
export function collectRequests({ before, after, dir = REQUEST_DIR, exec = defaultExec } = {}) {
  return parseNames(exec(collectArgv({ before, after, dir })), dir);
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
    const dir = flag(argv, 'dir');
    for (const name of collectRequests({ before: flag(argv, 'before'), after: flag(argv, 'after'), ...(dir === undefined ? {} : { dir }) })) {
      writeLineSync(1, name);
    }
  } catch (e) {
    writeLineSync(2, `collect-review-requests: ${e.message}`);
    process.exitCode = 2;
  }
}
