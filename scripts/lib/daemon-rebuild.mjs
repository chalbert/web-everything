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
} from 'node:fs';
import { tmpdir, hostname, homedir } from 'node:os';
import { join, dirname, resolve as resolvePath, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { withWriteLock } from './daemon-clone-lock.mjs';
import {
  cloneKey, overlayFilePath, readOverlays, removeOverlay, appendOverlayEvent,
} from './daemon-overlays.mjs';
import { runLiveSmokeWithRetry } from './daemon-live-smoke.mjs';
import { isSafeBranchName } from './daemon-self-sync.mjs';
import { gitRun } from './main-staleness.mjs';

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

  for (const raw of toProcess) {
    const ref = raw?.ref;
    const pr = raw?.pr ?? null;

    // 1. PR state — MERGED/CLOSED means the overlay is moot; never call prState for a PR-less overlay.
    const state = pr != null && prState ? await prState(pr) : null;
    if (state === 'MERGED' || state === 'CLOSED') {
      decisions.push({ ref, pr, action: 'remove', reason: state === 'MERGED' ? 'pr-merged' : 'pr-closed', sha: null });
      continue;
    }

    // 2. resolve the overlay ref's remote-tracking tip.
    const ovSha = verifyRev(git, `refs/remotes/origin/${ref}^{commit}`);
    if (!ovSha) {
      decisions.push({ ref, pr, action: 'remove', reason: 'ref-gone', sha: null });
      continue;
    }

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
      decisions.push({ ref, pr, action: 'drop', reason: 'conflict', sha: ovSha });
      continue;
    }
    if (mt.status !== 0) {
      decisions.push({ ref, pr, action: 'drop', reason: 'merge-tree-failed', sha: ovSha });
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
      decisions.push({ ref, pr, action: 'drop', reason: 'commit-tree-failed', sha: ovSha });
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

/**
 * PURE: is `root`'s current tree safe for {@link rebuildClone} to move with `git reset --hard`? Fail-closed at
 * every read — an unreadable `status` refuses outright, since we cannot then trust anything else. Precedence
 * (spec doesn't state one explicitly; chosen so a genuine `status`-read failure always dominates, and a live
 * `MERGE_HEAD` — which itself also shows up as "dirty" porcelain output — is reported as the MORE specific
 * `merge-in-progress` rather than the generic `dirty`): `status-failed` > `merge-in-progress` > `dirty` >
 * `local-commits` > safe.
 * @param {{git:(args:string[])=>{status:number,stdout:string,stderr:string}}} o
 * @returns {{safe:boolean, reason?:string, detail?:Array<string>|string}}
 */
export function findUnsafeLocalState({ git, knownInputs = [] }) {
  const status = git(['status', '--porcelain', '--untracked-files=normal']);
  if (status.status !== 0) return { safe: false, reason: 'status-failed' };

  const mergeHead = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
  if (mergeHead.status === 0 && String(mergeHead.stdout ?? '').trim()) {
    return { safe: false, reason: 'merge-in-progress' };
  }

  const dirtyOut = String(status.stdout ?? '').trim();
  if (dirtyOut) {
    return { safe: false, reason: 'dirty', detail: dirtyOut.split('\n').map((l) => l.trim()).filter(Boolean) };
  }

  // `knownInputs`: shas this clone was previously BUILT from (the last adopted head + its overlay tips). An
  // overlay whose origin branch was deleted after its PR merged (squash) leaves its commits reachable from HEAD
  // but from no remote ref — they are past inputs, not local work, and must never freeze the rebuild. Only
  // shas that actually exist locally are passed (an unknown sha would make rev-list fail => status-failed).
  const known = knownInputs.filter((sha) => typeof sha === 'string' && /^[0-9a-f]{7,64}$/.test(sha)
    && git(['cat-file', '-e', `${sha}^{commit}`]).status === 0);
  const revList = git(['rev-list', '--no-merges', 'HEAD', '--not', '--remotes=origin', ...known]);
  if (revList.status !== 0) return { safe: false, reason: 'status-failed', detail: 'rev-list --no-merges failed' };
  const localShas = String(revList.stdout ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (localShas.length === 0) return { safe: true };

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
  if (remaining.length === 0) return { safe: true };
  return { safe: false, reason: 'local-commits', detail: remaining };
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

const EMPTY_STATE = Object.freeze({ adopted: null, rejected: null, inProgress: null, quarantine: null });

/**
 * Read the per-clone rebuild state, never throwing — a missing or corrupt file reads as the empty state (fail
 * closed to "nothing adopted, nothing rejected, nothing in progress", never a crash).
 * @param {string} root
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{adopted:object|null, rejected:object|null, inProgress:object|null, quarantine:object|null}}
 */
export function readRebuildState(root, env = process.env) {
  try {
    const parsed = JSON.parse(readFileSync(rebuildStatePath(root, env), 'utf8'));
    return {
      adopted: parsed?.adopted ?? null,
      rejected: parsed?.rejected ?? null,
      inProgress: parsed?.inProgress ?? null,
      quarantine: parsed?.quarantine ?? null,
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

// ── rebuildClone — the IO shell ──────────────────────────────────────────────────────────────────────────────

/**
 * Rebuild `root` fresh from `origin/main` + its registered overlay list, under the clone's exclusive WRITE lock
 * (`daemon-clone-lock.mjs`, Module A) — a refused lock is reported, never treated as an error. See the file
 * header for the object-DB/determinism contract and the per-step description in the design spec this
 * implements (docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clauses 2-5).
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
  const finalLockOpts = {
    ...(lockRootFromEnv ? { lockRoot: lockRootFromEnv } : {}),
    now,
    ...(sleep ? { sleep } : {}),
    ...lockOpts,
  };

  const lockResult = await withWriteLock(root, () => doRebuild({
    root, env, log, run, runSmoke, prState, stateOpts, mainOnly, now,
  }), finalLockOpts);

  if (!lockResult.ok) return { moved: false, reason: lockResult.reason };
  return lockResult.value;
}

/** Shas a clone was previously built from — see {@link findUnsafeLocalState}'s `knownInputs`. */
function knownInputsOf(state) {
  return [
    state?.adopted?.head, state?.adopted?.mainSha, ...((state?.adopted?.applied) || []).map((a) => a?.sha),
    state?.quarantine?.prevHead,
  ].filter(Boolean);
}

async function doRebuild({ root, env, log, run, runSmoke, prState, stateOpts, mainOnly, now }) {
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
  const finish = (result) => ({ ...result, alerts: alertsList });

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
      return finish({ moved: false, reason: 'index-locked' });
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
      if (headNow === state.inProgress.target || (headNow === state.inProgress.prevHead && clean)) {
        const { target } = state.inProgress;
        state.inProgress = null;
        writeState();
        alert('rebuild-interrupted-recovered', { target, headNow });
      } else {
        alert('rebuild-interrupted-unrecoverable', { inProgress: state.inProgress, headNow });
        return finish({ moved: false, reason: 'rebuild-interrupted-unrecoverable' });
      }
    }
  }

  if (state.quarantine) {
    const status = git(['status', '--porcelain']);
    const clean = status.status === 0 && !String(status.stdout ?? '').trim();
    const reset = clean ? git(['reset', '--hard', state.quarantine.prevHead]) : { status: 1 };
    if (clean && reset.status === 0) {
      state.quarantine = null;
      writeState();
    } else {
      return finish({ moved: false, reason: 'quarantined' });
    }
  }

  // ── Step 1: must be on main, and the local tree must be safe to move ────────────────────────────────────
  const headRef = git(['symbolic-ref', '--short', 'HEAD']);
  const onMain = headRef.status === 0 ? String(headRef.stdout ?? '').trim() === 'main' : null;
  if (!onMain) {
    alert('not-on-main', { onMain });
    return finish({ moved: false, reason: 'not-on-main' });
  }

  const unsafe = findUnsafeLocalState({ git, knownInputs: knownInputsOf(state) });
  if (!unsafe.safe) {
    alert(unsafe.reason, unsafe.detail);
    return finish({ moved: false, reason: unsafe.reason });
  }

  const prevHead = verifyRev(git, 'HEAD');
  if (!prevHead) {
    alert('head-unresolved');
    return finish({ moved: false, reason: 'head-unresolved' });
  }

  // ── Step 2: fetch ────────────────────────────────────────────────────────────────────────────────────
  const overlaysBefore = readOverlays(root, { env });
  const fetchResult = fetchMainAndOverlays({ git, overlays: overlaysBefore });
  if (!fetchResult.ok) {
    alert('fetch-failed');
    return finish({ moved: false, reason: 'fetch-failed' });
  }
  for (const ref of fetchResult.goneRefs) alert('overlay-ref-gone-on-fetch', { ref });

  // ── Step 3: plan + apply list edits ─────────────────────────────────────────────────────────────────
  const plan = await planRebuild({
    git, headSha: prevHead, mainRef: 'origin/main', overlays: overlaysBefore, prState, mainOnly,
  });
  if (!plan.ok) {
    alert(plan.reason);
    return finish({ moved: false, reason: plan.reason });
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
    return finish({ moved: false, reason: 'up-to-date', plan });
  }
  if (state.rejected?.inputsKey === plan.inputsKey) {
    return finish({ moved: false, reason: 'still-rejected', plan });
  }

  // ── Step 5: move the tree (the ONLY `reset --hard` in this module) ──────────────────────────────────
  state.inProgress = { pid: process.pid, host: hostname(), prevHead, target: plan.finalSha, startedAt: nowIso() };
  writeState();

  let resetOk = false;
  try {
    const reset = git(['reset', '--hard', plan.finalSha]);
    resetOk = reset.status === 0;
    if (!resetOk) {
      const rollback = git(['reset', '--hard', prevHead]);
      state.inProgress = null;
      writeState();
      alert('reset-failed', { target: plan.finalSha, rolledBack: rollback.status === 0 });
      return finish({ moved: false, reason: 'reset-failed', rolledBack: rollback.status === 0, plan });
    }

    // ── Step 6: live smoke ─────────────────────────────────────────────────────────────────────────────
    const smokeResult = await runSmoke({ root, env });
    if (smokeResult.verdict === 'pass') {
      state.adopted = {
        head: plan.finalSha, inputsKey: plan.inputsKey, mainSha: plan.mainSha, applied: plan.applied, at: nowIso(),
      };
      state.rejected = null;
      state.inProgress = null;
      writeState();
      return finish({ moved: true, adopted: true, head: plan.finalSha, prevHead, plan });
    }

    const rollback = git(['reset', '--hard', prevHead]);
    if (rollback.status !== 0) {
      state.quarantine = { prevHead, reason: smokeResult.verdict === 'code' ? 'smoke-code-rollback-failed' : 'smoke-transient-rollback-failed' };
      state.inProgress = null;
      writeState();
      alert('rollback-failed', { prevHead });
      return finish({ moved: false, reason: 'rollback-failed', quarantine: true, plan });
    }

    if (smokeResult.verdict === 'code') {
      const failedNames = (smokeResult.smoke?.results || []).filter((r) => !r.ok).map((r) => r.name).join(',');
      state.rejected = { inputsKey: plan.inputsKey, reason: failedNames, at: nowIso() };
      state.inProgress = null;
      writeState();
      alert('smoke-rejected', { failed: failedNames });
      return finish({ moved: false, reason: 'smoke-rejected', rolledBack: true, plan });
    }

    // 'transient' — never poison the reject-cache (see file header / Module D rationale).
    state.inProgress = null;
    writeState();
    alert('smoke-transient');
    return finish({ moved: false, reason: 'smoke-transient', rolledBack: true, plan });
  } catch (e) {
    if (resetOk) {
      const rollback = git(['reset', '--hard', prevHead]);
      if (rollback.status !== 0) {
        state.quarantine = { prevHead, reason: 'rebuild-threw' };
        state.inProgress = null;
        writeState();
        alert('rollback-failed', { prevHead, error: String(e?.message || e) });
        return finish({ moved: false, reason: 'rollback-failed', quarantine: true, plan });
      }
    }
    state.inProgress = null;
    writeState();
    alert('rebuild-threw', { error: String(e?.message || e) });
    return finish({ moved: false, reason: 'rebuild-error', plan });
  }
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
 *   overlays:Array<object>, state:object, stillRejected:boolean}>}
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
  const overlays = readOverlays(root, { env }).concat(extraOverlays);
  const state = readRebuildState(root, env);

  let url = originUrl;
  if (!url) {
    const urlRes = rootGit(['remote', 'get-url', 'origin']);
    url = urlRes.status === 0 ? String(urlRes.stdout ?? '').trim() : null;
  }

  let scratchDir = null;
  let plan = { ok: false, reason: 'no-origin-url' };
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
        }
      }
    }
  } finally {
    if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
  }

  const stillRejected = !!(plan.ok && state.rejected?.inputsKey === plan.inputsKey);

  let wouldDo = 'refuse';
  if (unsafe.safe && onMain === true && plan.ok) {
    if (plan.finalSha === head) wouldDo = 'nothing';
    else if (stillRejected) wouldDo = 'nothing (still-rejected)';
    else wouldDo = 'rebuild-and-smoke';
  }

  return {
    dryRun: true, head, onMain, unsafe, plan, wouldDo, overlayFile, overlays, state, stillRejected,
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
