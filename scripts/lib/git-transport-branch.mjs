/**
 * @file scripts/lib/git-transport-branch.mjs
 * @description THE ONE WAY A CREDENTIAL-LESS SESSION PUTS A FILE ON A CI-WATCHED BRANCH — extracted from
 *   `we:scripts/operations/record-verdict-io.mjs` when a SECOND transport needed it (#xaoja7a).
 *
 * WHY IT MOVED. `record-verdict` pushes a verdict request to `ops/review-requests`; `stage-pr-view` now pushes
 * a VIEW request to `ops/pr-views`. Same dance, same hazards, and the hazards are not obvious — a second copy
 * would have re-earned each of them one at a time. What is encoded here was learned the hard way, twice:
 *
 *   · A DEDICATED WORKTREE, NEVER A BRANCH SWITCH. The caller is standing in a lane with its own uncommitted
 *     work, and checking a transport branch out over that lane destroys it. That is not hypothetical: it was
 *     done by hand in the session that wrote `record-verdict-io.mjs`, and it disrupted a running juror
 *     mid-review. The worktree gives the transport branch its own directory and leaves the caller's tree alone.
 *   · THE WORKTREE IS ALWAYS REMOVED, and the registration always pruned, in that order and in a `finally`.
 *     A stranded worktree makes the NEXT `worktree add` on the same branch fail, which turns one bad run into
 *     every subsequent one failing.
 *   · EVERY SIDE EFFECT IS INJECTED — `git` AND the three filesystem calls. `git` alone was not enough and CI
 *     caught it: a suite that injected only `run` still executed the real `mkdirSync` against its fixture root
 *     of `/repo`. Running as root that SUCCEEDED, creating a directory at the filesystem root and leaving the
 *     tests green over a sink that had genuinely written outside its checkout; as an ordinary CI user it failed
 *     `EACCES` and reddened four tests. The green run was the worse outcome, and a partially-injected sink is
 *     what allowed it.
 *   · NOTHING TO COMMIT IS A SUCCESS. Identical bytes already staged is exactly what an idempotent replay
 *     promises; reporting it as a failure would make every retry look broken.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: decide WHICH checkout the branch belongs to. That is `resolveTransportRoot`
 * (`we:scripts/operations/record-verdict-io.mjs`), which refuses a cross-repo push rather than defaulting —
 * a decision, and decisions stay with their caller.
 *
 * IMPURE by construction (`git`, `fs`), which is why every one of those is a parameter.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Write files onto `branch` in `board`'s checkout and push them.
 *
 * @param {object} o
 * @param {string} o.board - the checkout whose `origin` owns the branch.
 * @param {string} o.branch - the transport branch, e.g. `ops/review-requests`.
 * @param {Array<{path: string, content: string}>} o.files - repo-relative paths and their bytes.
 * @param {string} o.message - the commit message.
 * @returns {{paths: string[], pushed: boolean, reason?: string}}
 */
/**
 * An EXPLICIT refspec, because `git fetch origin <branch>` does not create `origin/<branch>` (#3264).
 *
 * Hit live onboarding plateau-app: the fetch succeeded, wrote `FETCH_HEAD` and nothing else, and the next line
 * died with `fatal: invalid reference: origin/ops/review-requests`. The remote-tracking ref is updated only when
 * the CLONE'S CONFIGURED refspec covers the branch — a full clone carries `+refs/heads/*:refs/remotes/origin/*`
 * and so it does, but a `--single-branch` clone does not, and a cloud-session checkout is of that kind.
 *
 * LIVES HERE, not in `we:scripts/operations/record-verdict-io.mjs` where it was first written: it is a fact
 * about git's refspec grammar, true of every transport branch, and this module is the one every transport now
 * shares. Putting it the other way round would also make the import cycle — that module imports this one.
 */
export function trackingRefspec(branch) {
  return `+refs/heads/${branch}:refs/remotes/origin/${branch}`;
}

export function stageOnTransportBranch({
  board,
  branch,
  files = [],
  message,
  run = defaultGit,
  mkdir = mkdirSync,
  write = writeFileSync,
  rm = rmSync,
  now = () => Date.now(),
  // A caller-specific check run INSIDE the worktree, after `checkout -B` and BEFORE anything is written.
  // `record-verdict` passes `assertApplierRidesBoard` here (#3264): a board whose tree lacks the applier
  // workflow accepts the push and applies nothing, and the board's own tree is the only place that question
  // can be asked — which is only possible once the worktree exists. It throws to refuse; the `finally` below
  // still prunes, so a refusal never leaks a worktree. Generic by default: a transport with nothing to assert
  // passes nothing.
  assertReady = null,
} = {}) {
  if (!board || !branch) throw new TypeError('git-transport-branch: `board` and `branch` are both required');
  if (!files.length) throw new TypeError('git-transport-branch: nothing to stage — `files` is empty');

  const wt = join(board, '.operations', 'transport', `wt-${now()}`);
  mkdir(dirname(wt), { recursive: true });
  try {
    // AN EXPLICIT REFSPEC, never a bare `fetch origin <branch>` (#3264). The bare form writes `FETCH_HEAD` and
    // creates `refs/remotes/origin/<branch>` only when the CLONE'S CONFIGURED refspec covers it — true of a full
    // clone, false of a `--single-branch` one, which is what a cloud-session checkout is. The `worktree add`
    // below then dies on `fatal: invalid reference`. This helper was extracted from `record-verdict`'s sink as
    // it stood BEFORE that fix landed, so the bare form came with it; naming the destination here is what keeps
    // the extraction from regressing it — and now for EVERY transport that shares this code, not just one.
    run(['fetch', '--quiet', 'origin', trackingRefspec(branch)], { cwd: board });
    // `--force` on the worktree add is about the DIRECTORY, not the branch: a leftover registration from a
    // killed run must not stop this one. The branch itself is taken from the freshly fetched remote tip.
    run(['worktree', 'add', '--force', '--detach', wt, `origin/${branch}`], { cwd: board });
    run(['checkout', '-B', branch, `origin/${branch}`], { cwd: wt });

    if (assertReady) assertReady({ run, wt, board, branch });

    for (const file of files) {
      const abs = join(wt, file.path);
      mkdir(dirname(abs), { recursive: true });
      write(abs, file.content);
      run(['add', '--', file.path], { cwd: wt });
    }

    const staged = run(['diff', '--cached', '--name-only'], { cwd: wt }).trim();
    if (!staged) return { paths: files.map((f) => f.path), pushed: false, reason: 'identical content already staged' };

    run(['commit', '--quiet', '-m', message], { cwd: wt });
    run(['push', '--quiet', 'origin', `HEAD:${branch}`], { cwd: wt });
    return { paths: files.map((f) => f.path), pushed: true };
  } finally {
    // ALWAYS, and in this order: remove the directory, then prune the registration. Dropping either one leaves
    // the next run on this branch wedged.
    try { rm(wt, { recursive: true, force: true }); } catch { /* already gone */ }
    // PRUNED IN `board`, not in whatever directory the driver happens to be: the worktree was registered in the
    // board's checkout, so pruning elsewhere leaves a stale registration in the repo that will need it (#3261).
    try { run(['worktree', 'prune'], { cwd: board }); } catch { /* best effort */ }
  }
}

function defaultGit(args, opts) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts });
}
