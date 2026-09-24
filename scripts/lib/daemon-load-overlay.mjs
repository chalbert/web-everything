#!/usr/bin/env node
/**
 * @file scripts/lib/daemon-load-overlay.mjs
 * @description #3383 — the operator's own manual "load this early" CLI for a daemon clone, routed through the
 *   EXACT SAME merge → live-smoke → adopt/rollback code path `we:scripts/lib/daemon-self-sync.mjs#withSelfSync`
 *   now runs on every automatic tick (`selfSyncCheckout` for the merge, `we:scripts/lib/daemon-live-smoke.mjs
 *   #gateMergedCommit` for the gate) — so a hand-triggered early load can never bypass the gate the daemon's
 *   own self-sync is held to. Operator: "Also give ME a CLI for my manual early loads."
 *
 * USAGE:
 *   node scripts/lib/daemon-load-overlay.mjs --clone=<path to a daemon's dedicated clone> [--ref=<branch, default main>] [--json]
 *
 * WHAT IT DOES: fetches `--ref` into `--clone` and merges it (same merge-commit-never-rebase, fail-closed
 * dirty/unknown-state contract as {@link selfSyncCheckout}), then runs {@link gateMergedCommit} on the result:
 *   - nothing to merge (already up to date / dirty / not on the ref / a fetch or merge failure) → reported,
 *     nothing else happens;
 *   - merged + smoke PASS → adopted, left merged;
 *   - merged + smoke FAIL → `git reset --hard` back to the pre-merge HEAD, and the merged sha is recorded so a
 *     re-run against the SAME broken sha short-circuits instead of re-running the live smoke (same reject-cache
 *     `daemon-self-sync.mjs`'s own gate uses — this CLI does not keep a second one).
 * This is a ONE-SHOT CLI, not a daemon — there is no process to restart. It leaves the clone's checkout in the
 * adopted or rolled-back state and reports which, exiting non-zero only when a merge was attempted and
 * rejected (so a caller scripting this can tell "nothing to do" apart from "rejected").
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selfSyncCheckout, readHeadSha, readOriginRefSha } from './daemon-self-sync.mjs';
import { gateMergedCommit } from './daemon-live-smoke.mjs';
import { gitRun } from './main-staleness.mjs';

/**
 * @param {{clone:string, base?:string, env?:NodeJS.ProcessEnv, log?:Console, sync?:typeof selfSyncCheckout,
 *   gate?:typeof gateMergedCommit, run?:typeof gitRun, readHead?:typeof readHeadSha}} o
 * @returns {Promise<{root:string, mergedAnything:boolean, adopted:boolean, commits?:number, reason:string, smoke?:object}>}
 */
export async function runDaemonLoadOverlay({
  clone, base = 'main', env = process.env, log = console,
  sync = selfSyncCheckout, gate = gateMergedCommit, run = gitRun, readHead = readHeadSha,
}) {
  if (!clone || typeof clone !== 'string') throw new TypeError('daemon-load-overlay: --clone=<path> is required');
  const root = resolve(clone);
  const preMergeSha = readHead({ root, run });
  const r = sync({ root, base, run });
  if (!r.merged) {
    return { root, mergedAnything: false, adopted: false, commits: 0, reason: r.reason };
  }
  const mergedIdentitySha = readOriginRefSha({ root, ref: `origin/${base}`, run });
  const verdict = await gate({ root, preMergeSha, mergedIdentitySha, env, run, log });
  return {
    root, mergedAnything: true, adopted: verdict.adopt, commits: r.commits, reason: verdict.reason, smoke: verdict.smoke,
  };
}

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

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const flags = parseFlags(process.argv.slice(2));
  const clone = typeof flags.clone === 'string' ? flags.clone : null;
  const base = typeof flags.ref === 'string' ? flags.ref : (typeof flags.base === 'string' ? flags.base : 'main');
  runDaemonLoadOverlay({ clone, base })
    .then((result) => {
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!result.mergedAnything) {
        process.stdout.write(`daemon-load-overlay: nothing adopted — ${result.reason} (${result.root})\n`);
      } else if (result.adopted) {
        process.stdout.write(`daemon-load-overlay: ADOPTED ${result.commits} commit(s) from origin/${base} onto ${result.root} (${result.reason})\n`);
      } else {
        process.stdout.write(`daemon-load-overlay: REJECTED (${result.reason}) — rolled back ${result.root} to its pre-merge commit\n`);
        if (result.smoke) {
          for (const check of result.smoke.results) process.stdout.write(`  ${check.ok ? '✓' : '✗'} ${check.name} (${check.ms}ms): ${check.detail}\n`);
        }
      }
      process.exitCode = result.mergedAnything && !result.adopted ? 1 : 0;
    })
    .catch((e) => {
      process.stderr.write(`daemon-load-overlay: fatal: ${String((e && e.message) || e)}\n`);
      process.exitCode = 1;
    });
}
