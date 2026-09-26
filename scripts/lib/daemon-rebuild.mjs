#!/usr/bin/env node
/**
 * @file scripts/lib/daemon-rebuild.mjs
 * @description Module C (card 4044/xgomze7, "the heart") of the daemon-clone rebuild
 *   (docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clauses 2-5) — REBUILDS a daemon clone
 *   fresh from `origin/main` plus its registered overlay list (`daemon-overlays.mjs`, Module B) every tick,
 *   instead of the old "merge whatever's ahead into whatever's here" self-sync, which could drift a clone into
 *   a tree no single commit on GitHub ever represented (an overlay merged last week, main merged on top of it
 *   THIS week, in an order nobody could reconstruct from `origin` alone).
 *
 * WHY THE BUILD HAPPENS IN THE OBJECT DB, NOT THE WORKING TREE. `git merge-tree --write-tree` computes a merged
 * TREE object without touching the index or working tree at all; `git commit-tree` mints a commit object from
 * that tree with explicit parents — both are pure object-database operations that can run in a bare scratch
 * repo, can be retried freely, and can be killed mid-flight with ZERO effect on any real checkout (nothing on
 * disk outside `.git/objects` and a scratch dir is ever touched while the build is COMPUTED). Only the very
 * last step, `git reset --hard <finalSha>`, ever moves the working tree — and it moves it in ONE atomic jump
 * from the old good commit straight to the new one. A killed rebuild therefore never leaves a half-merge: either
 * the `reset --hard` completed (new tree, in full) or it didn't run yet (old tree, in full). `git clean` is
 * NEVER called anywhere in this file — a daemon clone can have build artifacts, node_modules, or other
 * gitignored state a bystander process depends on, and wiping it is not this module's business.
 *
 * DETERMINISM. The identity `daemon-rebuild <daemon-rebuild@localhost>` and `GIT_AUTHOR_DATE`/
 * `GIT_COMMITTER_DATE` pinned to `@<the later of the two parents' committer dates> +0000` (see
 * {@link REBUILD_IDENTITY_ENV} and the date computation in {@link planRebuild}) mean `commit-tree` is called
 * with the SAME five inputs (tree, two parents, message, identity+date) whenever the same overlay is applied
 * onto the same `main`, whatever machine or however many times it runs — git commit objects are content-
 * addressed, so identical inputs mint the IDENTICAL sha. This is what makes `rebuildClone`'s own idempotency
 * check ("already at `finalSha`? nothing to do") and the reject-cache ("already rejected these exact inputs?
 * don't re-smoke") both correct rather than approximate.
 *
 * PURE CORE / IO SHELL, same convention as every other file in this lifecycle: {@link planRebuild} and
 * {@link findUnsafeLocalState} take an injected `git(args)` callback (spawnSync-shaped, already bound to
 * cwd/env/timeout by the caller) and do no IO of their own beyond calling it — {@link rebuildClone} and
 * {@link dryRunRebuild} are the IO shells that construct that callback, hold the clone's write lock
 * (`daemon-clone-lock.mjs`, Module A), read/write the overlay list (`daemon-overlays.mjs`, Module B), and run
 * the live smoke (`daemon-live-smoke.mjs`, Module D).
 *
 * xa4qo7n (epic #4075/#3383) — THE SMOKE NEVER RUNS AGAINST `root`, AND NEVER HOLDS THE WRITE LOCK. Live
 * 2026-09-26 09:32 ET: the two checks #2691 added (`reconcile-dry-run`, `dispatch-dry-run`) pushed a routine
 * smoke to ~65s; since the OLD `rebuildClone` ran `git reset --hard <candidate>` (Step 5) and THEN the whole
 * live smoke (Step 6) inside ONE `withWriteLock` hold, every daemon sharing the clone was refused its read lock
 * (`writer-active`) and ticked 0 dispatches for that whole ~65s, every time main moved — the same class of bug
 * #2625 fixed for the smoke's OWN duration, but #2625 never moved the smoke OFF the lock. `rebuildClone` now
 * splits into three steps, only the first and third of which ever touch `root`'s working tree or take its
 * write lock:
 *   1. {@link prepareRebuild} (locked, fast — recovery/safety/fetch/`planRebuild`, all object-DB-only or plain
 *      reads until the very last instant): computes `plan.finalSha` and returns EITHER a terminal result (same
 *      short-circuit reasons as before: dirty, up-to-date, still-rejected, a pinned-overlay refusal, …) or a
 *      `{terminal:false, plan, prevHead}` signal to proceed.
 *   2. UNLOCKED: {@link materializeCandidate} checks `plan.finalSha` out into a disposable `git worktree` (see
 *      {@link candidateWorktreePath}) — sharing `root`'s object DB, so this fetches/copies nothing — and the
 *      FULL live smoke runs against THAT worktree, never against `root`. Every daemon sharing `root` keeps
 *      reading/dispatching off root's CURRENT, already-verified tree for the smoke's entire duration.
 *   3. {@link finalizeRebuild} (locked, fast — only reached after a PASSING smoke): re-verifies nothing else
 *      moved `root` while step 2 ran (a sibling process's own rebuild, or one that already landed this exact
 *      build), then does the ONE `git reset --hard <finalSha>` this module ever performs, and writes
 *      `state.adopted`. A FAILING smoke (step 2) never reaches this step at all — `root` was never touched, so
 *      there is nothing to roll back, and no lock is ever taken for a rejection.
 * This also collapses the old `state.unverified`/`smokeOnly` re-smoke-on-crash-recovery path: since a reset now
 * NEVER runs before its smoke has already passed, a crash between step 3's reset and its state write can only
 * ever be a crash on an ALREADY-VERIFIED build — recovery ({@link prepareRebuild}'s Step 0) promotes it straight
 * to `adopted` from the `inProgress` record's own echoed plan fields, with no re-smoke.
 *
 * DRY RUN IS STRICTLY READ-ONLY ON THE REAL CLONE. {@link dryRunRebuild} never calls `git reset`, `git fetch`
 * (against the clone itself — it fetches into a disposable scratch bare repo instead), or anything else that
 * writes an object or moves a ref in `root`. It borrows `root`'s objects via `objects/info/alternates` (so the
 * scratch repo can `merge-tree`/`commit-tree` without re-downloading anything already local) and does its OWN
 * fresh fetch of `origin/main` + every overlay ref into the scratch repo — never touching `root`'s own
 * `refs/remotes/origin/*`, so a dry run run concurrently with a real tick can never race it or leave it stale.
 * Every command this file runs directly against `root` (as opposed to the scratch repo) carries
 * `GIT_OPTIONAL_LOCKS=0` so even a `status`/`rev-parse` read never takes `.git/index.lock`.
 *
 * STATE. Per-clone rebuild state — `{adopted, rejected, inProgress, quarantine}` — lives OUTSIDE the git tree
 * (same clause-3(iii) posture as `daemon-overlays.mjs`'s own state file, same `cloneKey` so both key on the
 * exact same identity), at `<env.WE_DAEMON_STATE_DIR || ~/.claude/daemon-self-sync-state>/<cloneKey>.rebuild.json`.
 * `adopted` remembers the last successfully-adopted build (so a later call with the SAME inputs is a fast
 * `up-to-date` no-op); `rejected` remembers the last inputs a live smoke genuinely rejected (`'code'` verdict —
 * never a `'transient'` one, see {@link runLiveSmokeWithRetry}) so the SAME broken build is never re-smoked
 * every tick until the inputs actually change; `inProgress`/`quarantine` are crash-recovery breadcrumbs for a
 * rebuild that died mid-way (see {@link rebuildClone}'s step 0).
 *
 * ALERTS. Every notable event this module's IO shell hits — an auto-dropped overlay, a recovered stale
 * `index.lock`, a rejected smoke, a rollback that itself failed — goes through one `alert()` call that (a) logs
 * via `log.error` prefixed `daemon-rebuild:`, (b) is returned in the result's `alerts` array, and (c) is
 * appended to `<stateDir>/<cloneKey>.alerts.jsonl` — one JSON line per event, an audit trail that survives past
 * whatever the state file's own current snapshot says.
 */

