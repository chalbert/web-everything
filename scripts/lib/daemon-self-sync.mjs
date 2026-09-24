/**
 * @file scripts/lib/daemon-self-sync.mjs
 * @description xv6fciw (narrow slice of decision #3681) — keep a daemon's DEDICATED clone on `origin/main`
 *   without a human re-syncing it, and restart the daemon onto new code between ticks.
 *
 * WHY. The review and fix-dispatch daemons run from a dedicated clone. `main` lands PRs every few minutes, so
 * within minutes the clone is behind and every tick refuses every dispatch (`assertMainNotStale`) until someone
 * fetches and merges by hand — done 5+ times on 2026-09-23 alone. The clone is usually also AHEAD (unmerged
 * fixes merged in to run ahead of `main`), so `checkMainStaleness`'s fast-forward never applies; it needs a real
 * merge.
 *
 * WHAT IT DOES, before each tick:
 *   1. fetch `origin/main`;
 *   2. behind + clean tree → `git merge origin/main` (a merge commit); a conflict is aborted, leaving the tree
 *      exactly as it was, and the tick proceeds (it will refuse as it does today — never worse);
 *   3. a dirty tree, or a checkout not on `main`, is never touched;
 *   4. if the merge brought in commits, the daemon's in-memory code is now older than its checkout: the wrapper
 *      calls `onRestart` INSTEAD of ticking — the caller releases its lease and exits 0, and launchd's KeepAlive
 *      starts it again on the new code. That happens between ticks, never mid-dispatch.
 *
 * x3ecgta (Ruling #3681 Fork 4 condition (ii), platform-decisions.md#resident-daemon-reload-lifecycle clause 3)
 * — THE PER-CLONE READER/WRITER LOCK. Several daemons (the review daemon, the fix-dispatch daemon) share ONE
 * clone. Before this, nothing stopped one from self-syncing (merging/aborting) that clone while the other was
 * mid-tick running code loaded from that same tree — the mover's `git merge --abort` on a conflict could even
 * undo a merge the OTHER daemon had just landed. The fix is a per-clone reader/writer lock, built ONLY from the
 * existing atomic-mkdir + heartbeat-TTL + same-host-pid-dead-fast-reclaim primitive in
 * `scripts/readiness/file-locks.mjs` (the same primitive `skills-src/conveyor/runner-lock.mjs` wraps for its own
 * singleton lease) — never a new fs primitive:
 *   - Each tick holds a SHARED "reader" lease ({@link acquireCloneTickLock}/{@link releaseCloneTickLock}) for the
 *     duration of the real tick body (its own `tickOnce`, and whatever children it spawns) — never around the
 *     self-sync measurement itself, which is read-only.
 *   - The one process that actually MOVES the clone (the `git merge`/`git merge --abort` in
 *     {@link selfSyncCheckout}) takes the EXCLUSIVE "writer" lease ({@link acquireCloneMoveLock}/
 *     {@link releaseCloneMoveLock}) — granted only when no reader is live and no other writer already holds it.
 *   - A reader lease is refused while a writer is live (`writer-active`); a writer lease is refused while any
 *     reader is live (`tick-in-progress`) or another writer already holds it (`concurrent-mover`). A refusal is
 *     NEVER treated as a merge conflict — it just skips this tick's move (or this tick entirely), retried next
 *     time; the daemon that lost the tree-move race still restarts once the mover's inputs move, via the
 *     existing boot-input staleness check (clause 2), never by fighting over the same merge.
 *   - Both leases use the SAME heartbeat-TTL + same-host-PID-dead fast reclaim `reserve()`/`reclaimDecision`
 *     already give `file-locks.mjs` callers — a daemon SIGKILLed mid-tick (or mid-move) is reclaimed at once on
 *     this host (mirrors
 *     `runner-lock.mjs`'s #3952 `probeRunnerLeaseLiveness`), never stuck for the full TTL.
 *   - Lock state lives OUTSIDE the git working tree entirely (a fixed HOME-level root, keyed by a hash of the
 *     clone's resolved path — see {@link SELF_SYNC_LOCK_ROOT}), never under `<root>/.claude/locks`: an untracked
 *     file inside the tree would make `git status --porcelain` see the clone as permanently dirty, which is the
 *     EXACT #xvyuwtg bug (an ungitignored daemon log defeated `main-staleness.mjs`'s own clean-tree auto-ff) —
 *     this lock must never reproduce it.
 *   - Accepted residual: the readers-then-writer check in {@link acquireCloneMoveLock} is two separate atomic
 *     mkdirs, not one atomic transaction, so a reader that begins its own acquire in the microsecond window
 *     between the writer's readers-scan and its own mkdir win is a race the filesystem cannot close outright.
 *     The writer immediately re-scans and backs out if it finds one (shrinking the window to microseconds);
 *     doing better needs a single-writer arbiter process this card deliberately does not add — ticks run on the
 *     order of seconds to minutes, so a microsecond window is a reasonable residual, not a rebuild of the
 *     primitive.
 *
 * PURE CORE / IO SHELL: {@link decideSelfSync}, {@link decideTickLockGate} and {@link decideMoveLockGate} are
 * pure; {@link selfSyncCheckout} does the git IO (plus the writer-lease gate around the actual merge) through an
 * injected runner (defaults to `main-staleness.mjs#gitRun`); {@link withSelfSync} wraps a daemon's
 * `runDaemonLoop` effects (plus the reader-lease around the real tick).
 */

