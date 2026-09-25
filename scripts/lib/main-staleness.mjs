/**
 * main-staleness.mjs — the fetch-first staleness guard (#2204) for any CLI that READS local backlog/git state
 * to make a decision (the readiness ranker behind `/batch`, `/next`, `/ready`). The LANDING scripts already
 * fetch; the read side did not, so a local checkout behind `origin/main` — seen 2026-07-03 at 126 commits
 * behind — makes the ranker pick/order against WRONG item state (missing items, resolved-looking-open,
 * clobbered-looking ids). This guard fetches first and either fast-forwards a clean checkout or warns loudly.
 *
 * Non-destructive + fail-soft: the fetch is best-effort (a network miss → `{ offline:true }`, never a hard
 * fail); the auto-ff is `--ff-only --autostash` (advance main, autostash-preserve any dirty edits, never
 * force/rebase) and runs on any NON-DIVERGED tree, dirty or clean — `--autostash` exists precisely to carry a
 * dirty tree across a fast-forward, so gating it on a clean tree (the old `!dirty` guard) blocked the very case
 * autostash solves and left the ranker reading STALE. Only a DIVERGED tree (local ahead) is warned, never
 * touched; and if the autostash-ff itself fails (e.g. a stash-pop conflict) it falls back to a warn.
 *
 * The pure classifier (`classifyStaleness`) is unit-tested separately from the git IO (`checkMainStaleness`
 * takes an injected `run` so it needs no real repo).
 */

import { spawnSync } from 'node:child_process';

