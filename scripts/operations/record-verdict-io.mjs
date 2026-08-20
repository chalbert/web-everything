/**
 * @file scripts/operations/record-verdict-io.mjs
 * @description THE IO SHELL of the `record-verdict` declaration — read the run the review wrote, and stage the
 *   request the transport carries.
 *
 * EVERY RULE IT APPLIES BELONGS TO SOMEBODY ELSE, and that is deliberate:
 *   · the run record is read through `./run-store.mjs`, the store the engine writes;
 *   · the staged write-up is located with `./review-pr-io.mjs`'s own `reviewBodyPath`, so this cannot disagree
 *     with where the review put it — the run-scoped path exists because a PR-keyed one let two runs clobber
 *     each other, and re-deriving it here would reintroduce exactly that;
 *   · the request's legality is `we:scripts/apply-review-request.mjs`'s `validateRequest`, imported by the
 *     caller in `./run.mjs` and passed in, never restated.
 *
 * WHAT IS GENUINELY NEW HERE is only the push: writing the request onto the transport branch. Nothing owned
 * that before, because it was a shell one-liner each time.
 *
 * THE PUSH IS A SEPARATE CHECKOUT ON PURPOSE. `ops/review-requests` is an orphan-ish transport branch, and the
 * lane you are working in is on a feature branch with your own uncommitted work. Checking the transport branch
 * out over that lane would destroy it — I did the equivalent by hand earlier in the session and it disrupted a
 * running juror. So the sink writes through a dedicated worktree, leaving the caller's checkout untouched.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileRunStore } from './run-store.mjs';
import { reviewBodyPath } from './review-pr-io.mjs';
import { STAGE_REQUEST_EFFECT } from './record-verdict.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Resolved by SCRIPT LOCATION, never cwd — same reason `run-store.mjs` and `review-pr-io.mjs` do it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** The branch CI watches. `we:.github/workflows/apply-review-request.yml` triggers on a push to it. */
export const TRANSPORT_BRANCH = 'ops/review-requests';

/** The write-up file name `review-pr` stages, per its own `prViewFileName`-style convention. */
export function writeUpName(repo, pr) {
  return `${String(repo).replace('/', '-')}-${pr}-verdict.md`;
}

/**
 * Read one run and its staged write-up. The write-up is OPTIONAL at this layer and refused in the declaration:
 * reading returns what is there, deciding whether that is enough is the declaration's job.
 */
export function createRunReader({ root = REPO_ROOT, store = createFileRunStore() } = {}) {
  return ({ runId }) => {
    const record = store.read(runId) ?? null;
    let body = '';
    if (record?.input?.repo && record?.input?.pr) {
      try {
        body = readFileSync(reviewBodyPath({ root, runId, bodyFile: writeUpName(record.input.repo, record.input.pr) }), 'utf8');
      } catch { body = ''; }
    }
    return { record, body };
  };
}

/**
 * Stage the request on the transport branch and push it.
 *
 * A DEDICATED WORKTREE, not a branch switch. The caller is standing in a lane with its own work; checking
 * `ops/review-requests` out over it would take that work with it. `git worktree` gives the transport branch its
 * own directory, so the caller's tree is never touched — and the worktree is removed afterwards whether the
 * push succeeded or not, because a stranded worktree wedges the next run on the same branch.
 *
 * `git` is shelled through the injected `run` so the whole sequence is assertable without a remote.
 */
export function createRecordVerdictSinks({ root = REPO_ROOT, run = defaultGit, now = () => Date.now() } = {}) {
  return {
    [STAGE_REQUEST_EFFECT]: async (payload) => {
      const wt = join(root, '.operations', 'transport', `wt-${now()}`);
      mkdirSync(dirname(wt), { recursive: true });
      try {
        run(['fetch', '--quiet', 'origin', TRANSPORT_BRANCH], { cwd: root });
        // `--force` on the worktree add is about the DIRECTORY, not the branch: a leftover registration from a
        // killed run must not stop this one. The branch itself is taken from the freshly fetched remote tip.
        run(['worktree', 'add', '--force', '--detach', wt, `origin/${TRANSPORT_BRANCH}`], { cwd: root });
        run(['checkout', '-B', TRANSPORT_BRANCH, `origin/${TRANSPORT_BRANCH}`], { cwd: wt });

        const abs = join(wt, payload.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, payload.content);

        run(['add', '--', payload.path], { cwd: wt });
        // NOTHING TO COMMIT IS A SUCCESS, not a failure: the identical request is already staged, which is
        // exactly what `idempotent: true` promises on replay. Committing nothing and pushing nothing leaves
        // the transport in the state the caller asked for.
        const staged = run(['diff', '--cached', '--name-only'], { cwd: wt }).trim();
        if (!staged) return { path: payload.path, pushed: false, reason: 'identical request already staged' };

        run(['commit', '--quiet', '-m', `review: #${payload.pr} → ${payload.to} (via record-verdict)`], { cwd: wt });
        run(['push', '--quiet', 'origin', `HEAD:${TRANSPORT_BRANCH}`], { cwd: wt });
        return { path: payload.path, pushed: true };
      } finally {
        // ALWAYS, and in this order: remove the directory, then prune the registration. A worktree left behind
        // makes the next `worktree add` on the same branch fail, which would turn one bad run into every
        // subsequent one failing.
        try { rmSync(wt, { recursive: true, force: true }); } catch { /* already gone */ }
        try { run(['worktree', 'prune'], { cwd: root }); } catch { /* best effort */ }
      }
    },
  };
}

function defaultGit(args, opts) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts });
}

export { existsSync };