import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir, hostname } from 'node:os';
import { gitRun } from './main-staleness.mjs';
import {
  DEFAULT_LEASE_MINUTES, lockIdFor, parseLockEntry, isLeaseExpired, readLockEntry, releaseLockDir, reserve,
} from '../readiness/file-locks.mjs';

// ── the per-clone reader/writer lock (x3ecgta) ──────────────────────────────────────────────────────────────

/** Fixed, HOME-level lock home — like `runner-lock.mjs`'s `RUNNER_LOCK_ROOT`, deliberately OUTSIDE any git
 *  working tree (never `<root>/.claude/locks`; see the file header's #xvyuwtg note). Overridable via env for a
 *  non-default machine layout; every function below also takes an explicit `lockRootBase` (tests use a temp
 *  dir — this lock never touches the real one, per the "tests never touch the real ~/.claude lock dirs" rule). */
export const SELF_SYNC_LOCK_ROOT = process.env.WE_DAEMON_SELF_SYNC_LOCK_ROOT
  || join(homedir(), '.claude', 'daemon-self-sync-locks');

/** The writer lease's fixed key within a clone's own lock dir (one exclusive slot per clone). */
const WRITER_KEY = '<self-sync:writer>';

/** A stable per-process owner id: host + pid. The fast PID-liveness reclaim below only ever probes an owner
 *  recorded on THIS host (the `hostname()` segment), exactly like `runner-lock.mjs#makeOwner`. */
export function defaultLockOwner() { return `${hostname()}:${process.pid}`; }

function ensureDir(dir) { try { mkdirSync(dir, { recursive: true }); } catch { /* best-effort; reserve() self-heals a missing root too */ } }
const nowIsoFrom = (nowMs) => new Date(nowMs).toISOString();

/** The two lock roots for one clone: `root`'s RESOLVED path is hashed (never the raw string — so `.`, a
 *  trailing slash, or a relative spelling of the SAME clone still collide onto the SAME lock dir) into one
 *  per-clone directory, holding an (single-owner) `writer` root and a `readers` root (one lock dir per live
 *  reader, keyed by that reader's own owner id — `reserve()` used exactly as `runner-lock.mjs` uses it, just
 *  keyed by a DIFFERENT string per caller instead of one shared sentinel). */
function cloneLockPaths(root, lockRootBase = SELF_SYNC_LOCK_ROOT) {
  const cloneDir = join(lockRootBase, lockIdFor(resolve(String(root))));
  return { writerRoot: join(cloneDir, 'writer'), readersRoot: join(cloneDir, 'readers') };
}

/** Read every currently-registered reader entry for a clone. Never throws: a missing readers dir is simply no
 *  readers; a half-written/corrupt entry (`parseLockEntry` returns null) is skipped, never counted as live —
 *  mirrors `file-locks.mjs`'s own tolerant-parse discipline (a corrupt lock must never wedge the writer). */
function listReaderEntries(readersRoot) {
  let names;
  try { names = readdirSync(readersRoot); } catch { return []; }
  const out = [];
  for (const name of names) {
    try {
      const entry = parseLockEntry(readFileSync(join(readersRoot, name, 'lock.json'), 'utf8'));
      if (entry) out.push(entry);
    } catch { /* gone / corrupt / still being written — never counted as live */ }
  }
  return out;
}