import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync, statSync, unlinkSync,
  existsSync, symlinkSync,
} from 'node:fs';
import { tmpdir, hostname, homedir } from 'node:os';
import { join, dirname, resolve as resolvePath, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { withWriteLock } from './daemon-clone-lock.mjs';
import {
  cloneKey, overlayFilePath, readOverlayState, removeOverlay, appendOverlayEvent,
} from './daemon-overlays.mjs';
import { runLiveSmokeWithRetry } from './daemon-live-smoke.mjs';
import { isSafeBranchName } from './daemon-self-sync.mjs';
import { gitRun } from './main-staleness.mjs';
import { pinnedStateRoot } from '../conveyor/queue-store.mjs';

// ── Fixed rebuild identity (see file header — DETERMINISM) ─────────────────────────────────────────────────

/** `daemon-rebuild <daemon-rebuild@localhost>` — the ONE identity every `commit-tree` this module mints uses,
 *  whatever machine/user runs it, so the same inputs always produce the same commit sha. */
export const REBUILD_IDENTITY_ENV = Object.freeze({
  GIT_AUTHOR_NAME: 'daemon-rebuild',
  GIT_AUTHOR_EMAIL: 'daemon-rebuild@localhost',
  GIT_COMMITTER_NAME: 'daemon-rebuild',
  GIT_COMMITTER_EMAIL: 'daemon-rebuild@localhost',
});

/** One git-runner factory shared by every call site in this file — always carries the fixed rebuild identity
 *  (harmless for anything but `commit-tree`), a `timeout` + `killSignal:'SIGKILL'` (house style: a hung git
 *  child can never hang this module), and an optional per-call `env` override (`opts.env`, used only for the
 *  `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` a single `commit-tree` call needs — see {@link planRebuild}). */
function makeGit({ run, cwd, env, timeoutMs = 60_000, extraEnv = {} }) {
  return (args, opts = {}) => run(args, {
    cwd,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    env: { ...env, ...REBUILD_IDENTITY_ENV, ...extraEnv, ...(opts.env || {}) },
  });
}

/** `--verify --end-of-options` is this codebase's established pattern (`diff-branch-coverage.mjs`) for
 *  resolving a ref that might contain attacker-controlled text without git reading it as an option — plain
 *  `git rev-parse -- <ref>` does NOT do this (rev-parse echoes `--` back literally rather than treating it as
 *  an end-of-options marker); `--end-of-options` is the flag that actually does. Returns the resolved sha, or
 *  `null` on any failure (unknown ref, timeout, non-zero exit) — never coerced into a false positive. */
function verifyRev(git, rev) {
  const r = git(['rev-parse', '--verify', '--end-of-options', rev]);
  const out = String(r.stdout ?? '').trim();
  return r.status === 0 && out ? out : null;
}

// ── pinned overlays — the self-destruct guard ───────────────────────────────────────────────────────────────

/**
 * The files that ARE the rebuild mechanism: the daemon tick imports these to rebuild itself. An overlay that
 * changes any of them is "load-bearing" for the clone. Dropping it for a conflict would rebuild the clone onto
 * a tree whose code no longer knows how to rebuild (or re-add) it. That happened live on 2026-09-25: #2625 was
 * the overlay carrying this very module; main moved, the overlay conflicted, the rebuild conflict-dropped it,
 * and the clone fell back to main's old merge-on-top self-sync with no overlay list at all.
 */
export const REBUILD_MECHANISM_PATHS = Object.freeze([
  'scripts/lib/daemon-rebuild.mjs',
  'scripts/lib/daemon-overlays.mjs',
  'scripts/lib/daemon-clone-lock.mjs',
  'scripts/lib/daemon-self-sync.mjs',
  'scripts/lib/daemon-live-smoke.mjs',
  'scripts/daemon-overlay.mjs',
]);

/** The one human-readable line every pinned refusal carries. */
export const PINNED_OVERLAY_MESSAGE = 'pinned overlay conflicts with main — needs a rebase';
/** …and the one a pinned overlay carries when its ref/PR went away without main having it. */
export const PINNED_OVERLAY_GONE_MESSAGE = 'pinned overlay is gone (ref deleted or PR closed) but main does not have it — re-register or unpin it';

/**
 * Is this overlay pinned? Either the entry says `pinned:true`, or its own changes (merge-base(main, tip)..tip)
 * touch {@link REBUILD_MECHANISM_PATHS}. Fail closed: if git cannot answer, treat it as pinned. A wrong "pinned"
 * only makes the rebuild wait for a rebase; a wrong "not pinned" can destroy the mechanism.
 * @returns {{pinned:boolean, why:'flag'|'mechanism'|'unknown'|null}}
 */
function pinnedStatus(git, raw, mainSha, ovSha) {
  if (raw?.pinned === true) return { pinned: true, why: 'flag' };
  if (!ovSha) return { pinned: false, why: null };
  const mb = git(['merge-base', mainSha, ovSha]);
  const base = String(mb.stdout ?? '').trim();
  if (mb.status !== 0 || !base) return { pinned: true, why: 'unknown' };
  const diff = git(['diff', '--name-only', base, ovSha, '--', ...REBUILD_MECHANISM_PATHS]);
  if (diff.status !== 0) return { pinned: true, why: 'unknown' };
  return String(diff.stdout ?? '').trim() ? { pinned: true, why: 'mechanism' } : { pinned: false, why: null };
}

// ── planRebuild — pure over an injected git(args) runner ────────────────────────────────────────────────────

/**
 * PURE (all IO through `git`/`prState`): compute the rebuild plan — resolve `mainRef`, walk `overlays` in list
 * order applying each on top of the running `cur` tip (auto-dropping ones main/PR state has already made moot,
 * conflict-dropping ones that don't merge cleanly THIS pass without forgetting them), and return the resulting
 * final sha plus a full decision log. Never mutates the overlay list itself — {@link rebuildClone} does that
 * from the returned `decisions`.
 * @param {{git:(args:string[], opts?:{env?:object})=>{status:number,stdout:string,stderr:string},
 *   headSha:string, mainRef:string, overlays?:Array<{ref:string, pr?:number|null}>,
 *   prState?:(pr:number)=>(Promise<string|null>|string|null), mainOnly?:boolean}} o
 * @returns {Promise<{ok:false, reason:'main-unresolved'}|{ok:true, mainSha:string, finalSha:string,
 *   applied:Array<{ref:string,pr:number|null,sha:string}>,
 *   decisions:Array<{ref:string,pr:number|null,action:'remove'|'drop'|'apply',reason:string,sha:string|null}>,
 *   alerts:Array<object>, inputsKey:string, upToDate:boolean}>}
 */
export async function planRebuild({
  git, headSha, mainRef, overlays = [], prState, mainOnly = false,
}) {
  const mainSha = verifyRev(git, `${mainRef}^{commit}`);
  if (!mainSha) return { ok: false, reason: 'main-unresolved' };

  const alerts = [];
  const decisions = [];
  const applied = [];
  let cur = mainSha;

  const toProcess = mainOnly ? [] : overlays;
  if (mainOnly && overlays.length > 0) {
    alerts.push({ kind: 'overlays-refused-main-only', detail: { count: overlays.length } });
  }

  // A pinned overlay may only leave the build because main already has it (`pr-merged` / `in-main`). Any other
  // exit (conflict, failed merge/commit, closed PR, deleted ref) REFUSES the whole rebuild instead: the clone
  // keeps its current tree, and nothing on the overlay list changes (see REBUILD_MECHANISM_PATHS).
  const refusePinned = (ref, pr, sha, dropReason, why) => {
    const conflict = ['conflict', 'merge-tree-failed', 'commit-tree-failed'].includes(dropReason);
    return {
      ok: false,
      reason: conflict ? 'pinned-overlay-conflict' : 'pinned-overlay-unavailable',
      detail: {
        ref, pr, sha, dropReason, pinnedBy: why, message: conflict ? PINNED_OVERLAY_MESSAGE : PINNED_OVERLAY_GONE_MESSAGE,
      },
    };
  };

  for (const raw of toProcess) {
    const ref = raw?.ref;
    const pr = raw?.pr ?? null;

    // 1. PR state — MERGED/CLOSED means the overlay is moot; never call prState for a PR-less overlay.
    const state = pr != null && prState ? await prState(pr) : null;
    if (state === 'MERGED' || state === 'CLOSED') {
      if (state === 'CLOSED' && raw?.pinned === true) return refusePinned(ref, pr, null, 'pr-closed', 'flag');
      decisions.push({ ref, pr, action: 'remove', reason: state === 'MERGED' ? 'pr-merged' : 'pr-closed', sha: null });
      continue;
    }

    // 2. resolve the overlay ref's remote-tracking tip.
    const ovSha = verifyRev(git, `refs/remotes/origin/${ref}^{commit}`);
    if (!ovSha) {
      if (raw?.pinned === true) return refusePinned(ref, pr, null, 'ref-gone', 'flag');
      decisions.push({ ref, pr, action: 'remove', reason: 'ref-gone', sha: null });
      continue;
    }
    const dropOrRefuse = (reason) => {
      const p = pinnedStatus(git, raw, mainSha, ovSha);
      if (p.pinned) return refusePinned(ref, pr, ovSha, reason, p.why);
      decisions.push({ ref, pr, action: 'drop', reason, sha: ovSha });
      return null;
    };

    // 3. already upstream-equivalent to main? (`git cherry` compares patch-ids; a failed cherry is treated as
    //    inconclusive — proceed to the merge-tree attempt rather than silently dropping a real overlay.)
    const cherry = git(['cherry', mainSha, ovSha]);
    if (cherry.status === 0) {
      const lines = String(cherry.stdout ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0 || lines.every((l) => l.startsWith('-'))) {
        decisions.push({ ref, pr, action: 'remove', reason: 'in-main', sha: ovSha });
        continue;
      }
    }

    // 4. merge-tree in the object DB — no working tree, no index.
    const mt = git(['merge-tree', '--write-tree', '--no-messages', cur, ovSha]);
    if (mt.status === 1) {
      const refused = dropOrRefuse('conflict');
      if (refused) return refused;
      continue;
    }
    if (mt.status !== 0) {
      const refused = dropOrRefuse('merge-tree-failed');
      if (refused) return refused;
      continue;
    }
    const tree = String(mt.stdout ?? '').split('\n')[0].trim();

    // 5. content already there (e.g. squash-merged) — cherry's patch-id compare can miss this; a direct tree
    //    compare against `cur` catches it regardless of history shape.
    const curTree = verifyRev(git, `${cur}^{tree}`);
    if (tree && curTree && tree === curTree) {
      decisions.push({ ref, pr, action: 'remove', reason: 'in-main', sha: ovSha });
      continue;
    }

    // 6. mint the merge commit — fixed identity, date = the later of the two parents' committer dates, so the
    //    same (cur, ovSha) pair always mints the identical sha (see file header — DETERMINISM).
    const committerDate = (sha) => {
      const r = git(['log', '-1', '--format=%ct', sha]);
      const n = Number(String(r.stdout ?? '').trim());
      return r.status === 0 && Number.isFinite(n) ? n : 0;
    };
    const dateUnix = Math.max(committerDate(cur), committerDate(ovSha));
    const dateStr = `@${dateUnix} +0000`;
    const message = `daemon-rebuild: merge overlay ${ref}${pr != null ? ` (PR #${pr})` : ''} onto ${cur}`;
    const ct = git(['commit-tree', tree, '-p', cur, '-p', ovSha, '-m', message], {
      env: { GIT_AUTHOR_DATE: dateStr, GIT_COMMITTER_DATE: dateStr },
    });
    const newSha = String(ct.stdout ?? '').trim();
    if (ct.status !== 0 || !newSha) {
      const refused = dropOrRefuse('commit-tree-failed');
      if (refused) return refused;
      continue;
    }
    cur = newSha;
    applied.push({ ref, pr, sha: ovSha });
    decisions.push({ ref, pr, action: 'apply', reason: 'applied', sha: ovSha });
  }

  const inputsKey = createHash('sha256')
    .update(JSON.stringify({ main: mainSha, overlays: applied.map((a) => [a.ref, a.sha]) }))
    .digest('hex')
    .slice(0, 16);

  return {
    ok: true, mainSha, finalSha: cur, applied, decisions, alerts, inputsKey, upToDate: cur === headSha,
  };
}

// ── findUnsafeLocalState — pure over an injected git(args) runner ──────────────────────────────────────────

/** `git ls-files --others --exclude-standard -z` — every untracked, non-ignored path in the tree, NUL-separated
 *  so a filename with an embedded newline can never split into two entries. A failed call returns `null`, which
 *  {@link findUnsafeLocalState} treats as `status-failed` (fail closed): without the list, the collision check
 *  before `reset --hard` could not protect an untracked file from being overwritten. */
function collectUntrackedPaths(git) {
  const r = git(['ls-files', '--others', '--exclude-standard', '-z']);
  if (r.status !== 0) return null;
  return String(r.stdout ?? '').split('\0').filter(Boolean);
}

/**
 * PURE: is `root`'s current tree safe for {@link rebuildClone} to move with `git reset --hard`? Fail-closed at
 * every read — an unreadable `status` refuses outright, since we cannot then trust anything else. Precedence
 * (spec doesn't state one explicitly; chosen so a genuine `status`-read failure always dominates, and a live
 * `MERGE_HEAD` — which itself also shows up as "dirty" porcelain output — is reported as the MORE specific
 * `merge-in-progress` rather than the generic `dirty`): `status-failed` > `merge-in-progress` > `dirty` >
 * `local-commits` > safe.
 *
 * UNTRACKED FILES ARE NEVER PART OF THIS SAFETY VERDICT. `git reset --hard` moves tracked content only and
 * never deletes an untracked, non-ignored file sitting in the working tree (`git clean` does that, and this
 * module never calls it — see file header), so the dirty-tree check below reads `--untracked-files=no`: an
 * untracked file must never by itself freeze a rebuild (2026-09-24 freeze: a live daemon clone read as
 * permanently dirty because of an untracked `.conveyor/unsupported-repo.json` sidecar its own process had just
 * written). Every untracked, non-ignored path ({@link collectUntrackedPaths}) is still collected and returned
 * as `untracked` on EVERY result (safe or not) — {@link doRebuild} uses it, after the plan is computed and
 * just before its one `reset --hard`, to refuse with `untracked-collision` if the incoming tree actually has
 * content at one of those paths (the one case a `reset --hard` WOULD silently overwrite something); every
 * other kept untracked path is only reported (`untracked-kept`), never deleted.
 * @param {{git:(args:string[])=>{status:number,stdout:string,stderr:string}}} o
 * @returns {{safe:boolean, reason?:string, detail?:Array<string>|string, untracked:Array<string>}}
 */
export function findUnsafeLocalState({ git, knownInputs = [] }) {
  const listed = collectUntrackedPaths(git);
  if (listed === null) return { safe: false, reason: 'status-failed', detail: 'ls-files --others failed', untracked: [] };
  const untracked = listed;

  const status = git(['status', '--porcelain', '--untracked-files=no']);
  if (status.status !== 0) return { safe: false, reason: 'status-failed', untracked };

  const mergeHead = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
  if (mergeHead.status === 0 && String(mergeHead.stdout ?? '').trim()) {
    return { safe: false, reason: 'merge-in-progress', untracked };
  }

  const dirtyOut = String(status.stdout ?? '').trim();
  if (dirtyOut) {
    return {
      safe: false, reason: 'dirty', detail: dirtyOut.split('\n').map((l) => l.trim()).filter(Boolean), untracked,
    };
  }

  // `knownInputs`: shas this clone was previously BUILT from (the last adopted head + its overlay tips). An
  // overlay whose origin branch was deleted after its PR merged (squash) leaves its commits reachable from HEAD
  // but from no remote ref — they are past inputs, not local work, and must never freeze the rebuild. Only
  // shas that actually exist locally are passed (an unknown sha would make rev-list fail => status-failed).
  const known = knownInputs.filter((sha) => typeof sha === 'string' && /^[0-9a-f]{7,64}$/.test(sha)
    && git(['cat-file', '-e', `${sha}^{commit}`]).status === 0);
  const revList = git(['rev-list', '--no-merges', 'HEAD', '--not', '--remotes=origin', ...known]);
  if (revList.status !== 0) {
    return {
      safe: false, reason: 'status-failed', detail: 'rev-list --no-merges failed', untracked,
    };
  }
  const localShas = String(revList.stdout ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (localShas.length === 0) return { safe: true, untracked };

  // Drop any that are upstream-equivalent (same patch already on origin/main under a different sha, e.g.
  // rebased-and-pushed-elsewhere) — a failed cherry is fail-closed the OTHER way here: keep every candidate
  // rather than risk silently clearing a real local commit off the unsafe list.
  const cherry = git(['cherry', 'origin/main', 'HEAD']);
  let remaining = localShas;
  if (cherry.status === 0) {
    const equivalent = new Set(
      String(cherry.stdout ?? '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-'))
        .map((l) => l.slice(1).trim()),
    );
    remaining = localShas.filter((sha) => !equivalent.has(sha));
  }
  if (remaining.length === 0) return { safe: true, untracked };
  return {
    safe: false, reason: 'local-commits', detail: remaining, untracked,
  };
}

// ── daemon runtime state that lands in TRACKED files — carried out of the tree, never a freeze ─────────────

/**
 * Where a daemon clone's conveyor runtime state lives: the operator's `CONVEYOR_STATE_ROOT` pin when set
 * (#4052), else `<rebuild state dir>/conveyor-state` — OUTSIDE every git tree, next to the rebuild's own state.
 * The layout under it matches `CONVEYOR_STATE_ROOT`'s (`<root>/.conveyor/<file>`), so pinning the env var to
 * this same directory later changes nothing on disk.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function daemonConveyorStateRoot(env = process.env) {
  return pinnedStateRoot(env) ?? join(stateDir(env), 'conveyor-state');
}

/**
 * Is `root` a daemon-managed clone — one the rebuild moves with `reset --hard`? True once it has a rebuild
 * state file or a registered overlay list (both keyed on the same `cloneKey`). A plain checkout or lane has
 * neither. Never throws.
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isDaemonManagedClone(root, env = process.env) {
  try {
    return existsSync(rebuildStatePath(root, env)) || existsSync(overlayFilePath(root, env));
  } catch {
    return false;
  }
}

/**
 * TRACKED files a daemon process (or a session it dispatched) appends runtime state to. A write there must
 * never freeze the rebuild: 2026-09-25 13:36 ET, a review session's scorecard row left
 * `scripts/conveyor/run-scorecards.json` modified in the review-daemon clone, the rebuild refused it as
 * `dirty`, the clone fell 10 commits behind, and every review and fix dispatch refused as STALE. So the
 * rebuild carries each such file's rows into {@link daemonConveyorStateRoot} (a union — no row is lost, none
 * is duplicated), restores the tracked copy, and proceeds. `pinned` is the path under that root; the store
 * module itself (`run-scorecard-store.mjs#resolveScorecardStorePath`) writes to the same place in a daemon
 * clone, so this is the recovery path for rows written by older code, not the normal one. Since #4155 the file
 * is no longer tracked at all and the store writes out-of-tree from every checkout; this entry stays for the one
 * window that still matters — a clone whose tracked copy an OLD-code process modified before the untracking
 * commit reached it: the carry restores it to HEAD so the rebuild can move onto the commit that deletes it.
 */
export const DAEMON_STATE_FILES = Object.freeze([
  Object.freeze({ path: 'scripts/conveyor/run-scorecards.json', pinned: '.conveyor/run-scorecards.json' }),
]);

/** `{version, records:[]}` from JSON text; `null` when it is not that shape (never guessed). */
function parseRecordsStore(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.records)) return null;
    // `migrations` (run-scorecard-store.mjs's one-time-migration stamps, #4155) rides along so a carry never
    // strips them and re-arms a migration that already ran.
    return Array.isArray(parsed.migrations)
      ? { version: parsed.version ?? 1, records: parsed.records, migrations: parsed.migrations }
      : { version: parsed.version ?? 1, records: parsed.records };
  } catch {
    return null;
  }
}

