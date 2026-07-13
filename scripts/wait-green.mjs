#!/usr/bin/env node
/**
 * wait-green.mjs — poll a PR's required checks until they pass, fail, or the timeout elapses (#2434, one of
 * three drain fetch/state helpers under `scripts/`).
 *
 * WHY: a reviewer / the drain re-runs `gh pr checks <pr>` by hand every so often to learn when a parked PR has
 * gone green (or red). This is the ONE blocking wait that does it deterministically: it polls `gh pr checks
 * <pr> --required --json name,state,bucket` on a fixed interval and exits the moment the SHARED `classifyChecks`
 * (from `./pr-land.mjs` — the exact truth pr-land itself waits for) says the required set is `passed` (exit 0)
 * or `failed` (exit 2), or the wall-clock timeout is hit (exit 3).
 *
 * Split mirrors the house idiom (`scripts/push-if-green.mjs`, `scripts/review-detail.mjs`): a PURE
 * `waitVerdict({checkStatus, elapsed, timeout})` maps (elapsed, timeout, check status) → a terminal verdict +
 * exit code, unit-tested against fixtures; a thin impure CLI does the `gh` poll + sleeps. `Date.now()` /
 * `setTimeout` are used directly here — this is a real Node CLI, not a Workflow script.
 *
 * Usage:
 *   node scripts/wait-green.mjs 472                            # poll every 15s up to 600s, exit on green/red/timeout
 *   node scripts/wait-green.mjs 12 --repo=~/workspace/frontierui
 *   node scripts/wait-green.mjs 472 --timeout=1200 --interval=30
 *   node scripts/wait-green.mjs 472 --json                     # machine-readable final result on stdout
 *
 * Flags:
 *   <pr>              the PR number (positional, required)
 *   --repo=<path>     filesystem checkout to run gh in (default: cwd)
 *   --timeout=<sec>   max wall-clock seconds to wait (default 600)
 *   --interval=<sec>  seconds between polls (default 15)
 *   --json            emit the final result as a JSON object on stdout (else a one-line human result)
 *
 * Progress goes to stderr each poll; the FINAL result goes to stdout. Exit: 0 = passed, 2 = failed,
 * 3 = timed out (or a usage error / unrecoverable gh error).
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { classifyChecks } from './pr-land.mjs';

/**
 * The PURE terminal-verdict map (#2434). Given the current required-check `classifyChecks` status and the
 * elapsed vs timeout wall-clock, decide whether to STOP (with a verdict + exit code) or keep polling. Pure — no
 * clock, no gh; the CLI feeds it `Date.now()`-derived elapsed. `done:false` means "poll again".
 *   - checkStatus 'passed' → passed, exit 0.
 *   - checkStatus 'failed' → failed, exit 2 (never wait out a red check).
 *   - otherwise (pending / anything else): timed-out (exit 3) once elapsed ≥ timeout, else keep waiting.
 * @param {{checkStatus:string, elapsed:number, timeout:number}} o - elapsed & timeout in the SAME unit (seconds).
 * @returns {{verdict:'passed'|'failed'|'timeout'|'pending', exit:number|null, done:boolean}}
 */
export function waitVerdict({ checkStatus, elapsed = 0, timeout = 0 } = {}) {
  if (checkStatus === 'passed') return { verdict: 'passed', exit: 0, done: true };
  if (checkStatus === 'failed') return { verdict: 'failed', exit: 2, done: true };
  if (elapsed >= timeout) return { verdict: 'timeout', exit: 3, done: true };
  return { verdict: 'pending', exit: null, done: false };
}

// Allow importing the pure verdict map without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
  const flagVal = (name) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(`--${name}=`.length) : undefined;
  };
  const repoFlag = flagVal('repo');
  const cwd = repoFlag ? resolve(expandHome(repoFlag)) : process.cwd();
  const timeout = Number(flagVal('timeout') ?? 600);
  const interval = Number(flagVal('interval') ?? 15);
  const asJson = args.includes('--json');
  const pr = args.find((a) => /^\d+$/.test(a));

  if (!pr) {
    process.stdout.write(`${JSON.stringify({ error: 'usage: wait-green <pr> [--repo=<path>] [--timeout=600] [--interval=15] [--json]' })}\n`);
    process.exit(2);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const start = Date.now();

  // One poll: fetch the required-check rows and classify. A transient gh error reads as `pending` (keep
  // waiting) — a flaky network call must not be mistaken for a red check; only the timeout ends the wait then.
  function pollStatus() {
    try {
      const rows = JSON.parse(execFileSync('gh', [
        'pr', 'checks', pr, '--required', '--json', 'name,state,bucket',
      ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]');
      return { checkStatus: classifyChecks(rows).status, rows };
    } catch (e) {
      // `gh pr checks` exits non-zero when checks are still pending OR on a real error; it prints the rows to
      // stdout in the pending case. Recover the rows from stdout when present, else treat as pending.
      const stdout = String((e && e.stdout) || '').trim();
      if (stdout.startsWith('[')) {
        try { const rows = JSON.parse(stdout); return { checkStatus: classifyChecks(rows).status, rows }; } catch { /* fall through */ }
      }
      return { checkStatus: 'pending', rows: [], ghError: String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() };
    }
  }

  function emitFinal(verdict, exit, checkStatus) {
    const elapsed = Math.round((Date.now() - start) / 1000);
    const result = { pr: Number(pr), verdict, checkStatus, elapsed, timeout };
    if (asJson) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stdout.write(`#${pr} ${verdict} (checks=${checkStatus}) after ${elapsed}s\n`);
    process.exit(exit);
  }

  (async () => {
    for (;;) {
      const { checkStatus, ghError } = pollStatus();
      const elapsed = (Date.now() - start) / 1000;
      const v = waitVerdict({ checkStatus, elapsed, timeout });
      process.stderr.write(`wait-green #${pr} · checks=${checkStatus}${ghError ? ` (gh: ${ghError})` : ''} · ${Math.round(elapsed)}s/${timeout}s\n`);
      if (v.done) return emitFinal(v.verdict, v.exit, checkStatus);
      await sleep(interval * 1000);
    }
  })();
}