/**
 * #3952-style same-host PID-liveness for one lock entry, mirroring `runner-lock.mjs#probeRunnerLeaseLiveness`
 * exactly (never a fork — the SAME layered, never-primary rule threaded to a 4th caller alongside
 * `heavy-admission.mjs`, `file-locks-cli.mjs`, and `runner-lock.mjs`): `kill(pid, 0)` throwing ESRCH means the
 * same-machine owner is PROVABLY gone (`'dead'`); a live pid is `'alive'` (pid reuse means this does NOT prove
 * it's the SAME process — never accelerates reclaim); anything ambiguous, or an owner recorded on a different
 * host, is `'unknown'` (TTL-only reclaim).
 * @param {{owner:string, pid:number|null}|null} entry
 * @param {string} [currentHost]
 * @returns {'dead'|'alive'|'unknown'}
 */
export function defaultProbePidLiveness(entry, currentHost = hostname()) {
  if (!entry || !Number.isInteger(entry.pid) || entry.pid <= 0) return 'unknown';
  const ownerHost = typeof entry.owner === 'string' ? entry.owner.split(':')[0] : null;
  if (ownerHost !== currentHost) return 'unknown';
  try { process.kill(entry.pid, 0); return 'alive'; }
  catch (e) { return e && e.code === 'ESRCH' ? 'dead' : 'unknown'; }
}

/** Pure: is a lock entry a LIVE hold at `nowMs`? Dead (same-host, provably-gone PID) or lease-expired both mean
 *  NOT live — either way the lock is reclaimable, never a genuine holder to wait out. `pidLiveness` is probed by
 *  the caller (impure) and injected here so this stays a pure decision. */
function isLive(entry, nowMs, leaseMinutes, pidLiveness) {
  if (!entry) return false;
  if (pidLiveness === 'dead') return false;
  return !isLeaseExpired(entry, nowMs, leaseMinutes);
}

/**
 * Pure: may a NEW reader (tick) start, given the clone's current writer entry? Refused only while a writer is
 * genuinely LIVE — a dead or lease-expired writer never blocks a tick (its move died with it; a fresh reader is
 * always safe to start against a tree no one is actively moving).
 * @returns {{ok:boolean, reason:string, heldBy?:string}}
 */
export function decideTickLockGate({ writerEntry, nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES, writerPidLiveness = 'unknown' }) {
  if (isLive(writerEntry, nowMs, leaseMinutes, writerPidLiveness)) {
    return { ok: false, reason: 'writer-active', heldBy: writerEntry.owner };
  }
  return { ok: true, reason: 'clear' };
}

/**
 * Pure: may a NEW writer (the mover) start, given the clone's current reader entries? Refused while ANY reader
 * is genuinely live (`tick-in-progress`) — a dead/expired reader is dropped and never blocks the move.
 * @returns {{ok:boolean, reason:string, heldBy?:string[]}}
 */
export function decideMoveLockGate({ readerEntries = [], nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES, readerPidLivenessOf = () => 'unknown' }) {
  const live = readerEntries.filter((e) => isLive(e, nowMs, leaseMinutes, readerPidLivenessOf(e)));
  if (live.length > 0) return { ok: false, reason: 'tick-in-progress', heldBy: live.map((e) => e.owner) };
  return { ok: true, reason: 'clear' };
}

/**
 * Acquire the SHARED reader (tick) lease for `owner` on the clone at `root`. `ok:true` ⇒ this tick may run — no
 * writer is currently moving the clone. `ok:false, reason:'writer-active'` ⇒ a live mover holds the clone right
 * now; the caller must SKIP this entire tick (never read the tree mid-move) and retry next cycle. Idempotent for
 * the SAME owner (re-acquire = heartbeat refresh, via `reserve()`'s own `'own'` path).
 * @returns {{ok:boolean, reason:string, heldBy?:string|string[]}}
 */
export function acquireCloneTickLock(root, owner = defaultLockOwner(), {
  nowMs = Date.now(), pid = process.pid, leaseMinutes = DEFAULT_LEASE_MINUTES, lockRootBase = SELF_SYNC_LOCK_ROOT,
  probePidLiveness = defaultProbePidLiveness,
} = {}) {
  const { writerRoot, readersRoot } = cloneLockPaths(root, lockRootBase);
  const writerEntry = readLockEntry(writerRoot, WRITER_KEY);
  const gate = decideTickLockGate({ writerEntry, nowMs, leaseMinutes, writerPidLiveness: writerEntry ? probePidLiveness(writerEntry) : 'unknown' });
  if (!gate.ok) return gate;
  ensureDir(readersRoot);
  const res = reserve(readersRoot, owner, owner, nowMs, nowIsoFrom(nowMs), pid, 'unknown', leaseMinutes);
  return res.ok ? { ok: true, reason: 'reader' } : { ok: false, reason: res.reason, heldBy: res.heldBy };
}