/**
 * The dirty paths in `git status --porcelain` lines, or `null` when any line is not a plain modification
 * (a rename, a delete, a conflict — nothing this module should carry away on its own).
 * @param {Array<string>} lines - trimmed porcelain lines, as {@link findUnsafeLocalState} reports them
 */
function modifiedPathsOf(lines) {
  const paths = [];
  for (const line of lines) {
    const m = /^(M{1,2})\s+(.+)$/.exec(line);
    if (!m) return null;
    paths.push(m[2].trim());
  }
  return paths;
}

/**
 * PURE over `git` + injected fs: when EVERY dirty path is a known {@link DAEMON_STATE_FILES} entry, union each
 * one's rows into its pinned file, then restore the tracked copy (`checkout HEAD -- <path>`). Any other dirt,
 * an unparsable file, or a failed write/restore migrates nothing it cannot prove and returns `ok:false` — the
 * caller then refuses as `dirty`, exactly as before.
 * @param {{git:Function, root:string, dirty:Array<string>, env?:NodeJS.ProcessEnv,
 *   fs?:{read:(p:string)=>string, write:(p:string, s:string)=>void, exists:(p:string)=>boolean}}} o
 * @returns {{ok:boolean, reason?:string, migrated:Array<{path:string, target:string, added:number, total:number}>}}
 */
