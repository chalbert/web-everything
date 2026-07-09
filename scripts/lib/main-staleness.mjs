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
 * @param {{behind:number, ahead:number, dirty:boolean, autoFf:boolean, base?:string}} o
 */
export function classifyStaleness({ behind, ahead, dirty, autoFf, base = 'main' }) {
  if (!behind || behind <= 0) return { fresh: true, behind: 0, ahead };
  // Auto-ff any non-diverged tree, dirty included: the pull is `--ff-only --autostash`, which stashes a dirty
  // tree, fast-forwards, and pops it back. Only a diverged tree (local commits ahead) can't ff — warn there.
  if (autoFf && (!ahead || ahead === 0)) return { action: 'auto-ff', behind, ahead: 0, dirty };
  const why = ahead ? `diverged (${ahead} local commit(s))` : 'not auto-syncing';
  return {
    action: 'warn', behind, ahead, dirty,
    warning: `local ${base} is ${behind} commit(s) behind origin/${base} (${why}) — ranking/selection may be STALE. `
      + `Sync (git pull --ff-only --autostash) or work in a fresh clone off origin/${base}.`,
  };
}

/**
 * Fetch origin/<base>, compare to local <base>, and either fast-forward (clean) or return a warning. Fail-soft.
 * @param {{base?:string, autoFf?:boolean, run?:typeof gitRun}} o
 * @returns {{offline?:true}|{fresh:true,behind:0}|{synced:true,behind:number}|{action:'warn',behind,ahead,dirty,warning:string}}
 */
export function checkMainStaleness({ base = 'main', autoFf = true, run = gitRun } = {}) {
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
  const cls = classifyStaleness({ behind, ahead, dirty, autoFf, base });
  if (cls.action === 'auto-ff') {
    const pulled = run(['pull', '--ff-only', '--autostash']);
    if (pulled.status === 0) return { synced: true, behind };
    return { action: 'warn', behind, ahead, dirty, warning: `local ${base} is ${behind} behind origin/${base} and the auto fast-forward failed — sync by hand.` };
  }
  return cls;
}