/** Release `owner`'s reader (tick) lease — a no-op if `owner` no longer holds it (reclaimed away, or never
 *  acquired). Idempotent, safe to call from a `finally`. */
export function releaseCloneTickLock(root, owner = defaultLockOwner(), { lockRootBase = SELF_SYNC_LOCK_ROOT } = {}) {
  const { readersRoot } = cloneLockPaths(root, lockRootBase);
  const cur = readLockEntry(readersRoot, owner);
  if (cur && cur.owner === owner) { releaseLockDir(readersRoot, owner); return true; }
  return false;
}

/**
 * Acquire the EXCLUSIVE writer (mover) lease for `owner` on the clone at `root`. `ok:true` ⇒ this process may
 * move the clone (`git merge`/`git merge --abort`) — no tick is live and no other writer already holds it.
 * `ok:false, reason:'tick-in-progress'` ⇒ a sibling daemon is mid-tick; `reason:'concurrent-mover'` ⇒ another
 * process is already moving this clone. Either way the caller must NOT move the tree — skip this move, retry
 * next cycle (never treated as a merge conflict).
 * @returns {{ok:boolean, reason:string, heldBy?:string|string[]}}
 */
export function acquireCloneMoveLock(root, owner = defaultLockOwner(), {
  nowMs = Date.now(), pid = process.pid, leaseMinutes = DEFAULT_LEASE_MINUTES, lockRootBase = SELF_SYNC_LOCK_ROOT,
  probePidLiveness = defaultProbePidLiveness,
} = {}) {
  const { writerRoot, readersRoot } = cloneLockPaths(root, lockRootBase);
  const scan = () => decideMoveLockGate({ readerEntries: listReaderEntries(readersRoot), nowMs, leaseMinutes, readerPidLivenessOf: probePidLiveness });
  const gate = scan();
  if (!gate.ok) return gate;
  ensureDir(writerRoot);
  const writerEntry = readLockEntry(writerRoot, WRITER_KEY);
  const writerPidLiveness = writerEntry && writerEntry.owner !== owner ? probePidLiveness(writerEntry) : 'unknown';
  const res = reserve(writerRoot, WRITER_KEY, owner, nowMs, nowIsoFrom(nowMs), pid, writerPidLiveness, leaseMinutes);
  if (!res.ok) return { ok: false, reason: 'concurrent-mover', heldBy: res.heldBy };
  // Belt-and-braces re-check (the file header's accepted-residual note): a reader could have registered in the
  // microsecond gap between our scan above and winning the writer dir. Catch it and back out at once.
  const recheck = scan();
  if (!recheck.ok) { releaseLockDir(writerRoot, WRITER_KEY); return recheck; }
  return { ok: true, reason: 'writer' };
}

/** Release `owner`'s writer (mover) lease — a no-op if `owner` no longer holds it. Idempotent, safe to call
 *  from a `finally` regardless of whether the merge succeeded, conflicted, or was refused. */
export function releaseCloneMoveLock(root, owner = defaultLockOwner(), { lockRootBase = SELF_SYNC_LOCK_ROOT } = {}) {
  const { writerRoot } = cloneLockPaths(root, lockRootBase);
  const cur = readLockEntry(writerRoot, WRITER_KEY);
  if (cur && cur.owner === owner) { releaseLockDir(writerRoot, WRITER_KEY); return true; }
  return false;
}

/**
 * Pure: what should a daemon's clone do, given where it stands against `origin/main`?
 * `dirty: null` means the tree state is UNKNOWN (the `git status` itself failed or timed out) — that fails
 * CLOSED (`status-failed`), never as clean: merging a tree we could not inspect could restart the daemon over
 * uncommitted work. The same fail-closed rule covers every other probe: `behind: null` (the `rev-list --count`
 * failed, timed out, or printed no number) is `count-failed`, NEVER `up-to-date` — reading an unknown distance
 * as 0 would let the clone silently fall behind `origin/main` forever with no signal; `onBase: null` (the
 * `symbolic-ref` failed) is `head-failed`, not a misleading `not-on-main`.
 * @param {{fetched:boolean, behind:number|null, dirty:boolean|null, onBase:boolean|null}} s
 * @returns {{action:'none'|'merge'|'skip', reason:string}}
 */
