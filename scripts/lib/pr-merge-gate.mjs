/**
 * pr-merge-gate.mjs — the ONE place a `gh pr merge` to `main` may originate (#2290).
 *
 * INVARIANT: the drain is the SOLE writer to `main`. Every route that used to merge inline — `/pr`
 * (`pr-land.mjs`), `/finish` (`lane-resume.mjs`), `/merge` + `/drain` (`merge-ai-prs.mjs`) — now shells out
 * through THIS module, and only `caller === 'drain'` is allowed to actually merge. `/pr` and `/finish` instead
 * enqueue (label `ready-to-merge`) and trigger a single-couple drain pass, so a single serialized writer is the
 * only place that can safely assign the next NNN (the prerequisite for JIT numbering).
 *
 * BREAK-GLASS: an emergency unbreak-main can bypass the gate with `WE_MERGE_BREAK_GLASS=1` — a documented,
 * off-the-normal-path admin override that writes a LOUD audit line to stderr every time it is used, so a
 * non-drain merge is never silent.
 */
import { execFileSync } from 'node:child_process';

/** The `gh pr merge` method flag (default `--merge` = the --no-ff history the drain wants). Pure. */
export function mergeMethodFlag(method) {
  switch (method) {
    case 'squash': return '--squash';
    case 'rebase': return '--rebase';
    case 'merge':
    default: return '--merge';
  }
}

/** Build the `gh pr merge` argv the gate shells — mirrors the merge-ai-prs inline call exactly:
 *  `pr merge <n> [--repo <slug>] --<method> --delete-branch`. `repo` null → the cwd repo (no --repo). Pure. */
export function buildGateMergeArgs({ pr, repo = null, method = 'merge' }) {
  return ['pr', 'merge', String(pr), ...(repo ? ['--repo', repo] : []), mergeMethodFlag(method), '--delete-branch'];
}

/** Is the emergency break-glass override armed? (`WE_MERGE_BREAK_GLASS=1`.) */
function breakGlassArmed(env = process.env) {
  return env && env.WE_MERGE_BREAK_GLASS === '1';
}

/**
 * Assert this caller MAY write to main, WITHOUT shelling a merge (used by non-gh write-to-main intents such as
 * pr-land's `--fallback-git` local `git merge`). `caller === 'drain'` always passes. Any other route THROWS
 * unless break-glass is armed — in which case it passes and emits the loud audit line. Returns
 * `{ breakGlass:boolean }`.
 * @param {{caller:string, pr?:(number|string|null), repo?:(string|null), env?:object, log?:{write:Function}}} o
 */
export function assertMayMerge({ caller, pr = null, repo = null, env = process.env, log = process.stderr } = {}) {
  if (caller === 'drain') return { breakGlass: false };
  if (!breakGlassArmed(env)) {
    throw new Error(
      `pr-merge-gate: only the drain may merge to main (route ${caller} is not the drain). ` +
      `Enqueue + trigger a drain pass instead. Break-glass: WE_MERGE_BREAK_GLASS=1 (logged).`,
    );
  }
  log.write(`pr-merge-gate: BREAK-GLASS merge by route=${caller} pr=${pr} repo=${repo || 'cwd'} — off the normal path\n`);
  return { breakGlass: true };
}

/**
 * The SOLE `gh pr merge` shell-out. Asserts the caller is the drain (or break-glass), then runs
 * `gh pr merge …`. Returns whatever `exec` returns (the merge-ai-prs inline call ignored the result and relied
 * on a throw for failure — preserved: the default `exec` is `execFileSync`, which throws on a non-zero gh exit).
 * `exec` is injectable so the gate is unit-testable without shelling gh.
 * @param {{pr:(number|string), repo?:(string|null), method?:string, caller:string,
 *          exec?:Function, env?:object, log?:{write:Function}}} o
 */
export function mergePr({ pr, repo = null, method = 'merge', caller, exec = execFileSync, env = process.env, log = process.stderr } = {}) {
  assertMayMerge({ caller, pr, repo, env, log });
  return exec('gh', buildGateMergeArgs({ pr, repo, method }), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