/** Default git runner — spawnSync (returns non-zero without throwing). */
export function gitRun(args, opts = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', ...opts });
  return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Classify a local-vs-origin comparison into an action. Pure.
 *   { fresh:true }                 — up to date (behind 0).
 *   { action:'auto-ff' }           — behind, NOT diverged (dirty or clean) → safe to autostash fast-forward.
 *   { action:'warn', warning }     — behind AND diverged (local ahead), or autoFf off → read may be stale; warn, don't touch.
 *
 * `cleanOnly` (#3474) is the stricter gate for a DISPATCH chokepoint that must never touch a tree it does not
 * own: auto-ff ONLY when the tree is clean (nothing for `--autostash` to carry) AND `HEAD` is on `base`
 * (`onBase`, default true so a caller that has not measured it is unchanged). Every other behind case warns,
 * with a machine-readable `reason`: `diverged` | `dirty` | `not-on-base` | `not-auto-syncing`.
 * @param {{behind:number, ahead:number, dirty:boolean, autoFf:boolean, base?:string, cleanOnly?:boolean, onBase?:boolean}} o
 */
export function classifyStaleness({ behind, ahead, dirty, autoFf, base = 'main', cleanOnly = false, onBase = true }) {
  if (!behind || behind <= 0) return { fresh: true, behind: 0, ahead };
  // Auto-ff any non-diverged tree, dirty included: the pull is `--ff-only --autostash`, which stashes a dirty
  // tree, fast-forwards, and pops it back. Only a diverged tree (local commits ahead) can't ff — warn there.
  const diverged = !!ahead && ahead > 0;
  if (autoFf && !diverged && (!cleanOnly || (!dirty && onBase))) return { action: 'auto-ff', behind, ahead: 0, dirty };
  const why = diverged ? `diverged (${ahead} local commit(s))` : 'not auto-syncing';
  const reason = diverged ? 'diverged' : !autoFf ? 'not-auto-syncing' : dirty ? 'dirty' : 'not-on-base';
  return {
    action: 'warn', reason, behind, ahead, dirty,
    warning: `local ${base} is ${behind} commit(s) behind origin/${base} (${why}) — ranking/selection may be STALE. `
      + `Sync (git pull --ff-only --autostash) or work in a fresh clone off origin/${base}.`,
  };
}

/**
 * Fetch origin/<base>, compare to local <base>, and either fast-forward (clean) or return a warning. Fail-soft.
 *
 * `cleanOnly` (#3474) switches the sync to the dispatch-safe form: fast-forward ONLY a clean tree whose `HEAD` is
 * on `base`, via a plain `git merge --ff-only origin/<base>` (the fetch already ran) — never `pull --autostash`,
 * which would stash and pop a dirty tree the caller does not expect mutated. Diverged, dirty-and-behind, or
 * off-`base` all return the warn with a `reason`; the sync is not attempted.
 * @param {{base?:string, autoFf?:boolean, cleanOnly?:boolean, run?:typeof gitRun}} o
 * @returns {{offline?:true}|{fresh:true,behind:0}|{synced:true,behind:number}|{action:'warn',reason?:string,behind,ahead,dirty,warning:string}}
 */
export function checkMainStaleness({ base = 'main', autoFf = true, cleanOnly = false, run = gitRun } = {}) {
  const fetched = run(['fetch', 'origin', base, '--quiet']);
  if (fetched.status !== 0) return { offline: true };
  const rev = (a) => { const r = run(['rev-parse', a]); return r.status === 0 ? r.stdout.trim() : null; };
  const local = rev(base);
  const origin = rev(`origin/${base}`);
  if (!local || !origin) return { offline: true };
  if (local === origin) return { fresh: true, behind: 0 };
  const count = (range) => { const r = run(['rev-list', '--count', range]); return r.status === 0 ? Number(r.stdout.trim()) || 0 : 0; };
  const behind = count(`${base}..origin/${base}`);
  const ahead = count(`origin/${base}..${base}`);
  const st = run(['status', '--porcelain']);
  const dirty = !!(st.stdout && st.stdout.trim());
  let onBase = true;
  if (cleanOnly) {
    const head = run(['symbolic-ref', '--short', 'HEAD']);
    onBase = head.status === 0 && head.stdout.trim() === base;
  }
  const cls = classifyStaleness({ behind, ahead, dirty, autoFf, base, cleanOnly, onBase });
  if (cls.action === 'auto-ff') {
    const synced = cleanOnly ? run(['merge', '--ff-only', `origin/${base}`]) : run(['pull', '--ff-only', '--autostash']);
    if (synced.status === 0) return { synced: true, behind };
    return {
      action: 'warn', reason: 'ff-failed', behind, ahead, dirty,
      warning: `local ${base} is ${behind} behind origin/${base} and the auto fast-forward failed — sync by hand.`,
      ...(cleanOnly && synced.stderr.trim() ? { detail: synced.stderr.trim() } : {}),
    };
  }
  return cls;
}

// ── #3875 — the throwing dispatch-chokepoint guard, extracted from we:scripts/operations/review-dispatch.mjs
//    (#3439/#3474/#3637) so a caller that is NOT review-dispatch (a future daemon split out of
//    we:skills-src/conveyor/runner.mjs — epic #3383, see #3860) can self-check its own checkout's freshness
//    without importing the whole review-dispatch module just for this one guard. `review-dispatch.mjs` keeps
//    re-exporting `assertMainNotStale` from here — its own two existing callers (`dispatchReview` and
//    we:scripts/conveyor/reconcile-fix-dispatch.mjs) are UNCHANGED, byte-identical default behavior (same
//    `label`, same thrown wording), verified against their own existing tests.

/** The reason-specific tail of the #3474 refusal: why the automatic fast-forward was NOT (or could not be) done,
 *  and what to do about it. Falls back to today's generic remedy when the check gave no `reason` (a stub, or an
 *  older checker). */
export function staleRemedy(st, base) {
  const fresh = `or retry from a fresh clone of origin/${base}.`;
  switch (st.reason) {
    case 'diverged':
      return `It is also DIVERGED (${st.ahead} local commit(s) ahead of origin/${base}), so it cannot fast-forward — `
        + `rebase or merge origin/${base} into it by hand, ${fresh}`;
    case 'dirty':
      return `It has uncommitted changes, so the automatic fast-forward was NOT attempted over them — commit or stash `
        + `them, then sync (git pull --ff-only), ${fresh}`;
    case 'not-on-base':
      return `HEAD is not on ${base}, so the automatic fast-forward was not attempted — check out ${base} and sync `
        + `(git pull --ff-only), ${fresh}`;
    case 'ff-failed':
      return `The automatic fast-forward (git merge --ff-only origin/${base}) failed${st.detail ? ` (${st.detail})` : ''} — `
        + `sync by hand (git pull --ff-only), ${fresh}`;
    default:
      return `Sync (git pull --ff-only) ${fresh}`;
  }
}

/** The stable substring embedded in {@link assertMainNotStale}'s own thrown refusal message — the ONE marker a
 *  downstream caller that only ever sees the error's flattened first-line string (e.g. a `forEachRepo`
 *  per-repo `{repo, error}` capture, which keeps `String(e.message).split('\n')[0]` and discards the Error
 *  object itself, or any `.code` it might have carried) can match on to recognize "this specific tick failure
 *  IS the stale-main refusal", as opposed to any other tick failure (a `gh` outage, a rate limit, a genuine
 *  bug) that lands in the exact same `refusals`/`failed` bucket. Used at BOTH the throw site below and by
 *  {@link isStaleMainRefusalMessage}, so a future wording change can never silently break detection — there is
 *  only one place this string is written. (#3383 bug 1 — the fix-dispatch and review daemons need this to
 *  react to a mid-tick stale refusal immediately instead of wasting the rest of the tick.) */
export const STALE_MAIN_REFUSAL_MARKER = 'STALE code from this checkout';

/** Does this tick-failure message look like {@link assertMainNotStale}'s own refusal? See
 *  {@link STALE_MAIN_REFUSAL_MARKER}. Accepts anything falsy/non-string as "no" (a null/undefined `why`/
 *  `error` field is common on the non-error branches of the same shape). */
export function isStaleMainRefusalMessage(message) {
  return typeof message === 'string' && message.includes(STALE_MAIN_REFUSAL_MARKER);
}

/**
 * ASSERT the calling checkout is not behind `origin/<base>` — refuse LOUDLY rather than silently act on stale
 * code from this checkout's own import path (#3439). A checkout that is merely BEHIND (no local commits ahead)
 * with a CLEAN working tree and `HEAD` on `base` is fast-forwarded with zero conflict and zero judgment
 * (`git merge --ff-only origin/<base>`, via {@link checkMainStaleness}'s `cleanOnly` mode) and the caller
 * proceeds; every other behind case (DIVERGED, DIRTY-and-behind, off-`base`, or the merge itself failing)
 * throws, naming which case it is. A fetch failure (offline) stays fail-soft — we cannot tell if it's stale,
 * so we do not block on it (matches this file's own philosophy throughout).
 * @param {string} root
 * @param {(root: string) => ReturnType<typeof checkMainStaleness>} [checkStaleness] - injectable, defaults to
 *   a real `checkMainStaleness` scoped (via `run`'s `cwd`) to `root`.
 * @param {{base?: string, label?: string}} [o] - `base` is the delivery target to measure staleness against
 *   (default `main`); `label` prefixes the thrown/logged message so each caller reads as itself (default
 *   `review-dispatch`, this function's original and still most common caller).
 */
export function assertMainNotStale(root, checkStaleness, { base = 'main', label = 'review-dispatch' } = {}) {
  // #4044 Module E — a MANAGED clone (`process.env.WE_DAEMON_MANAGED_CLONE === '1'`, set by
  // `daemon-self-sync.mjs#withSelfSync` at wrapper construction) is rebuilt fresh from `origin/main` (+ its
  // overlay list) by `daemon-rebuild.mjs`, gated behind a live smoke check, every tick — a dispatch chokepoint
  // fast-forwarding it BY ITSELF would pull in un-smoked (possibly rejected) code straight past that gate. So a
  // managed clone never auto-ffs here: it refuses with the stale marker instead, exactly like a diverged/dirty
  // checkout always has, which `hasStaleRefusal` turns into an immediate GATED rebuild (never a raw merge).
  const managedClone = process.env.WE_DAEMON_MANAGED_CLONE === '1';
  const check = checkStaleness ?? ((r) => checkMainStaleness({
    base, autoFf: !managedClone, cleanOnly: true, run: (args) => gitRun(args, { cwd: r }),
  }));
  const st = check(root);
  if (st && st.synced) {
    process.stderr.write(`${label}: fast-forwarded the dispatching checkout ${st.behind} commit(s) to origin/${base} (#3474) before dispatching.\n`);
  }
  if (st && st.action === 'warn') {
    throw new Error(
      `${label}: the dispatching checkout is ${st.behind} commit(s) behind origin/${base} — refusing to `
      + `dispatch a review that would run ${STALE_MAIN_REFUSAL_MARKER}'s own import path (#3439). `
      + (managedClone
        // A daemon-managed clone is never fixed by hand (#4044): only its gated rebuild may move it, and when
        // the rebuild is holding it back it records why in its alerts log (`clone-held-stale`).
        ? `This is a DAEMON-MANAGED clone: only its gated rebuild moves it (never rebase/merge by hand). If this `
          + `persists, the rebuild is holding it — see the clone's \`clone-held-stale\` alert in `
          + `~/.claude/daemon-self-sync-state/<cloneKey>.alerts.jsonl for the reason and next retry.`
        : staleRemedy(st, base)),
    );
  }
  return st;
}