export function decideSelfSync({ fetched, behind, dirty, onBase }) {
  if (!fetched) return { action: 'skip', reason: 'fetch-failed' };
  if (behind === null) return { action: 'skip', reason: 'count-failed' };
  if (!behind) return { action: 'none', reason: 'up-to-date' };
  if (onBase === null) return { action: 'skip', reason: 'head-failed' };
  if (!onBase) return { action: 'skip', reason: 'not-on-main' };
  if (dirty === null) return { action: 'skip', reason: 'status-failed' };
  if (dirty) return { action: 'skip', reason: 'dirty' };
  return { action: 'merge', reason: 'behind' };
}

/**
 * The git IO: fetch, measure, and merge when {@link decideSelfSync} says so. Never throws; never leaves a
 * half-merged tree (a failed merge is aborted).
 *
 * Every git command carries a per-command `timeout` (default 60s, overridable via `timeoutMs`) + `killSignal:
 * 'SIGKILL'`, spread straight into `spawnSync` by `gitRun` (or any injected `run` that does the same) — so a
 * hung `fetch`/`merge` (network stall, credential prompt) can NEVER freeze the caller indefinitely. `gitRun`
 * already treats a null/non-zero `status` as failure, so a timed-out command falls through the existing
 * fetch-failed / merge-abort paths unchanged: a timed-out fetch → `fetch-failed` (never reaches merge); a
 * timed-out merge → aborted (itself under the same timeout) and reported as `conflict`; a failed/timed-out
 * `status` → `status-failed` (fail closed — an uninspected tree is never treated as clean); a failed/timed-out
 * (or non-numeric) `rev-list --count` → `count-failed` (never coerced to 0 / `up-to-date`); a failed/timed-out
 * `symbolic-ref` → `head-failed`.
 * x3ecgta: once {@link decideSelfSync} says `merge`, the actual `git merge` (and its `--abort` on conflict) only
 * runs while this owner holds the clone's EXCLUSIVE writer lease ({@link acquireCloneMoveLock}) — refused while
 * a sibling daemon is mid-tick (`tick-in-progress`) or another process is already moving this same clone
 * (`concurrent-mover`); either refusal is reported as its own `reason`, NEVER as `'conflict'` (a lock refusal
 * must never be treated as a merge conflict — see the file header), and the tree is left untouched, retried
 * next tick, exactly like the existing `'dirty'`/`'not-on-main'` no-worse-than-today fallbacks.
 * @param {{root:string, base?:string, run?:typeof gitRun, timeoutMs?:number, owner?:string, lock?:object,
 *   acquireMoveLock?:typeof acquireCloneMoveLock, releaseMoveLock?:typeof releaseCloneMoveLock}} o
 * @returns {{merged:boolean, commits:number, reason:string}}
 */
export function selfSyncCheckout({
  root, base = 'main', run = gitRun, timeoutMs = 60_000, owner = defaultLockOwner(), lock = {},
  acquireMoveLock = acquireCloneMoveLock, releaseMoveLock = releaseCloneMoveLock,
}) {
  const git = (args) => run(args, { cwd: root, timeout: timeoutMs, killSignal: 'SIGKILL' });
  const fetched = git(['fetch', 'origin', base, '--quiet']).status === 0;
  const count = (range) => {
    const r = git(['rev-list', '--count', range]);
    const out = String(r.stdout ?? '').trim();
    return r.status === 0 && /^\d+$/.test(out) ? Number(out) : null;
  };
  const behind = fetched ? count(`HEAD..origin/${base}`) : 0;
  const head = git(['symbolic-ref', '--short', 'HEAD']);
  const onBase = head.status === 0 ? String(head.stdout ?? '').trim() === base : null;
  const status = git(['status', '--porcelain']);
  const dirty = status.status === 0 ? !!String(status.stdout ?? '').trim() : null;

  const decision = decideSelfSync({ fetched, behind, dirty, onBase });
  if (decision.action !== 'merge') return { merged: false, commits: 0, reason: decision.reason };

  const held = acquireMoveLock(root, owner, lock);
  if (!held.ok) return { merged: false, commits: 0, reason: held.reason };
  try {
    const merge = git(['merge', `origin/${base}`, '--no-edit', '-m', `sync: catch up with origin/${base} (daemon self-sync)`]);
    if (merge.status !== 0) {
      git(['merge', '--abort']);
      return { merged: false, commits: 0, reason: 'conflict' };
    }
    return { merged: true, commits: behind, reason: 'merged' };
  } finally {
    releaseMoveLock(root, owner, lock);
  }
}

