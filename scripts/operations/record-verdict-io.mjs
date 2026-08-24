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
 *
 * ONBOARDING A REPO IS PART OF THE SINK'S JOB, not a paragraph someone has to find (#3264). Since #3261 each
 * repo owns its own board, so the common case is now a repo that has never carried a verdict. `ensureBoardBranch`
 * cuts the board from `main` on first use, `assertApplierRidesBoard` refuses a board that cannot apply, and
 * `trackingRefspec` names the destination ref so none of it depends on how the checkout was cloned.
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

/**
 * The applier definition that MUST RIDE THE BOARD ITSELF, and the reason the board is a full branch (#3264).
 *
 * GitHub runs a `push`-triggered workflow from the definition ON THE PUSHED REF, not from `main`. So a board
 * that does not carry this file accepts every push and applies nothing: the verdict looks staged, the run
 * reports `pushed: true`, and no label ever moves. That is a FAIL-SILENT — the direction this transport can
 * least afford, because the only signal a verdict was applied is the label itself.
 *
 * `we:` board works because it happens to be a full branch off `main`. That was an accident of how it was
 * first made by hand; `assertApplierRidesBoard` is what turns it into a checked requirement.
 */
export const APPLIER_WORKFLOW = '.github/workflows/apply-review-request.yml';

/** Where a board is BORN from — the branch that carries the applier. Never an orphan; see `APPLIER_WORKFLOW`. */
export const BOARD_SOURCE_BRANCH = 'main';

/**
 * Which checkout carries the transport branch for `repo`, and a REFUSAL when it is not this one (#3261).
 *
 * THE RULING: each repo owns its own notes. A verdict for `owner/x` is staged on `owner/x`'s OWN
 * `ops/review-requests` branch, applied by that repo's own workflow with its own repo-scoped token. Ruled on a
 * scaling test — at 100 repos a central board is not merely large, it is structurally wrong: every applier
 * would need cross-repo READ on a branch none of them owns.
 *
 * WHY THIS FUNCTION REFUSES RATHER THAN DEFAULTS. Before the ruling, a verdict for a sibling repo was pushed
 * onto THIS repo's branch and the applier failed with a raw `Could not resolve to a Repository` — the token is
 * repo-scoped (#3261's own evidence: one failure in fifty applier runs, and it was the only cross-repo
 * request). Defaulting to the local checkout would put a plateau-app verdict on web-everything's board again,
 * where the right applier will never see it and the wrong one cannot act on it. So a mismatch is an ERROR that
 * names both repos, never a silent push to the wrong board.
 *
 * `originRepo` is INJECTED so this is testable with no git, and so a caller that already knows the checkout
 * (the conveyor, a test) can say so instead of being probed.
 *
 * @param {{repo: string, root?: string, repoRoot?: string, originRepo?: Function}} o
 * @returns {string} the checkout whose `origin` is `repo`
 */
export function resolveTransportRoot({ repo, root = REPO_ROOT, repoRoot = '', originRepo = defaultOriginRepo } = {}) {
  const want = String(repo ?? '').trim();
  if (!want) throw new Error('record-verdict: no `repo` on the request — cannot decide which board it belongs on');
  const candidate = String(repoRoot ?? '').trim() || root;
  const have = originRepo(candidate);
  if (have === want) return candidate;
  throw new Error(
    `record-verdict: refusing to stage a verdict for ${want} on ${have || '(unknown)'}'s transport branch (#3261). `
    + 'Each repo owns its own notes: the request must be pushed to that repo\'s own `ops/review-requests`, where '
    + 'ITS applier — holding ITS repo-scoped token — can act on it. A request left on the wrong board is picked '
    + 'up by an applier that cannot resolve the repository, which is how plateau-app#144 was stranded. '
    + `Pass \`--repoRoot=<path to a ${want} checkout>\`.`,
  );
}