export function migrateDaemonStateFiles({ git, root, dirty, env = process.env, fs: io }) {
  const fs = io ?? {
    read: (p) => readFileSync(p, 'utf8'),
    write: (p, s) => {
      mkdirSync(dirname(p), { recursive: true });
      const tmp = `${p}.tmp-${process.pid}`;
      writeFileSync(tmp, s, 'utf8');
      renameSync(tmp, p);
    },
    exists: (p) => existsSync(p),
  };
  const paths = modifiedPathsOf(dirty || []);
  if (!paths || paths.length === 0) return { ok: false, reason: 'not-state-files', migrated: [] };
  const known = new Map(DAEMON_STATE_FILES.map((f) => [f.path, f]));
  if (!paths.every((p) => known.has(p))) return { ok: false, reason: 'not-state-files', migrated: [] };

  const migrated = [];
  for (const p of paths) {
    const target = join(daemonConveyorStateRoot(env), known.get(p).pinned);
    // Re-read until the tracked copy is stable across the merge, so a row appended mid-migration is not lost.
    let carried = false;
    for (let attempt = 0; attempt < 3 && !carried; attempt += 1) {
      let text;
      try { text = fs.read(join(root, p)); } catch { return { ok: false, reason: 'state-file-unreadable', migrated }; }
      const working = parseRecordsStore(text);
      if (!working) return { ok: false, reason: 'state-file-unparsable', migrated };
      let pinned = { version: working.version, records: [] };
      if (fs.exists(target)) {
        let pinnedText;
        try { pinnedText = fs.read(target); } catch { return { ok: false, reason: 'pinned-unreadable', migrated }; }
        pinned = parseRecordsStore(pinnedText);
        // Never overwrite a pinned store we cannot read — that would destroy the rows already there.
        if (!pinned) return { ok: false, reason: 'pinned-unparsable', migrated };
      }
      const seen = new Set(pinned.records.map((r) => JSON.stringify(r)));
      const add = working.records.filter((r) => !seen.has(JSON.stringify(r)));
      if (add.length > 0) {
        try {
          fs.write(target, `${JSON.stringify({ ...pinned, version: pinned.version ?? 1, records: [...pinned.records, ...add] }, null, 2)}\n`);
        } catch { return { ok: false, reason: 'pinned-write-failed', migrated }; }
      }
      let after;
      try { after = fs.read(join(root, p)); } catch { after = null; }
      if (after !== text) continue;
      const restore = git(['checkout', 'HEAD', '--', p]);
      if (restore.status !== 0) return { ok: false, reason: 'restore-failed', migrated };
      migrated.push({ path: p, target, added: add.length, total: pinned.records.length + add.length });
      carried = true;
    }
    if (!carried) return { ok: false, reason: 'state-file-busy', migrated };
  }
  return { ok: true, migrated };
}

// ── fetch helper shared by rebuildClone and dryRunRebuild ───────────────────────────────────────────────────

/** Fetch `origin/main` + every (safe-named) overlay ref via explicit refspecs. A batched fetch failure refetches
 *  `main` alone; if THAT also fails the caller gets `{ok:false, reason:'fetch-failed'}` (transient — main itself
 *  is unreachable). Otherwise each overlay ref is fetched individually and a failure there is `ref-gone` (its
 *  stale remote-tracking ref is deleted so a later `--not --remotes=origin`/`refs/remotes/origin/<ref>` read
 *  never sees stale data for it). */