/**
 * Wrap a daemon's `runDaemonLoop` effects so each tick first self-syncs the clone, then runs the real tick
 * under the clone's SHARED reader (tick) lease — x3ecgta: this is the OTHER half of the per-clone reader/writer
 * lock (the merge-side half lives in {@link selfSyncCheckout}). When new commits arrive, `onRestart` runs in
 * place of the tick (the caller releases its lease and exits) — no reader lease is needed then, since this
 * process is exiting rather than reading the (now-current) tree. When a writer is actively moving the clone
 * right now, the reader lease is refused (`writer-active`) and this ENTIRE tick is skipped — never partially
 * read a tree mid-move — retried next cycle, same as every other no-worse-than-today self-sync fallback.
 * @param {{tickOnce:()=>any}} effects
 * @param {{root:string, onRestart:(info:object)=>any, sync?:typeof selfSyncCheckout, log?:Console,
 *   timeoutMs?:number, owner?:string, lock?:object, acquireTickLock?:typeof acquireCloneTickLock,
 *   releaseTickLock?:typeof releaseCloneTickLock}} o
 */
export function withSelfSync(effects, {
  root, onRestart, sync = selfSyncCheckout, log = console, timeoutMs, owner = defaultLockOwner(), lock = {},
  acquireTickLock = acquireCloneTickLock, releaseTickLock = releaseCloneTickLock,
}) {
  const tick = effects.tickOnce;
  return {
    ...effects,
    // Forwards whatever arguments the caller's own tickOnce takes (e.g. runner.mjs's per-tick bookkeeping
    // payload) straight through to the wrapped `tick` — this wrapper never needs to see them itself, and
    // dropping them would silently reset a payload-threading caller's state every tick. The daemons that
    // built this helper pass a zero-arg tickOnce, so `...args` is empty for them and nothing changes.
    tickOnce: async (...args) => {
      const r = sync({ root, ...(timeoutMs != null ? { timeoutMs } : {}) });
      if (r.merged) {
        log.error?.(`daemon-self-sync: merged ${r.commits} new commit(s) from origin/main — restarting onto the new code`);
        return onRestart(r);
      }
      if (r.reason === 'conflict' || r.reason === 'dirty' || r.reason === 'not-on-main') {
        log.error?.(`daemon-self-sync: behind origin/main but NOT syncing (${r.reason}) — needs a hand merge`);
      } else if (r.reason === 'status-failed') {
        log.error?.('daemon-self-sync: behind origin/main but NOT syncing (status-failed) — `git status` failed or timed out; retrying next tick');
      } else if (r.reason === 'fetch-failed') {
        log.error?.('daemon-self-sync: NOT syncing (fetch-failed) — `git fetch origin` failed or timed out; retrying next tick');
      } else if (r.reason === 'count-failed') {
        log.error?.('daemon-self-sync: NOT syncing (count-failed) — `git rev-list --count` failed or timed out, so the distance to origin/main is unknown; retrying next tick');
      } else if (r.reason === 'head-failed') {
        log.error?.('daemon-self-sync: behind origin/main but NOT syncing (head-failed) — `git symbolic-ref HEAD` failed or timed out; retrying next tick');
      } else if (r.reason === 'tick-in-progress') {
        log.error?.('daemon-self-sync: behind origin/main but NOT syncing (tick-in-progress) — a sibling daemon sharing this clone is mid-tick; retrying next tick');
      } else if (r.reason === 'concurrent-mover') {
        log.error?.('daemon-self-sync: behind origin/main but NOT syncing (concurrent-mover) — another process is already moving this clone; retrying next tick');
      }

      const held = acquireTickLock(root, owner, lock);
      if (!held.ok) {
        log.error?.(`daemon-self-sync: skipping this tick (${held.reason}) — this clone is mid-move; retrying next tick`);
        return { skipped: true, reason: held.reason };
      }
      try {
        return await tick(...args);
      } finally {
        releaseTickLock(root, owner, lock);
      }
    },
  };
}
