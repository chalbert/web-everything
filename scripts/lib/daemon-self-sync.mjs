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
 * POC MODE (epic #3383's daemon POC, `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode`,
 * `we:scripts/lib/poc-branches.json`'s `lane/daemon-poc` entry). Setting {@link DAEMON_SELF_SYNC_BRANCH_ENV}
 * (`DAEMON_SELF_SYNC_BRANCH=lane/daemon-poc`) switches a clone's "home" branch from `main` to the named POC
 * branch and, each tick, fetches BOTH `origin/main` AND `origin/<poc>`, merging whichever has commits the
 * clone lacks — same merge-commit-never-rebase-never-push contract as the default path, just against two
 * upstreams instead of one. {@link decidePocSelfSync} / {@link selfSyncCheckoutPoc} carry this; the DEFAULT
 * (env unset) path through {@link decideSelfSync} / {@link selfSyncCheckout} is UNCHANGED — not refactored to
 * share the two-source logic — specifically so the already-shipped, live daemon behavior stays byte-identical
 * rather than riding on a generalization it never asked for.
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
 * @param {{root:string, base?:string, run?:typeof gitRun}} o
 * @returns {{merged:boolean, commits:number, reason:string}}
 */
export function selfSyncCheckout({ root, base = 'main', run = gitRun }) {
  const git = (args) => run(args, { cwd: root });
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// POC MODE (#3383 daemon POC) — a clone tracking a registered POC branch INSTEAD of `main` alone.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The env var that switches a clone into POC mode — mirrors `we:scripts/lib/poc-branches.mjs`'s own
 *  `WE_POC_BRANCH_SYNC` naming convention. Unset (or blank) is the DEFAULT path, unchanged. */
export const DAEMON_SELF_SYNC_BRANCH_ENV = 'DAEMON_SELF_SYNC_BRANCH';

/**
 * Resolve the POC branch a clone should track, from an explicit option or {@link DAEMON_SELF_SYNC_BRANCH_ENV}.
 * Blank/whitespace-only counts as unset — the default (`main`-only) path. PURE.
 * @param {{pocBranch?:string, env?:NodeJS.ProcessEnv}} [o]
 * @returns {string|null}
 */
export function resolvePocSyncBranch({ pocBranch, env = process.env } = {}) {
  const explicit = typeof pocBranch === 'string' ? pocBranch.trim() : '';
  if (explicit) return explicit;
  const fromEnv = typeof env?.[DAEMON_SELF_SYNC_BRANCH_ENV] === 'string' ? env[DAEMON_SELF_SYNC_BRANCH_ENV].trim() : '';
  return fromEnv || null;
}

/**
 * Pure: what should a POC-mode clone do, given fetch/behind readings against BOTH `origin/main` and the POC
 * branch it now also tracks? Generalizes {@link decideSelfSync} to two independent sources — `onBranch`
 * replaces `onBase` (the clone's home branch is the POC branch itself, not `main`, once this mode is active);
 * every other gate means the same thing it always did: a dirty tree or an off-branch checkout is never
 * touched, and a source that never fetched contributes nothing. Order: the two clone-wide gates (`onBranch`,
 * `dirty`) are checked before either source's own fetch/behind, since they apply regardless of what either
 * source reports.
 * @param {{dirty:boolean, onBranch:boolean, main:{fetched:boolean, behind:number}, poc:{fetched:boolean, behind:number}}} s
 * @returns {{action:'none'|'merge'|'skip', reason:string, mergeMain:boolean, mergePoc:boolean}}
 */
export function decidePocSelfSync({ dirty, onBranch, main, poc }) {
  if (!onBranch) return { action: 'skip', reason: 'not-on-branch', mergeMain: false, mergePoc: false };
  if (dirty) return { action: 'skip', reason: 'dirty', mergeMain: false, mergePoc: false };
  if (!main?.fetched && !poc?.fetched) return { action: 'skip', reason: 'fetch-failed', mergeMain: false, mergePoc: false };
  const mergeMain = !!main?.fetched && (main?.behind ?? 0) > 0;
  const mergePoc = !!poc?.fetched && (poc?.behind ?? 0) > 0;
  if (!mergeMain && !mergePoc) return { action: 'none', reason: 'up-to-date', mergeMain: false, mergePoc: false };
  return { action: 'merge', reason: 'behind', mergeMain, mergePoc };
}

/**
 * The git IO for POC mode: fetch BOTH `origin/<base>` and `origin/<pocBranch>`, measure each independently,
 * and merge whichever has commits the clone lacks — each its OWN merge commit, never a rebase, never a push.
 * A conflict on either merge aborts THAT merge only (never leaves a half-merged tree — same contract as
 * {@link selfSyncCheckout}) and STOPS this tick's sync (the other source is not attempted once one has
 * conflicted). A merge that already landed earlier in the SAME tick (`origin/main` merged cleanly, then
 * `origin/<pocBranch>` conflicted) stays committed — real, completed progress, not a rollback candidate — and
 * is reported as `reason: 'merged-partial'` so the caller still restarts onto it while logging that the other
 * source needs a hand merge.
 * @param {{root:string, base?:string, pocBranch:string, run?:typeof gitRun}} o
 * @returns {{merged:boolean, commits:number, reason:string}}
 */
export function selfSyncCheckoutPoc({ root, base = 'main', pocBranch, run = gitRun }) {
  if (!pocBranch) throw new TypeError('selfSyncCheckoutPoc requires a pocBranch');
  const git = (args) => run(args, { cwd: root });
  const fetchedMain = git(['fetch', 'origin', base, '--quiet']).status === 0;
  const fetchedPoc = git(['fetch', 'origin', pocBranch, '--quiet']).status === 0;
  const count = (range) => {
    const r = git(['rev-list', '--count', range]);
    return r.status === 0 ? Number(r.stdout.trim()) || 0 : 0;
  };
  const behindMain = fetchedMain ? count(`HEAD..origin/${base}`) : 0;
  const behindPoc = fetchedPoc ? count(`HEAD..origin/${pocBranch}`) : 0;
  const head = git(['symbolic-ref', '--short', 'HEAD']);
  const onBranch = head.status === 0 && head.stdout.trim() === pocBranch;
  const dirty = !!git(['status', '--porcelain']).stdout.trim();

  const decision = decidePocSelfSync({
    dirty,
    onBranch,
    main: { fetched: fetchedMain, behind: behindMain },
    poc: { fetched: fetchedPoc, behind: behindPoc },
  });
  if (decision.action !== 'merge') return { merged: false, commits: 0, reason: decision.reason };

  let commits = 0;
  let mergedAny = false;
  let conflicted = false;
  const mergeRef = (ref, n) => {
    const merge = git(['merge', ref, '--no-edit', '-m', `sync: catch up with ${ref} (daemon self-sync, POC mode)`]);
    if (merge.status !== 0) { git(['merge', '--abort']); conflicted = true; return; }
    commits += n;
    mergedAny = true;
  };

  if (decision.mergeMain) mergeRef(`origin/${base}`, behindMain);
  if (!conflicted && decision.mergePoc) mergeRef(`origin/${pocBranch}`, behindPoc);

  if (mergedAny) return { merged: true, commits, reason: conflicted ? 'merged-partial' : 'merged' };
  return { merged: false, commits: 0, reason: 'conflict' };
}

/**
 * Wrap a daemon's `runDaemonLoop` effects so each tick first self-syncs the clone. When new commits arrive,
 * `onRestart` runs in place of the tick (the caller releases its lease and exits); otherwise the tick runs.
 *
 * POC mode ({@link resolvePocSyncBranch} resolves non-null, from `pocBranch` or
 * {@link DAEMON_SELF_SYNC_BRANCH_ENV}) routes through {@link selfSyncCheckoutPoc} instead of
 * {@link selfSyncCheckout} — everything else about the wrapper (restart-on-merge, tick-through otherwise) is
 * identical. The DEFAULT (unset) path below is the ORIGINAL code, untouched, so byte-identical behavior for
 * every daemon that does not opt in is a property of the diff, not a claim about it.
 * @param {{tickOnce:()=>any}} effects
 * @param {{root:string, onRestart:(info:object)=>any, sync?:typeof selfSyncCheckout, syncPoc?:typeof selfSyncCheckoutPoc, base?:string, pocBranch?:string, env?:NodeJS.ProcessEnv, log?:Console}} o
 */
export function withSelfSync(effects, { root, onRestart, sync = selfSyncCheckout, syncPoc = selfSyncCheckoutPoc, base = 'main', pocBranch, env = process.env, log = console }) {
  const tick = effects.tickOnce;
  const resolvedPocBranch = resolvePocSyncBranch({ pocBranch, env });
  return {
    ...effects,
    // Forwards whatever arguments the caller's own tickOnce takes (e.g. runner.mjs's per-tick bookkeeping
    // payload) straight through to the wrapped `tick` — this wrapper never needs to see them itself, and
    // dropping them would silently reset a payload-threading caller's state every tick. The daemons that
    // built this helper pass a zero-arg tickOnce, so `...args` is empty for them and nothing changes.
    tickOnce: async (...args) => {
      if (resolvedPocBranch) {
        const r = syncPoc({ root, base, pocBranch: resolvedPocBranch });
        if (r.merged) {
          const partial = r.reason === 'merged-partial';
          log.error?.(
            `daemon-self-sync: [POC mode: ${resolvedPocBranch}] merged ${r.commits} new commit(s) — restarting onto the new code`
            + (partial ? ` (origin/${resolvedPocBranch} still conflicts — needs a hand merge)` : ''),
          );
          return onRestart(r);
        }
        if (r.reason === 'conflict' || r.reason === 'dirty' || r.reason === 'not-on-branch') {
          log.error?.(`daemon-self-sync: [POC mode: ${resolvedPocBranch}] behind but NOT syncing (${r.reason}) — needs a hand merge`);
        }
        return tick(...args);
      }
      // ---- DEFAULT (unset) path — verbatim original behavior ----
      const r = sync({ root });
      if (r.merged) {
        log.error?.(`daemon-self-sync: merged ${r.commits} new commit(s) from origin/main — restarting onto the new code`);
        return onRestart(r);
      }
      if (r.reason === 'conflict' || r.reason === 'dirty' || r.reason === 'not-on-main') {
        log.error?.(`daemon-self-sync: behind origin/main but NOT syncing (${r.reason}) — needs a hand merge`);
      }
      return tick(...args);
    },
  };
}