function fetchMainAndOverlays({ git, overlays }) {
  const safeOverlays = overlays.filter((o) => isSafeBranchName(o?.ref));
  const refspecs = [
    '+refs/heads/main:refs/remotes/origin/main',
    ...safeOverlays.map((o) => `+refs/heads/${o.ref}:refs/remotes/origin/${o.ref}`),
  ];
  const batch = git(['fetch', '--quiet', '--prune', 'origin', ...refspecs]);
  if (batch.status === 0) return { ok: true, goneRefs: [] };

  const mainOnlyFetch = git(['fetch', '--quiet', '--prune', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  if (mainOnlyFetch.status !== 0) return { ok: false, reason: 'fetch-failed' };

  const goneRefs = [];
  for (const o of safeOverlays) {
    const one = git(['fetch', '--quiet', 'origin', `+refs/heads/${o.ref}:refs/remotes/origin/${o.ref}`]);
    if (one.status !== 0) {
      git(['update-ref', '-d', `refs/remotes/origin/${o.ref}`]);
      goneRefs.push(o.ref);
    }
  }
  return { ok: true, goneRefs };
}

// ── per-clone rebuild state (outside the git tree, per clause 3(iii) — same posture as daemon-overlays.mjs) ──

/** Env var pinning the rebuild-state root outside any git tree. */
export const WE_DAEMON_STATE_DIR_ENV = 'WE_DAEMON_STATE_DIR';

function stateDir(env = process.env) {
  return (env && env[WE_DAEMON_STATE_DIR_ENV]) || join(homedir(), '.claude', 'daemon-self-sync-state');
}

/** `<stateDir>/<cloneKey>.rebuild.json` — reuses `daemon-overlays.mjs#cloneKey` so every per-clone state file
 *  (overlay list, rebuild state) keys on the SAME identity, never re-derived.
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function rebuildStatePath(root, env = process.env) {
  return join(stateDir(env), `${cloneKey(root)}.rebuild.json`);
}

function alertsFilePath(root, env = process.env) {
  return join(stateDir(env), `${cloneKey(root)}.alerts.jsonl`);
}

const EMPTY_STATE = Object.freeze({
  adopted: null, rejected: null, inProgress: null, quarantine: null, unverified: null,
});

/**
 * Read the per-clone rebuild state, never throwing — a missing or corrupt file reads as the empty state (fail
 * closed to "nothing adopted, nothing rejected, nothing in progress", never a crash).
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{adopted:object|null, rejected:object|null, inProgress:object|null, quarantine:object|null,
 *   unverified:{head:string, prevHead:string}|null}}
 */
export function readRebuildState(root, env = process.env) {
  try {
    const parsed = JSON.parse(readFileSync(rebuildStatePath(root, env), 'utf8'));
    return {
      adopted: parsed?.adopted ?? null,
      rejected: parsed?.rejected ?? null,
      inProgress: parsed?.inProgress ?? null,
      quarantine: parsed?.quarantine ?? null,
      unverified: parsed?.unverified ?? null,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** Atomic write — `<file>.tmp-<pid>` then `renameSync`, same posture as `daemon-overlays.mjs#writeOverlays`. */
function writeRebuildState(root, state, env = process.env) {
  const file = rebuildStatePath(root, env);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, file);
}

// ── defaultPrState — the CLI's real PR-state lookup ─────────────────────────────────────────────────────────

function slugFromOriginUrl(url) {
  const m = String(url || '').trim().match(/github\.com[:/]+([^/]+)\/([^/.]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Real-world `prState`: `gh pr view <n> --repo <slug from origin's url> --json state -q .state`, 20s timeout.
 * ANY failure (no `gh`, no auth, unresolvable slug, timeout) reads as `null` — unknown, and {@link planRebuild}
 * never removes an overlay on an unknown PR state, only on a confirmed MERGED/CLOSED.
 * @param {{pr:number, root:string}} o
 * @returns {string|null}
 */
export function defaultPrState({ pr, root }) {
  if (pr == null) return null;
  try {
    const urlRes = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
    });
    const slug = urlRes.status === 0 ? slugFromOriginUrl(urlRes.stdout) : null;
    if (!slug) return null;
    const ghRes = spawnSync('gh', ['pr', 'view', String(pr), '--repo', slug, '--json', 'state', '-q', '.state'], {
      encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
    });
    if (ghRes.status !== 0) return null;
    const out = String(ghRes.stdout || '').trim();
    return out || null;
  } catch {
    return null;
  }
}

// ── smoke-rejection helpers ────────────────────────────────────────────────────────────────────────────────

/** Did only EXTERNAL checks fail? Every failed row is one `daemon-live-smoke.mjs#SMOKE_CHECKS` marks
 *  `mayBeTransient` (it runs `gh`, not code from the tree under test). An empty list is not external-only. */
export function isExternalOnlyFailure(failed) {
  return Array.isArray(failed) && failed.length > 0 && failed.every((r) => r && r.mayBeTransient !== false);
}

/** How long a tick-start rebuild waits for other daemons' ticks (read slots) to drain — env-tunable, see rebuildClone. */
export const REBUILD_LOCK_WAIT_ENV = 'WE_DAEMON_REBUILD_LOCK_WAIT_MS';
export const DEFAULT_REBUILD_LOCK_WAIT_MS = 60_000;

/** A live smoke at least this long raises a `smoke-slow` alert — informational only (xa4qo7n): the smoke runs
 *  against a disposable candidate worktree and holds NO lock, so a slow one no longer starves any daemon's
 *  ticks the way it did before this fix; it is still worth knowing about (it delays adopting new code). */
export const SLOW_SMOKE_ALERT_MS = 60_000;

/** Backoff before an external-only rejection is re-smoked: base * 2^(attempts-1), capped. Env-tunable. */
export function rejectRetryDelayMs(env, attempts) {
  const base = Number(env?.WE_DAEMON_REJECT_RETRY_BASE_MS) || 5 * 60_000;
  const max = Number(env?.WE_DAEMON_REJECT_RETRY_MAX_MS) || 60 * 60_000;
  return Math.min(base * 2 ** Math.max(0, attempts - 1), max);
}

/** A failed check's detail, safe for the alerts log: tokens redacted, one bounded line. */
function redactDetail(detail) {
  return String(detail ?? '').replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '$1<redacted>').slice(0, 500);
}

// ── candidate worktree (xa4qo7n) — where the live smoke actually runs, never `root` ─────────────────────────

/**
 * Fixed per-clone staging path for the candidate worktree the live smoke runs against — OUTSIDE any git tree,
 * same `stateDir`/`cloneKey` convention as every other per-clone sidecar this module owns. FIXED (not a fresh
 * `mkdtemp` per attempt) so a crashed attempt's leftover worktree is found and torn down by the very next
 * attempt ({@link materializeCandidate}) instead of accumulating orphan directories on disk.
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function candidateWorktreePath(root, env = process.env) {
  return join(stateDir(env), `${cloneKey(root)}.candidate`);
}

/**
 * Check `sha` out into a disposable `git worktree` at {@link candidateWorktreePath} — a SECOND working copy of
 * the SAME `root` repository (`git worktree add` shares the object database; this never fetches or copies a
 * single object, unlike {@link dryRunRebuild}'s separate scratch-bare-repo trick, which exists only because a
 * dry run must never write anything into `root`'s own refs — this module already owns `root` outright once it
 * holds the write lock, so a plain worktree is enough). A stale worktree already at the fixed path (a crashed
 * prior attempt) is force-torn-down first so orphans never accumulate. `node_modules` is symlinked in from
 * `root` on a best-effort basis — a fresh worktree checkout carries only git-tracked files, and the live
 * smoke's checks spawn real `node`/`gh` child processes from it that need real dependencies; a repo with no
 * `node_modules` (or one whose checks then fail on a missing module) surfaces that as an ordinary check
 * failure, never a silent skip.
 *
 * xa4qo7n LIVE BUG, caught proving this very fix (2026-09-26 15:20 ET on `wev-review-daemon`): a `node_modules/`
 * `.gitignore` entry (the near-universal convention — trailing slash, "directories only") does NOT match a
 * SYMLINK of the same name (confirmed: `git status --porcelain` reports `?? node_modules` for a symlink even
 * with that exact ignore rule in place), so the symlink this function creates made {@link checkTreeStaysClean}
 * ALWAYS see the candidate as dirty — poisoning the reject-cache (`tree-stays-clean` is `mayBeTransient:false`)
 * on every single rebuild that reached this step, in a repo with a `node_modules/`-style ignore rule. Fixed by
 * {@link ensureNodeModulesExcluded}: a one-time, idempotent, repo-wide `node_modules` line (no trailing slash —
 * matches files AND symlinks, not just real directories) appended to the shared `info/exclude` (this is NOT
 * per-worktree; git resolves it from `--git-common-dir`, confirmed empirically — a PRIVATE per-worktree
 * `info/exclude` file is never even read), so every worktree's status reads the symlink as ignored, exactly
 * like the tracked `.gitignore` already treats the real directory.
 * @param {{root:string, sha:string, run:typeof gitRun, env?:NodeJS.ProcessEnv}} o
 * @returns {{ok:true, path:string}|{ok:false, reason:string}}
 */
export function materializeCandidate({ root, sha, run, env }) {
  const path = candidateWorktreePath(root, env);
  const git = makeGit({ run, cwd: root, env, timeoutMs: 120_000 });
  git(['worktree', 'remove', '--force', path]);
  try { rmSync(path, { recursive: true, force: true }); } catch { /* best-effort teardown of a stale attempt */ }
  git(['worktree', 'prune']);
  mkdirSync(dirname(path), { recursive: true });
  const add = git(['worktree', 'add', '--detach', '--quiet', path, sha]);
  if (add.status !== 0) {
    return { ok: false, reason: `worktree-add-failed: ${String(add.stderr || add.stdout || '').trim().split('\n')[0]}` };
  }
  try {
    const nodeModules = join(root, 'node_modules');
    if (existsSync(nodeModules) && !existsSync(join(path, 'node_modules'))) {
      ensureNodeModulesExcluded({ root, git });
      symlinkSync(nodeModules, join(path, 'node_modules'), 'dir');
    }
  } catch { /* best-effort — see docblock above */ }
  return { ok: true, path };
}

/**
 * One-time, idempotent: append a bare `node_modules` line (no trailing slash, so it matches a SYMLINK too, not
 * only a real directory — see {@link materializeCandidate}'s docblock) to the repo's shared `info/exclude`,
 * unless a line already says exactly that. Best-effort — a failure here just means a future candidate's
 * `tree-stays-clean` check may see the symlink as dirt, same as before this fix; it never blocks the build.
 * @param {{root:string, git:(args:string[])=>{status:number,stdout:string,stderr:string}}} o
 */
function ensureNodeModulesExcluded({ root, git }) {
  const gd = git(['rev-parse', '--git-common-dir']);
  if (gd.status !== 0) return;
  const raw = String(gd.stdout || '').trim();
  if (!raw) return;
  const commonDir = isAbsolute(raw) ? raw : resolvePath(root, raw);
  const excludePath = join(commonDir, 'info', 'exclude');
  let existing = '';
  try { existing = readFileSync(excludePath, 'utf8'); } catch { /* missing is fine — starts empty */ }
  if (existing.split('\n').map((l) => l.trim()).includes('node_modules')) return; // already present
  mkdirSync(dirname(excludePath), { recursive: true });
  writeFileSync(excludePath, `${existing.replace(/\n?$/, '\n')}node_modules\n`);
}

/** Best-effort teardown of a candidate worktree — never throws. A failure here just leaves the fixed path for
 *  the NEXT {@link materializeCandidate} call to clear before it reuses it. */
export function removeCandidate({ root, path, run, env }) {
  const git = makeGit({ run, cwd: root, env, timeoutMs: 60_000 });
  try { git(['worktree', 'remove', '--force', path]); } catch { /* best-effort */ }
  try { rmSync(path, { recursive: true, force: true }); } catch { /* best-effort */ }
  try { git(['worktree', 'prune']); } catch { /* best-effort */ }
}

/**
 * PURE-ish (one alert side-effect): is `root` still safe to move, migrating known daemon-state-file dirt out of
 * the way first (see {@link migrateDaemonStateFiles}) exactly as the old single-phase `doRebuild` did at its own
 * Step 1 — shared by {@link prepareRebuild} (before the candidate is even built) and {@link finalizeRebuild}
 * (re-checked right before the one `reset --hard`, since real time — an unlocked smoke — passed in between).
 * @returns {{safe:boolean, reason?:string, detail?:*, untracked:Array<string>}}
 */
function ensureSafeToMove({
  git, root, env, stEnv, alert, knownInputs,
}) {
  let unsafe = findUnsafeLocalState({ git, knownInputs });
  if (!unsafe.safe && unsafe.reason === 'dirty') {
    const mig = migrateDaemonStateFiles({
      git, root, dirty: unsafe.detail, env: stEnv,
    });
    for (const m of mig.migrated) alert('state-file-migrated', m);
    if (mig.ok) unsafe = findUnsafeLocalState({ git, knownInputs });
    else if (mig.reason !== 'not-state-files') alert('state-file-migrate-failed', { reason: mig.reason });
  }
  return unsafe;
}

/** The one "this clone is being held off origin/main" alert both {@link prepareRebuild} and
 *  {@link finalizeRebuild} raise on a non-moving, non-adopting, plan-ok, behind-main result — factored out so
 *  both phases (which each read their OWN fresh `state`, see file header) compute it identically. */
function staleAlertDetail(result, state) {
  if (result.moved || result.adopted || !result.plan?.ok || result.plan.upToDate) return null;
  return {
    reason: result.reason,
    mainSha: result.plan.mainSha,
    target: result.plan.finalSha,
    retryAt: state.rejected?.inputsKey === result.plan.inputsKey ? (state.rejected.retryAt ?? null) : null,
    message: 'the rebuild is holding this clone off origin/main — dispatches from it refuse as stale until this clears',
  };
}

// ── rebuildClone — the IO shell ──────────────────────────────────────────────────────────────────────────────

/** Shas a clone was previously built from — see {@link findUnsafeLocalState}'s `knownInputs`. */
function knownInputsOf(state) {
  return [
    state?.adopted?.head, state?.adopted?.mainSha, ...((state?.adopted?.applied) || []).map((a) => a?.sha),
    state?.quarantine?.prevHead,
  ].filter(Boolean);
}

/**
 * Phase 1 (LOCKED, fast — no smoke, no `reset --hard`): recovery, safety, fetch, `planRebuild`, overlay-list
 * edits, and the up-to-date/still-rejected/untracked-collision short-circuits — everything the old single-phase
 * `doRebuild` did in its Steps 0-4.5. Returns EITHER `{terminal:true, result, alerts}` (a final `rebuildClone`
 * result — the caller returns it as-is) or `{terminal:false, plan, prevHead, alerts}` (proceed to build +
 * smoke a candidate — see {@link rebuildClone}).
 */
async function prepareRebuild({
  root, env, log, run, prState, stateOpts, mainOnly, now,
}) {
  const stEnv = { ...env, ...(stateOpts?.env || {}) };
  const git = makeGit({ run, cwd: root, env });
  const alertsList = [];
  const nowMs = () => now();
  const nowIso = () => new Date(nowMs()).toISOString();

  const alert = (kind, detail) => {
    alertsList.push({ kind, detail });
    log?.error?.(`daemon-rebuild: ${kind}${detail !== undefined ? ` ${JSON.stringify(detail)}` : ''}`);
    try {
      const file = alertsFilePath(root, stEnv);
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${JSON.stringify({ at: nowIso(), kind, detail })}\n`, 'utf8');
    } catch { /* best-effort audit trail only */ }
  };
  const terminal = (result) => {
    // A clone the rebuild will NOT advance while origin/main (or an overlay) has moved is STALE — every dispatch
    // from it refuses as stale-main. Say so loudly, every tick it stays that way, instead of leaving the daemons
    // silently refusing everything (live 2026-09-25 08:14 ET: held by a still-rejected smoke, refused 6/tick).
    const stale = staleAlertDetail(result, state);
    if (stale) alert('clone-held-stale', stale);
    return { terminal: true, result, alerts: alertsList };
  };

  const state = readRebuildState(root, stEnv);
  const writeState = () => writeRebuildState(root, state, stEnv);

  // ── Step 0: recovery ──────────────────────────────────────────────────────────────────────────────────
  const indexLockPath = join(root, '.git', 'index.lock');
  try {
    const st = statSync(indexLockPath);
    const staleMs = Number(env?.WE_DAEMON_INDEX_LOCK_STALE_MS) || 120_000;
    if (nowMs() - st.mtimeMs > staleMs) {
      unlinkSync(indexLockPath);
      alert('index-lock-recovered', { ageMs: nowMs() - st.mtimeMs });
    } else {
      return terminal({ moved: false, reason: 'index-locked' });
    }
  } catch { /* no index.lock present — nothing to recover */ }

  if (state.inProgress) {
    const staleMs = Number(env?.WE_DAEMON_REBUILD_STALE_MS) || 30 * 60_000;
    const sameHost = state.inProgress.host === hostname();
    const pidDead = sameHost && (() => {
      try { process.kill(state.inProgress.pid, 0); return false; } catch (e) { return e && e.code === 'ESRCH'; }
    })();
    const startedMs = Date.parse(state.inProgress.startedAt || '');
    const aged = Number.isFinite(startedMs) && nowMs() - startedMs > staleMs;
    if (pidDead || aged) {
      const headNow = verifyRev(git, 'HEAD');
      const clean = findUnsafeLocalState({ git, knownInputs: knownInputsOf(state) }).safe;
      const ip = state.inProgress;
      if (headNow === ip.target || (headNow === ip.prevHead && clean)) {
        state.inProgress = null;
        // xa4qo7n — under THIS design a `reset --hard` NEVER runs before its candidate's live smoke has already
        // passed (see file header), so `headNow === target` here can only mean: the reset landed, the process
        // died before the state write right after it, and the smoke for this EXACT build already passed. Promote
        // it straight to `adopted` from the inProgress record's own echoed plan fields — no re-smoke needed (a
        // real change from the pre-fix design, where the smoke ran AFTER the reset and a crash here really could
        // mean an unverified build on disk — see `agent-memory`/PR #2625's own advisory for that history).
        const promote = headNow === ip.target && ip.target !== ip.prevHead;
        if (promote) {
          state.adopted = {
            head: ip.target, inputsKey: ip.inputsKey ?? null, mainSha: ip.mainSha ?? null, applied: ip.applied ?? [], at: nowIso(),
          };
          state.rejected = null;
          writeState();
          alert('rebuild-interrupted-recovered', { target: ip.target, headNow, promoted: true });
          // Short-circuit here (unlike the non-promoted branch below, which falls through to a fresh plan this
          // same tick): this build is now FULLY adopted, so there is nothing else for this tick to decide.
          return terminal({
            moved: false, adopted: true, reason: 'recovered-adopted', head: ip.target,
          });
        }
        writeState();
        alert('rebuild-interrupted-recovered', { target: ip.target, headNow, promoted: false });
      } else {
        alert('rebuild-interrupted-unrecoverable', { inProgress: state.inProgress, headNow });
        return terminal({ moved: false, reason: 'rebuild-interrupted-unrecoverable' });
      }
    }
  }

  if (state.quarantine) {
    // Same definition of "clean" as findUnsafeLocalState: tracked changes only (an untracked sidecar must never
    // freeze recovery), plus the same untracked-collision guard Step 4.5 runs — refuse if prevHead has content
    // at an untracked path, since this `reset --hard` would silently overwrite it.
    const { prevHead: qHead } = state.quarantine;
    const status = git(['status', '--porcelain', '--untracked-files=no']);
    const untracked = collectUntrackedPaths(git);
    const clean = status.status === 0 && !String(status.stdout ?? '').trim() && untracked !== null
      && !untracked.some((p) => git(['cat-file', '-e', `${qHead}:${p}`]).status === 0);
    const reset = clean ? git(['reset', '--hard', state.quarantine.prevHead]) : { status: 1 };
    if (clean && reset.status === 0) {
      state.quarantine = null;
      writeState();
    } else {
      return terminal({ moved: false, reason: 'quarantined' });
    }
  }

  // ── Step 1: must be on main, and the local tree must be safe to move ────────────────────────────────────
  const headRef = git(['symbolic-ref', '--short', 'HEAD']);
  const onMain = headRef.status === 0 ? String(headRef.stdout ?? '').trim() === 'main' : null;
  if (!onMain) {
    alert('not-on-main', { onMain });
    return terminal({ moved: false, reason: 'not-on-main' });
  }

  const unsafe = ensureSafeToMove({
    git, root, env, stEnv, alert, knownInputs: knownInputsOf(state),
  });
  if (!unsafe.safe) {
    alert(unsafe.reason, unsafe.detail);
    return terminal({ moved: false, reason: unsafe.reason });
  }
  // Report kept untracked paths on EVERY tick that gets this far — including no-op (`up-to-date`,
  // `still-rejected`) ticks — not only when the tree moves. `reset --hard` never removes them, so an
  // unexpected file (nothing daemon-written should be here: `.conveyor/` and host-local settings are
  // gitignored, and ignored paths are not listed) keeps showing up in the alert log for as long as it stays.
  if (unsafe.untracked.length > 0) alert('untracked-kept', { paths: unsafe.untracked });

  const prevHead = verifyRev(git, 'HEAD');
  if (!prevHead) {
    alert('head-unresolved');
    return terminal({ moved: false, reason: 'head-unresolved' });
  }

  // ── Step 2: fetch ────────────────────────────────────────────────────────────────────────────────────
  // A corrupt overlay file reads as an empty list. Building on that would quietly rebuild onto main alone and
  // drop every registered fix, so refuse and alert instead (mainOnly ignores overlays anyway, so it proceeds).
  const overlayState = readOverlayState(root, { env });
  if (overlayState.corrupt) {
    alert('overlay-state-corrupt', { file: overlayFilePath(root, env) });
    if (!mainOnly) return terminal({ moved: false, reason: 'overlay-state-corrupt' });
  }
  const overlaysBefore = overlayState.overlays;
  const fetchResult = fetchMainAndOverlays({ git, overlays: overlaysBefore });
  if (!fetchResult.ok) {
    alert('fetch-failed');
    return terminal({ moved: false, reason: 'fetch-failed' });
  }
  for (const ref of fetchResult.goneRefs) alert('overlay-ref-gone-on-fetch', { ref });

  // ── Step 3: plan + apply list edits ─────────────────────────────────────────────────────────────────
  const plan = await planRebuild({
    git, headSha: prevHead, mainRef: 'origin/main', overlays: overlaysBefore, prState, mainOnly,
  });
  if (!plan.ok) {
    // A pinned refusal keeps the current tree AND the overlay list untouched (no decisions were applied).
    alert(plan.reason, plan.detail);
    return terminal({ moved: false, reason: plan.reason, ...(plan.detail ? { detail: plan.detail } : {}) });
  }
  for (const d of plan.decisions) {
    if (d.action === 'remove') {
      removeOverlay(root, d.ref, { env, why: d.reason });
      appendOverlayEvent(root, { kind: 'auto-dropped', ref: d.ref, pr: d.pr, reason: d.reason }, { env });
      alert('overlay-auto-dropped', { ref: d.ref, reason: d.reason });
    } else if (d.action === 'drop') {
      alert('overlay-conflict-dropped', { ref: d.ref, reason: d.reason });
    }
  }
  for (const kind of plan.alerts) alert(kind.kind, kind.detail);

  // ── Step 4: up-to-date / still-rejected short-circuits ──────────────────────────────────────────────
  if (plan.upToDate) {
    if (!state.adopted || state.adopted.inputsKey !== plan.inputsKey) {
      state.adopted = {
        head: plan.finalSha, inputsKey: plan.inputsKey, mainSha: plan.mainSha, applied: plan.applied, at: nowIso(),
      };
      writeState();
    }
    return terminal({ moved: false, reason: 'up-to-date', plan });
  }
  if (state.rejected?.inputsKey === plan.inputsKey) {
    // An external-only rejection (only gh/network checks failed) is never permanent: once its backoff expires
    // the same inputs are smoked again, instead of sticking until main or an overlay moves.
    const retryAtMs = Date.parse(state.rejected.retryAt || '');
    if (!(Number.isFinite(retryAtMs) && nowMs() >= retryAtMs)) {
      return terminal({ moved: false, reason: 'still-rejected', plan });
    }
    alert('rejected-retry-due', { inputsKey: plan.inputsKey, attempts: state.rejected.attempts ?? 1 });
  }

  // ── Step 4.5: untracked-collision guard — a `reset --hard` keeps untracked files, but SILENTLY OVERWRITES
  //    one if the incoming tree has real content at that same path. Check every untracked path from Step 1's
  //    `unsafe.untracked` against the target tree; anything not present there is harmless (already reported as
  //    `untracked-kept` after Step 1). Re-checked again in {@link finalizeRebuild} right before the actual
  //    `reset --hard`, since real (unlocked) time passes for the smoke in between.
  if (unsafe.untracked.length > 0) {
    const colliding = unsafe.untracked.filter((p) => git(['cat-file', '-e', `${plan.finalSha}:${p}`]).status === 0);
    if (colliding.length > 0) {
      alert('untracked-collision', { paths: colliding });
      return terminal({ moved: false, reason: 'untracked-collision', untracked: colliding, plan });
    }
  }

  // Nothing left that can be decided without smoking a candidate first — hand off to rebuildClone's unlocked
  // build+smoke step, then {@link finalizeRebuild}.
  return {
    terminal: false, plan, prevHead, alerts: alertsList,
  };
}

/**
 * Phase 3 (LOCKED, fast — reached ONLY after phase 2's unlocked smoke, run by {@link rebuildClone}, already
 * PASSED): re-verifies nothing else moved `root` while the smoke ran, then performs the ONE `git reset --hard`
 * this module ever does, and writes `state.adopted`. On a FAILING smoke this is never called at all — `root`
 * was never touched, so {@link rebuildClone} handles that case itself, with no lock and nothing to roll back.
 */
async function finalizeRebuild({
  root, env, log, run, stateOpts, now, plan, prevHead,
}) {
  const stEnv = { ...env, ...(stateOpts?.env || {}) };
  const git = makeGit({ run, cwd: root, env });
  const alertsList = [];
  const nowMs = () => now();
  const nowIso = () => new Date(nowMs()).toISOString();

  const alert = (kind, detail) => {
    alertsList.push({ kind, detail });
    log?.error?.(`daemon-rebuild: ${kind}${detail !== undefined ? ` ${JSON.stringify(detail)}` : ''}`);
    try {
      const file = alertsFilePath(root, stEnv);
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${JSON.stringify({ at: nowIso(), kind, detail })}\n`, 'utf8');
    } catch { /* best-effort audit trail only */ }
  };
  const state = readRebuildState(root, stEnv);
  const writeState = () => writeRebuildState(root, state, stEnv);
  const terminal = (result) => {
    const stale = staleAlertDetail(result, state);
    if (stale) alert('clone-held-stale', stale);
    return { ...result, alerts: alertsList };
  };

  // Defensive re-check: real (unlocked) time passed for the smoke since `prepareRebuild` read `prevHead`. Either
  // a SIBLING process's own rebuild already landed this EXACT build (align state and stop, no error), or
  // something else moved `root` entirely (abandon this attempt cleanly; the next tick recomputes a fresh plan).
  const headNow = verifyRev(git, 'HEAD');
  if (headNow === plan.finalSha) {
    if (!state.adopted || state.adopted.inputsKey !== plan.inputsKey) {
      state.adopted = {
        head: plan.finalSha, inputsKey: plan.inputsKey, mainSha: plan.mainSha, applied: plan.applied, at: nowIso(),
      };
      state.rejected = null;
      writeState();
    }
    return terminal({
      moved: false, adopted: true, reason: 'already-adopted', head: plan.finalSha, plan,
    });
  }
  if (headNow !== prevHead) {
    alert('root-changed-during-smoke', { expectedPrevHead: prevHead, headNow });
    return terminal({ moved: false, reason: 'root-changed-during-smoke', plan });
  }

  // Re-run the same safety gate `prepareRebuild` already passed — the tree could, in principle, have picked up
  // new dirt during the unlocked smoke window (see {@link ensureSafeToMove}'s docblock).
  const unsafe = ensureSafeToMove({
    git, root, env, stEnv, alert, knownInputs: knownInputsOf(state),
  });
  if (!unsafe.safe) {
    alert(unsafe.reason, unsafe.detail);
    return terminal({ moved: false, reason: unsafe.reason, plan });
  }
  if (unsafe.untracked.length > 0) {
    const colliding = unsafe.untracked.filter((p) => git(['cat-file', '-e', `${plan.finalSha}:${p}`]).status === 0);
    if (colliding.length > 0) {
      alert('untracked-collision', { paths: colliding });
      return terminal({ moved: false, reason: 'untracked-collision', untracked: colliding, plan });
    }
  }

  // ── The ONE `reset --hard` this module performs — always AFTER a passing smoke, never before. ──────────
  state.inProgress = {
    pid: process.pid, host: hostname(), prevHead, target: plan.finalSha, startedAt: nowIso(),
    inputsKey: plan.inputsKey, mainSha: plan.mainSha, applied: plan.applied,
  };
  writeState();
  try {
    const reset = git(['reset', '--hard', plan.finalSha]);
    if (reset.status !== 0) {
      const rollback = git(['reset', '--hard', prevHead]);
      const rolledBack = rollback.status === 0;
      // A failed reset may have half-moved the tree; if the rollback also failed, its state is unknown —
      // quarantine so no later tick builds or runs on it.
      if (!rolledBack) state.quarantine = { prevHead, reason: 'reset-rollback-failed' };
      state.inProgress = null;
      writeState();
      alert('reset-failed', { target: plan.finalSha, rolledBack });
      return terminal({
        moved: false, reason: 'reset-failed', rolledBack, ...(rolledBack ? {} : { quarantine: true }), plan,
      });
    }
    state.adopted = {
      head: plan.finalSha, inputsKey: plan.inputsKey, mainSha: plan.mainSha, applied: plan.applied, at: nowIso(),
    };
    state.rejected = null;
    state.inProgress = null;
    writeState();
    return terminal({
      moved: true, adopted: true, head: plan.finalSha, prevHead, plan,
    });
  } catch (e) {
    const rollback = git(['reset', '--hard', prevHead]);
    if (rollback.status !== 0) {
      state.quarantine = { prevHead, reason: 'rebuild-threw' };
      state.inProgress = null;
      writeState();
      alert('rollback-failed', { prevHead, error: String(e?.message || e) });
      return terminal({ moved: false, reason: 'rollback-failed', quarantine: true, plan });
    }
    state.inProgress = null;
    writeState();
    alert('rebuild-threw', { error: String(e?.message || e) });
    return terminal({ moved: false, reason: 'rebuild-error', plan });
  }
}

/**
 * Rebuild `root` fresh from `origin/main` + its registered overlay list. See the file header (xa4qo7n) for the
 * full three-step design — {@link prepareRebuild} (locked, fast) → build + smoke a disposable candidate
 * (UNLOCKED — the live smoke never runs against `root` and never holds its write lock) →
 * {@link finalizeRebuild} (locked, fast, reached only after a passing smoke). A lock refusal at either locked
 * step is reported, never treated as an error.
 * @param {{root:string, env?:NodeJS.ProcessEnv, log?:Console, run?:typeof gitRun, runSmoke?:typeof runLiveSmokeWithRetry,
 *   prState?:(pr:number)=>(Promise<string|null>|string|null), lockOpts?:object, stateOpts?:{env?:NodeJS.ProcessEnv},
 *   mainOnly?:boolean, now?:()=>number, sleep?:(ms:number)=>Promise<void>}} o
 * @returns {Promise<object>}
 */
export async function rebuildClone({
  root, env = process.env, log = console, run = gitRun, runSmoke = runLiveSmokeWithRetry,
  prState = (pr) => defaultPrState({ pr, root }), lockOpts = {}, stateOpts = {}, mainOnly = false,
  now = () => Date.now(), sleep,
} = {}) {
  const lockRootFromEnv = env && env.WE_DAEMON_CLONE_LOCK_ROOT;
  // #4044 (live 2026-09-25 10:28-10:40 ET): the fix daemon's tick-start rebuild waited SILENTLY up to the lock's
  // 600s default for the review daemon's 10-minute tick to release its read slot — no ticks, no log line. A
  // rebuild is opportunistic (the next tick retries it), so it now waits at most WE_DAEMON_REBUILD_LOCK_WAIT_MS
  // (default 60s), says so when it starts waiting, and records the give-up.
  const waitMs = Number(env?.[REBUILD_LOCK_WAIT_ENV]) > 0 ? Number(env[REBUILD_LOCK_WAIT_ENV]) : DEFAULT_REBUILD_LOCK_WAIT_MS;
  const finalLockOpts = {
    ...(lockRootFromEnv ? { lockRoot: lockRootFromEnv } : {}),
    now,
    waitMs,
    onBlocked: ({ blockers, waitMs: w }) => log.error?.(
      `daemon-rebuild: waiting up to ${Math.round(w / 1000)}s for live reader(s) ${blockers.join(', ')} to finish their tick before moving the clone (#4044)`,
    ),
    ...(sleep ? { sleep } : {}),
    ...lockOpts,
  };
  const stEnv = { ...env, ...(stateOpts?.env || {}) };

  // ── Phase 1 (locked, fast) ───────────────────────────────────────────────────────────────────────────────
  const startedMs = now();
  const prep = await withWriteLock(root, () => prepareRebuild({
    root, env, log, run, prState, stateOpts, mainOnly, now,
  }), finalLockOpts);

  if (!prep.ok) {
    if (prep.reason === 'tick-in-progress') {
      log.error?.(`daemon-rebuild: gave up after ${Math.round((now() - startedMs) / 1000)}s — reader ${prep.heldBy ?? '?'} still ticking; this tick runs on the current tree and the next one retries (#4044)`);
    }
    return { moved: false, reason: prep.reason, ...(prep.heldBy ? { heldBy: prep.heldBy } : {}) };
  }
  if (prep.value.terminal) {
    return { ...prep.value.result, alerts: prep.value.alerts };
  }
  const { plan, prevHead, alerts: prepAlerts } = prep.value;

  // ── Phase 2 (UNLOCKED — the whole point of xa4qo7n): build + smoke a disposable candidate ───────────────
  const candidate = materializeCandidate({
    root, sha: plan.finalSha, run, env,
  });
  if (!candidate.ok) {
    log.error?.(`daemon-rebuild: candidate-worktree-failed (${candidate.reason}) — not adopting ${plan.finalSha}, retrying next tick`);
    return {
      moved: false, reason: 'candidate-worktree-failed', detail: candidate.reason, plan, alerts: prepAlerts,
    };
  }

  // #4044: the files changed since the LAST LIVE-VERIFIED build (HEAD before this move, when it is the adopted
  // one) — lets the smoke skip a tree-code check whose code none of them touch (see daemon-live-smoke.mjs
  // SMOKE_CHECKS). Unknown (not the adopted head, a failed diff) ⇒ null ⇒ full smoke.
  let changedFiles = null;
  const readState = readRebuildState(root, stEnv);
  if (readState.adopted?.head && readState.adopted.head === prevHead) {
    const d = makeGit({ run, cwd: root, env })(['diff', '--name-only', prevHead, plan.finalSha]);
    if (d.status === 0) changedFiles = String(d.stdout ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  }

  let smokeResult;
  let smokeThrew = null;
  const smokeStartedMs = now();
  try {
    smokeResult = await runSmoke({ root: candidate.path, env, changedFiles });
  } catch (e) {
    smokeThrew = e;
  }
  const smokeMs = now() - smokeStartedMs;
  removeCandidate({
    root, path: candidate.path, run, env,
  });

  if (smokeThrew) {
    // `daemon-live-smoke.mjs` documents itself as never throwing — this is defense-in-depth only. Root was
    // never touched (the smoke ran against the now-discarded candidate), so there is nothing to roll back and
    // no lock to take; just report it like any other rejection and let the next tick retry fresh.
    log.error?.(`daemon-rebuild: smoke-threw ${String(smokeThrew?.message || smokeThrew)}`);
    return {
      moved: false,
      reason: 'smoke-threw',
      plan,
      alerts: [...prepAlerts, { kind: 'smoke-threw', detail: String(smokeThrew?.message || smokeThrew) }],
    };
  }

  if (smokeResult.verdict !== 'pass') {
    // Root was NEVER touched — no rollback, no lock, nothing to quarantine. Record the rejection (a genuine
    // `'code'` verdict only — `'transient'` never poisons the reject-cache, see the file header / Module D).
    const alertsList = [];
    const nowIso = () => new Date(now()).toISOString();
    const alert = (kind, detail) => {
      alertsList.push({ kind, detail });
      log.error?.(`daemon-rebuild: ${kind}${detail !== undefined ? ` ${JSON.stringify(detail)}` : ''}`);
      try {
        const file = alertsFilePath(root, stEnv);
        mkdirSync(dirname(file), { recursive: true });
        appendFileSync(file, `${JSON.stringify({ at: nowIso(), kind, detail })}\n`, 'utf8');
      } catch { /* best-effort audit trail only */ }
    };
    if (smokeMs >= SLOW_SMOKE_ALERT_MS) {
      alert('smoke-slow', {
        ms: smokeMs, checks: (smokeResult.smoke?.results || []).map((r) => `${r.name}:${r.skipped ? 'skipped' : `${r.ms}ms`}`).join(' '),
      });
    }
    if (smokeResult.verdict === 'code') {
      const state = readRebuildState(root, stEnv);
      const failed = (smokeResult.smoke?.results || []).filter((r) => !r.ok);
      const failedNames = failed.map((r) => r.name).join(',');
      const prev = state.rejected?.inputsKey === plan.inputsKey ? state.rejected : null;
      state.rejected = { inputsKey: plan.inputsKey, reason: failedNames, at: nowIso() };
      if (isExternalOnlyFailure(failed)) {
        const attempts = (prev?.externalOnly ? (prev.attempts || 1) : 0) + 1;
        const delay = rejectRetryDelayMs(env, attempts);
        Object.assign(state.rejected, { externalOnly: true, attempts, retryAt: new Date(now() + delay).toISOString() });
      }
      writeRebuildState(root, state, stEnv);
      alert('smoke-rejected', {
        failed: failedNames,
        details: failed.map((r) => ({ name: r.name, detail: redactDetail(r.detail) })),
        ...(state.rejected.retryAt ? { retryAt: state.rejected.retryAt, attempts: state.rejected.attempts } : {}),
      });
      const staleDetail = staleAlertDetail({ moved: false, reason: 'smoke-rejected', plan }, state);
      if (staleDetail) alert('clone-held-stale', staleDetail);
      return { moved: false, reason: 'smoke-rejected', plan, alerts: [...prepAlerts, ...alertsList] };
    }
    // 'transient' — never poison the reject-cache.
    alert('smoke-transient');
    const state = readRebuildState(root, stEnv);
    const staleDetail = staleAlertDetail({ moved: false, reason: 'smoke-transient', plan }, state);
    if (staleDetail) alert('clone-held-stale', staleDetail);
    return { moved: false, reason: 'smoke-transient', plan, alerts: [...prepAlerts, ...alertsList] };
  }

  // ── Phase 3 (locked, fast) — reached only after a PASSING smoke ─────────────────────────────────────────
  const fin = await withWriteLock(root, () => finalizeRebuild({
    root, env, log, run, stateOpts, now, plan, prevHead,
  }), finalLockOpts);

  if (!fin.ok) {
    if (fin.reason === 'tick-in-progress') {
      log.error?.(`daemon-rebuild: could not take the write lock to finalize ${plan.finalSha} after a passing smoke (reader ${fin.heldBy ?? '?'} still ticking) — retrying next tick`);
    }
    return {
      moved: false, reason: fin.reason, ...(fin.heldBy ? { heldBy: fin.heldBy } : {}), plan, alerts: prepAlerts,
    };
  }

  const result = fin.value;
  const combinedAlerts = [...prepAlerts, ...result.alerts];
  if (smokeMs >= SLOW_SMOKE_ALERT_MS) {
    const slowDetail = {
      ms: smokeMs, checks: (smokeResult.smoke?.results || []).map((r) => `${r.name}:${r.skipped ? 'skipped' : `${r.ms}ms`}`).join(' '),
    };
    combinedAlerts.push({ kind: 'smoke-slow', detail: slowDetail });
    log.error?.(`daemon-rebuild: smoke-slow ${JSON.stringify(slowDetail)}`);
    try {
      const file = alertsFilePath(root, stEnv);
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${JSON.stringify({ at: new Date(now()).toISOString(), kind: 'smoke-slow', detail: slowDetail })}\n`, 'utf8');
    } catch { /* best-effort */ }
  }
  return { ...result, alerts: combinedAlerts };
}

// ── dryRunRebuild — STRICTLY read-only on `root` ────────────────────────────────────────────────────────────

/**
 * Preview what {@link rebuildClone} would do, WITHOUT ever writing an object/ref or moving anything in `root`.
 * Every command run directly against `root` is read-only (`rev-parse`, `symbolic-ref`, `status --porcelain`,
 * `remote get-url`, `rev-list`, `cherry`) and carries `GIT_OPTIONAL_LOCKS=0`; the actual merge-tree/commit-tree
 * computation happens in a disposable scratch bare repo that borrows `root`'s objects via
 * `objects/info/alternates` and does its OWN fresh fetch (never touching `root`'s remote-tracking refs).
 * `extraOverlays` (array of `{ref, pr}`) is appended AFTER the stored overlay list, VIRTUALLY — it is never
 * written to the overlay state file, only fed into this one `planRebuild` call, so a preview of "what if I
 * registered this ref too" (`daemon-load-overlay.mjs --dry-run`) never mutates anything on disk.
 * @param {{root:string, env?:NodeJS.ProcessEnv, prState?:(pr:number)=>(Promise<string|null>|string|null),
 *   originUrl?:string, run?:typeof gitRun, extraOverlays?:Array<{ref:string, pr?:number|null}>}} o
 * @returns {Promise<{dryRun:true, head:string|null, onMain:boolean|null, unsafe:object, plan:object,
 *   wouldDo:'nothing'|'nothing (still-rejected)'|'rebuild-and-smoke'|'refuse', overlayFile:string,
 *   overlays:Array<object>, overlayStateCorrupt:boolean, state:object, stillRejected:boolean}>}
 */
export async function dryRunRebuild({
  root, env = process.env, prState, originUrl, run = gitRun, extraOverlays = [],
} = {}) {
  const rootGit = makeGit({ run, cwd: root, env, extraEnv: { GIT_OPTIONAL_LOCKS: '0' } });

  const head = verifyRev(rootGit, 'HEAD');
  const headRef = rootGit(['symbolic-ref', '--short', 'HEAD']);
  const onMain = headRef.status === 0 ? String(headRef.stdout ?? '').trim() === 'main' : null;
  const unsafe = findUnsafeLocalState({ git: rootGit });

  const overlayFile = overlayFilePath(root, env);
  const overlayState = readOverlayState(root, { env });
  const overlayStateCorrupt = overlayState.corrupt;
  const overlays = overlayState.overlays.concat(extraOverlays);
  const state = readRebuildState(root, env);

  let url = originUrl;
  if (!url) {
    const urlRes = rootGit(['remote', 'get-url', 'origin']);
    url = urlRes.status === 0 ? String(urlRes.stdout ?? '').trim() : null;
  }

  let scratchDir = null;
  let plan = { ok: false, reason: 'no-origin-url' };
  let untrackedCollision = [];
  try {
    if (url && head) {
      scratchDir = mkdtempSync(join(tmpdir(), 'we-daemon-rebuild-dryrun-'));
      const init = spawnSync('git', ['init', '--bare', '-q', scratchDir], {
        encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL',
      });
      if (init.status !== 0) {
        plan = { ok: false, reason: 'scratch-init-failed' };
      } else {
        const gitCommonRes = rootGit(['rev-parse', '--git-common-dir']);
        const gitCommonRaw = gitCommonRes.status === 0 ? String(gitCommonRes.stdout ?? '').trim() : null;
        const gitCommonDir = gitCommonRaw
          ? (isAbsolute(gitCommonRaw) ? gitCommonRaw : resolvePath(root, gitCommonRaw))
          : null;
        if (!gitCommonDir) {
          plan = { ok: false, reason: 'git-common-dir-failed' };
        } else {
          const alternatesFile = join(scratchDir, 'objects', 'info', 'alternates');
          mkdirSync(dirname(alternatesFile), { recursive: true });
          writeFileSync(alternatesFile, `${join(gitCommonDir, 'objects')}\n`, 'utf8');

          const scratchGit = makeGit({ run, cwd: scratchDir, env });
          scratchGit(['remote', 'add', 'origin', url]);
          fetchMainAndOverlays({ git: scratchGit, overlays });

          plan = await planRebuild({
            git: scratchGit,
            headSha: head,
            mainRef: 'origin/main',
            overlays,
            prState: prState || ((pr) => defaultPrState({ pr, root })),
            mainOnly: false,
          });

          // Same untracked-collision check `doRebuild` runs before its real `reset --hard` (see
          // findUnsafeLocalState's header) — computed here against the scratch repo, which shares `root`'s
          // objects via the alternates file above, so `cat-file -e <finalSha>:<path>` needs no extra fetch.
          if (plan.ok && unsafe.untracked.length > 0) {
            untrackedCollision = unsafe.untracked.filter(
              (p) => scratchGit(['cat-file', '-e', `${plan.finalSha}:${p}`]).status === 0,
            );
          }
        }
      }
    }
  } finally {
    if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
  }

  const retryDue = Number.isFinite(Date.parse(state.rejected?.retryAt || '')) && Date.now() >= Date.parse(state.rejected.retryAt);
  const stillRejected = !!(plan.ok && state.rejected?.inputsKey === plan.inputsKey && !retryDue);

  let wouldDo = 'refuse';
  if (unsafe.safe && onMain === true && plan.ok) {
    if (untrackedCollision.length > 0 || overlayStateCorrupt) wouldDo = 'refuse'; // mirrors doRebuild's refusals
    else if (plan.finalSha === head) wouldDo = 'nothing';
    else if (stillRejected) wouldDo = 'nothing (still-rejected)';
    else wouldDo = 'rebuild-and-smoke';
  }

  return {
    dryRun: true, head, onMain, unsafe, plan, wouldDo, overlayFile, overlays, overlayStateCorrupt, state,
    stillRejected, untrackedCollision,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────
// `node scripts/lib/daemon-rebuild.mjs --clone=<path> [--dry-run] [--json]`

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

async function runCli(argv) {
  const flags = parseFlags(argv);
  const clone = typeof flags.clone === 'string' ? flags.clone : null;
  if (!clone) {
    process.stderr.write('daemon-rebuild: --clone=<path> is required\n');
    process.exitCode = 2;
    return;
  }
  const root = resolvePath(clone);

  if (flags['dry-run']) {
    const result = await dryRunRebuild({ root });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      process.stdout.write(
        `daemon-rebuild --dry-run: ${root} onMain=${result.onMain} safe=${result.unsafe.safe} `
        + `wouldDo=${result.wouldDo} finalSha=${result.plan?.finalSha ?? 'n/a'}\n`,
      );
    }
    return;
  }

  const result = await rebuildClone({ root });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`daemon-rebuild: ${root} moved=${result.moved} reason=${result.reason || ''}\n`);
    for (const a of result.alerts || []) process.stdout.write(`  ! ${a.kind}\n`);
  }
}

const IS_CLI = process.argv[1] && resolvePath(process.argv[1]) === resolvePath(fileURLToPath(import.meta.url));
if (IS_CLI) {
  runCli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`daemon-rebuild: fatal: ${String((e && e.message) || e)}\n`);
    process.exitCode = 1;
  });
}
