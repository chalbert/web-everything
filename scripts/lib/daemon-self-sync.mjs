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
 */

import { gitRun } from './main-staleness.mjs';

/**
 * Pure: what should a daemon's clone do, given where it stands against `origin/main`?
 * @param {{fetched:boolean, behind:number, dirty:boolean, onBase:boolean}} s
 * @returns {{action:'none'|'merge'|'skip', reason:string}}
 */
export function decideSelfSync({ fetched, behind, dirty, onBase }) {
  if (!fetched) return { action: 'skip', reason: 'fetch-failed' };
  if (!behind) return { action: 'none', reason: 'up-to-date' };
  if (!onBase) return { action: 'skip', reason: 'not-on-main' };
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
 * timed-out merge → aborted (itself under the same timeout) and reported as `conflict`.
 * @param {{root:string, base?:string, run?:typeof gitRun, timeoutMs?:number}} o
 * @returns {{merged:boolean, commits:number, reason:string}}
 */
export function selfSyncCheckout({ root, base = 'main', run = gitRun, timeoutMs = 60_000 }) {
  const git = (args) => run(args, { cwd: root, timeout: timeoutMs, killSignal: 'SIGKILL' });
  const fetched = git(['fetch', 'origin', base, '--quiet']).status === 0;
  const count = (range) => {
    const r = git(['rev-list', '--count', range]);
    return r.status === 0 ? Number(r.stdout.trim()) || 0 : 0;
  };
  const behind = fetched ? count(`HEAD..origin/${base}`) : 0;
  const head = git(['symbolic-ref', '--short', 'HEAD']);
  const onBase = head.status === 0 && head.stdout.trim() === base;
  const dirty = !!git(['status', '--porcelain']).stdout.trim();

  const decision = decideSelfSync({ fetched, behind, dirty, onBase });
  if (decision.action !== 'merge') return { merged: false, commits: 0, reason: decision.reason };

  const merge = git(['merge', `origin/${base}`, '--no-edit', '-m', `sync: catch up with origin/${base} (daemon self-sync)`]);
  if (merge.status !== 0) {
    git(['merge', '--abort']);
    return { merged: false, commits: 0, reason: 'conflict' };
  }
  return { merged: true, commits: behind, reason: 'merged' };
}

/**
 * Wrap a daemon's `runDaemonLoop` effects so each tick first self-syncs the clone. When new commits arrive,
 * `onRestart` runs in place of the tick (the caller releases its lease and exits); otherwise the tick runs.
 * @param {{tickOnce:()=>any}} effects
 * @param {{root:string, onRestart:(info:object)=>any, sync?:typeof selfSyncCheckout, log?:Console, timeoutMs?:number}} o
 */
export function withSelfSync(effects, { root, onRestart, sync = selfSyncCheckout, log = console, timeoutMs }) {
  const tick = effects.tickOnce;
  return {
    ...effects,
    tickOnce: async () => {
      const r = sync({ root, ...(timeoutMs != null ? { timeoutMs } : {}) });
      if (r.merged) {
        log.error?.(`daemon-self-sync: merged ${r.commits} new commit(s) from origin/main — restarting onto the new code`);
        return onRestart(r);
      }
      if (r.reason === 'conflict' || r.reason === 'dirty' || r.reason === 'not-on-main') {
        log.error?.(`daemon-self-sync: behind origin/main but NOT syncing (${r.reason}) — needs a hand merge`);
      }
      return tick();
    },
  };
}
