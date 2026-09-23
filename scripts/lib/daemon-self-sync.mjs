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
 * PURE CORE / IO SHELL: {@link decideSelfSync} is pure; {@link selfSyncCheckout} does the git IO through an
 * injected runner (defaults to `main-staleness.mjs#gitRun`); {@link withSelfSync} wraps a daemon's
 * `runDaemonLoop` effects.
 *
 * #3383 — TWO LIVE BUGS FOUND 2026-09-23, BOTH FIXED HERE, BOTH ADDITIVE (every existing caller's behavior is
 * unchanged unless it opts in / the new drift check below is the one exception, see its own note):
 *
 *   BUG 1 — a multi-repo tick takes long enough (several `gh` calls per repo, several repos) that
 *   `origin/main` moves again AFTER this file's own tick-start sync ran but BEFORE the tick finishes — the
 *   real dispatch chokepoint (`main-staleness.mjs#assertMainNotStale`, called once per repo deep inside the
 *   tick) then refuses that repo outright ("refusing to dispatch... STALE code..."). Before this fix, that
 *   refusal was just absorbed as an ordinary per-repo tick failure and the daemon slept the FULL interval
 *   before trying again — losing the same race next tick too, since main moves every few minutes, well within
 *   a 3-repo tick's own duration (confirmed live: 345 refusal lines, ALL 3 repos on the latest tick). The fix:
 *   `withSelfSync` now accepts an optional `hasStaleRefusal(tickResult)` predicate; when a tick's own result
 *   is flagged, it re-syncs IMMEDIATELY (not waiting for the next scheduled tick) and restarts if that finds
 *   new commits — the same `onRestart` path the tick-start sync already uses. Omitting `hasStaleRefusal`
 *   (every caller that existed before this fix) is byte-identical to today.
 *
 *   BUG 2 — the review-daemon and reconcile-fix-dispatch-daemon run from ONE shared dedicated clone.
 *   Whichever self-syncs first performs the merge and restarts (via the branch above); the OTHER then calls
 *   `selfSyncCheckout` itself, finds `behind: 0` (someone else already brought the checkout current) and,
 *   before this fix, just ticked on — forever, on its own now-stale in-memory module cache, since nothing
 *   about "up-to-date" told it the code underneath it had changed. Confirmed live: the fix-dispatch daemon ran
 *   from 18:09 to ~19:17 on stale code before a human noticed and restarted it by hand. The fix: `withSelfSync`
 *   now records the on-disk HEAD sha once, when the daemon BOOTS (i.e., once, when this function itself is
 *   called to build the effects — before the loop's first tick), and every tick re-reads HEAD and restarts
 *   whenever it no longer matches — regardless of WHICH process (this one, or a sibling sharing the same
 *   clone) moved it. This is unconditional (not behind an option) because it changes nothing for a daemon
 *   running from its OWN clone (its own merges already restart it via the existing branch; nothing else ever
 *   moves its HEAD) and only ever ADDS a restart, never removes one — never a regression, by construction.
 */

import { gitRun } from './main-staleness.mjs';

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
 * @param {{root:string, base?:string, run?:typeof gitRun, timeoutMs?:number}} o
 * @returns {{merged:boolean, commits:number, reason:string}}
 */
export function selfSyncCheckout({ root, base = 'main', run = gitRun, timeoutMs = 60_000 }) {
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

  const merge = git(['merge', `origin/${base}`, '--no-edit', '-m', `sync: catch up with origin/${base} (daemon self-sync)`]);
  if (merge.status !== 0) {
    git(['merge', '--abort']);
    return { merged: false, commits: 0, reason: 'conflict' };
  }
  return { merged: true, commits: behind, reason: 'merged' };
}

/** Read the on-disk `HEAD` sha, fail-safe: any git failure (a bad `root`, a timeout, a detached-but-unreadable
 *  ref) returns `null` rather than throwing. Used only by {@link withSelfSync}'s boot-drift check (#3383 bug
 *  2) — a `null` (either at boot or on a later read) simply SKIPS that check for the affected read, it never
 *  reads as "moved" and never falsely restarts.
 * @param {{root:string, run?:typeof gitRun, timeoutMs?:number}} o
 * @returns {string|null}
 */
export function readHeadSha({ root, run = gitRun, timeoutMs = 60_000 }) {
  const r = run(['rev-parse', 'HEAD'], { cwd: root, timeout: timeoutMs, killSignal: 'SIGKILL' });
  const out = String(r.stdout ?? '').trim();
  return r.status === 0 && out ? out : null;
}

/**
 * Wrap a daemon's `runDaemonLoop` effects so each tick first self-syncs the clone. When new commits arrive,
 * `onRestart` runs in place of the tick (the caller releases its lease and exits); otherwise the tick runs.
 *
 * #3383 bug 2 (unconditional, see file header): the on-disk `HEAD` sha is recorded once, right now, when this
 * function builds the wrapped effects (i.e., at the daemon's own boot, before `runDaemonLoop`'s first tick).
 * Every tick re-reads it; if it no longer matches — this process's OWN merge (the branch below), a SIBLING
 * process sharing the same clone having already merged, or a human's own `git merge`/`pull` — this process's
 * in-memory code no longer matches the checkout on disk, so it restarts too, regardless of who moved it.
 *
 * #3383 bug 1 (opt-in via `hasStaleRefusal`, see file header): when the wrapped tick's OWN result shows it hit
 * the stale-main refusal mid-tick, re-sync immediately and restart if that finds new commits, instead of
 * waiting out the full `intervalMs` to lose the same race again. A caller that omits `hasStaleRefusal` (every
 * caller that existed before this option) is byte-identical to before.
 * @param {{tickOnce:(...args:any[])=>any}} effects
 * @param {{root:string, onRestart:(info:object)=>any, sync?:typeof selfSyncCheckout, log?:Console,
 *   timeoutMs?:number, readHead?:typeof readHeadSha, hasStaleRefusal?:(tickResult:any)=>boolean}} o
 */
export function withSelfSync(effects, { root, onRestart, sync = selfSyncCheckout, log = console, timeoutMs, readHead = readHeadSha, hasStaleRefusal }) {
  const tick = effects.tickOnce;
  const syncOpts = () => ({ root, ...(timeoutMs != null ? { timeoutMs } : {}) });
  // Boot-time HEAD — read ONCE, here, before any tick ever runs. A read failure (null) permanently disables
  // the drift check for this process's lifetime rather than risk comparing against a wrong/stale value.
  const bootSha = readHead(syncOpts());
  return {
    ...effects,
    // Forwards whatever arguments the caller's own tickOnce takes (e.g. runner.mjs's per-tick bookkeeping
    // payload) straight through to the wrapped `tick` — this wrapper never needs to see them itself, and
    // dropping them would silently reset a payload-threading caller's state every tick. The daemons that
    // built this helper pass a zero-arg tickOnce, so `...args` is empty for them and nothing changes.
    tickOnce: async (...args) => {
      const r = sync(syncOpts());
      if (r.merged) {
        log.error?.(`daemon-self-sync: merged ${r.commits} new commit(s) from origin/main — restarting onto the new code`);
        return onRestart(r);
      }
      // #3383 bug 2 — HEAD moved since boot even though THIS sync found nothing to merge (someone else,
      // typically a sibling daemon process sharing this same clone, already brought it current first).
      const headNow = bootSha != null ? readHead(syncOpts()) : null;
      if (bootSha != null && headNow != null && headNow !== bootSha) {
        log.error?.(`daemon-self-sync: HEAD moved from ${bootSha} to ${headNow} since this process booted (likely a sibling process sharing this clone self-synced first) — restarting onto the new code (#3383)`);
        return onRestart({ merged: false, commits: 0, reason: 'head-moved', headSha: headNow });
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
      }
      const result = await tick(...args);
      // #3383 bug 1 — this SAME tick's own result shows it hit the stale-main refusal (origin/main moved
      // AFTER the tick-start sync above but before the tick finished). Re-sync right now rather than wait out
      // the rest of `intervalMs` to lose the same race again.
      if (typeof hasStaleRefusal === 'function' && hasStaleRefusal(result)) {
        const r2 = sync(syncOpts());
        if (r2.merged) {
          log.error?.(`daemon-self-sync: tick hit the stale-main refusal — merged ${r2.commits} new commit(s) immediately and restarting onto the new code (#3383), instead of waiting the full interval to lose the same race again`);
          return onRestart(r2);
        }
      }
      return result;
    },
  };
}