/** `owner/name` of a checkout's `origin`, or '' when it cannot be read. Probing must never throw. */
export function defaultOriginRepo(cwd) {
  try {
    const url = String(execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', cwd })).trim();
    const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    return m ? m[1] : '';
  } catch { return ''; }
}

/**
 * An EXPLICIT refspec, because `git fetch origin <branch>` does not create `origin/<branch>` (#3264).
 *
 * Hit live onboarding plateau-app: the fetch succeeded, wrote `FETCH_HEAD` and nothing else, and the very next
 * line died with `fatal: invalid reference: origin/ops/review-requests`. A bare `fetch origin <branch>` updates
 * the remote-tracking ref only when the CLONE'S CONFIGURED REFSPEC covers it — a full clone carries
 * `+refs/heads/*:refs/remotes/origin/*` and so it does, which is why `we:` never saw this, but a narrow or
 * single-branch clone does not, and the cloud session's checkouts are of that kind. Naming the destination
 * makes the ref appear regardless of the clone's geometry, which is the whole point: this sink must not read
 * one repo's clone as universal.
 */
export function trackingRefspec(branch) {
  return `+refs/heads/${branch}:refs/remotes/origin/${branch}`;
}

/**
 * BOARD GENESIS: on a repo that has never carried a verdict, create `ops/review-requests` from `main` (#3264).
 *
 * WHY THIS EXISTS AT ALL. The sink used to fetch the board unconditionally, so the FIRST verdict for every
 * newly-onboarded repo failed on a raw `couldn't find remote ref`. #3261 made per-repo boards the standard,
 * which turned that from a one-time curiosity into the normal onboarding path — plateau-app hit it, and was
 * onboarded BY HAND with `git push origin origin/main:refs/heads/ops/review-requests`, a step that lived
 * nowhere but in a backlog paragraph. This is that step, made code.
 *
 * WHY FROM `main` AND NOT AN ORPHAN. See `APPLIER_WORKFLOW`: the workflow must ride the board or nothing
 * applies. Branching from `main` is what puts it there — and it also encodes the ordering the human had to
 * get right by judgement, since a board cut from a `main` predating the applier would silently apply nothing.
 * `assertApplierRidesBoard` catches that case rather than trusting the ordering.
 *
 * WHY IT PUSHES FROM `refs/remotes/origin/main` AND FETCHES IT FIRST. Same failure as (3) above, one ref over:
 * the remote-tracking ref for `main` is not guaranteed to exist in a narrow clone either, and pushing from the
 * LOCAL `main` would publish whatever that checkout happens to be sitting on — stale, or a lane. The remote tip
 * is the only honest source.
 *
 * @param {{run: Function, board: string, repo?: string, sourceBranch?: string}} o
 * @returns {{created: boolean}} whether this call is the one that brought the board into existence
 */
export function ensureBoardBranch({ run, board, repo = '', sourceBranch = BOARD_SOURCE_BRANCH }) {
  // ONE probe for both refs, read as a SET OF EXACT REF NAMES rather than as a yes/no on the output. Two
  // things make the looser reading wrong: this asks for `main` in the same breath, so the output is non-empty
  // in every healthy case including the one where no board exists; and `ls-remote` patterns match a ref's
  // TAIL, so `ops/review-requests` also answers for `refs/heads/legacy/ops/review-requests`. Either shortcut
  // would conclude "the board exists", skip genesis, and hand the caller back the raw fetch failure this
  // whole function is here to prevent.
  const listed = String(run(['ls-remote', '--heads', 'origin', TRANSPORT_BRANCH, sourceBranch], { cwd: board }) ?? '');
  const refs = new Set(listed.split('\n').map((line) => line.split('\t')[1]?.trim()).filter(Boolean));
  if (refs.has(`refs/heads/${TRANSPORT_BRANCH}`)) return { created: false };

  const onboarding = `git push origin origin/${sourceBranch}:refs/heads/${TRANSPORT_BRANCH}`;
  const subject = repo ? `${repo}'s` : 'this repo\'s';
  if (!refs.has(`refs/heads/${sourceBranch}`)) {
    throw new Error(
      `record-verdict: ${subject} \`origin\` carries no \`${TRANSPORT_BRANCH}\` board and no \`${sourceBranch}\` `
      + `to cut one from (#3264). The board must be a full branch off \`${sourceBranch}\` so that `
      + `\`${APPLIER_WORKFLOW}\` rides it — an orphan branch accepts the push and applies nothing. Onboard the `
      + `repo by hand once its default branch carries the applier: \`${onboarding}\`.`,
    );
  }
  try {
    run(['fetch', '--quiet', 'origin', trackingRefspec(sourceBranch)], { cwd: board });
    run(['push', '--quiet', 'origin', `refs/remotes/origin/${sourceBranch}:refs/heads/${TRANSPORT_BRANCH}`], { cwd: board });
  } catch (cause) {
    throw new Error(
      `record-verdict: ${subject} \`${TRANSPORT_BRANCH}\` board does not exist and could not be created from `
      + `\`${sourceBranch}\` (#3264): ${cause?.message || cause}. The onboarding step is \`${onboarding}\`, run `
      + `in a checkout of that repo by someone who can push to it.`,
      { cause },
    );
  }
  return { created: true };
}

/**
 * REFUSE to stage onto a board that cannot apply — the loud half of #3264's fix.
 *
 * A board missing `APPLIER_WORKFLOW` is not a broken push, it is a push that WORKS and does nothing: GitHub
 * accepts it, no workflow is defined on the pushed ref, and the verdict sits there looking staged forever.
 * Checked from the board's OWN TREE (`ls-tree HEAD`), never from the driver's checkout — the driver having the
 * applier on `main` says nothing about what rides the branch being pushed to, and conflating the two is the
 * exact assumption that made this silent in the first place.
 *
 * `ls-tree` rather than `cat-file -e` because a missing path must be an ANSWER (empty output), not a thrown
 * git error this would then have to tell apart from a real failure.
 */
export function assertApplierRidesBoard({ run, wt, repo = '' }) {
  const found = String(run(['ls-tree', '--name-only', 'HEAD', '--', APPLIER_WORKFLOW], { cwd: wt }) ?? '').trim();
  if (found) return;
  const subject = repo ? `${repo}'s` : 'this repo\'s';
  throw new Error(
    `record-verdict: refusing to stage onto ${subject} \`${TRANSPORT_BRANCH}\` — its tree does not carry `
    + `\`${APPLIER_WORKFLOW}\` (#3264). GitHub runs a push-triggered workflow from the definition ON THE PUSHED `
    + 'REF, so this board would accept the request and apply nothing: the verdict would look staged and no label '
    + `would ever move. Re-cut the board from a \`${BOARD_SOURCE_BRANCH}\` that carries the applier: `
    + `\`git push --force origin origin/${BOARD_SOURCE_BRANCH}:refs/heads/${TRANSPORT_BRANCH}\` (it carries no `
    + 'history worth keeping — every request on it has already been applied).',
  );
}

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
 * EVERY SIDE EFFECT IS INJECTED — `git` AND the three filesystem calls. `git` alone was not enough, and CI
 * caught it: a suite that injected only `run` still executed the real `mkdirSync` against its fixture root of
 * `/repo`. As root that SUCCEEDED, silently creating a directory at the filesystem root and leaving the tests
 * green over a sink that had genuinely written outside its checkout; as an ordinary CI user it failed `EACCES`
 * and reddened four tests. The green run was the worse outcome of the two, and a partially-injected sink is
 * what allowed it — so `mkdir`/`write`/`rm` are parameters here for the same reason `run` always was.
 */
export function createRecordVerdictSinks({
  root = REPO_ROOT,
  repoRoot = '',
  originRepo = defaultOriginRepo,
  run = defaultGit,
  now = () => Date.now(),
  mkdir = mkdirSync,
  write = writeFileSync,
  rm = rmSync,
} = {}) {
  return {
    [STAGE_REQUEST_EFFECT]: async (payload) => {
      // #3261 — WHICH BOARD, decided before anything is written. Refuses rather than defaulting; see
      // `resolveTransportRoot`.
      // The PAYLOAD's `repoRoot` wins over the constructor's: sinks are built before any input is
      // parsed, so a CLI caller can only reach this through the payload. The constructor arg stays for
      // a programmatic caller (and for tests) that knows the checkout up front.
      const board = resolveTransportRoot({ repo: payload.repo, root, repoRoot: payload.repoRoot || repoRoot, originRepo });
      // #3264 — GENESIS, before anything assumes the board exists. A repo onboarding to the transport has never
      // carried a verdict, so its board has to be born here or the first verdict for it fails on a raw git
      // error. Outside the `try` deliberately: no worktree exists yet, so there is nothing for the `finally` to
      // clean up, and a genesis failure must reach the caller as its own refusal rather than as a cleanup.
      ensureBoardBranch({ run, board, repo: payload.repo });
      const wt = join(board, '.operations', 'transport', `wt-${now()}`);
      mkdir(dirname(wt), { recursive: true });
      try {
        // The refspec is EXPLICIT because a bare `fetch origin <branch>` leaves no `origin/<branch>` in a narrow
        // clone, and the `worktree add` below then dies on `invalid reference`. See `trackingRefspec`.
        run(['fetch', '--quiet', 'origin', trackingRefspec(TRANSPORT_BRANCH)], { cwd: board });
        // `--force` on the worktree add is about the DIRECTORY, not the branch: a leftover registration from a
        // killed run must not stop this one. The branch itself is taken from the freshly fetched remote tip.
        run(['worktree', 'add', '--force', '--detach', wt, `origin/${TRANSPORT_BRANCH}`], { cwd: board });
        run(['checkout', '-B', TRANSPORT_BRANCH, `origin/${TRANSPORT_BRANCH}`], { cwd: wt });
        // #3264 — and only NOW is the board's own tree readable, which is the only place the question can be
        // asked. A board without the applier accepts the push and applies nothing; refusing here is what keeps
        // that from being silent. Before the write, so a dead board never gets a commit it cannot act on.
        assertApplierRidesBoard({ run, wt, repo: payload.repo });

        const abs = join(wt, payload.path);
        mkdir(dirname(abs), { recursive: true });
        write(abs, payload.content);

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
        try { rm(wt, { recursive: true, force: true }); } catch { /* already gone */ }
        // PRUNED IN `board`, NOT `root` (#3261). The worktree was registered in the board's checkout, so
        // pruning the driver's would leave a stale registration in the target repo and wedge its NEXT
        // stage on the same branch — the failure this finally block exists to prevent, relocated.
        try { run(['worktree', 'prune'], { cwd: board }); } catch { /* best effort */ }
      }
    },
  };
}

function defaultGit(args, opts) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts });
}

export { existsSync };
