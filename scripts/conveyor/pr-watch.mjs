#!/usr/bin/env node
/**
 * @file scripts/conveyor/pr-watch.mjs
 * @description The CONVEYOR MERGE WATCHER (WE #2608, epic #2612). A throwaway background process, ONE per
 *   in-flight PR: it polls `gh pr view <N> --json state,mergedAt,labels` on a fixed interval and EXITS the
 *   instant the PR reaches a terminal-for-the-conveyor state — MERGED (the resident drain daemon landed it) or
 *   PARKED (an escalation the main session must handle). The process EXIT is the wake signal: the conveyor
 *   skill (#2613) spawns this in the background, so its exit rides the task-notification wake path and the main
 *   session is woken INSTANTLY — no in-session polling, no push seam — and re-dispatches into the freed lane
 *   the same turn. The exit CODE tells the skill which happened (merged vs parked vs timeout).
 *
 * Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): the
 * state→decision rule is script-decidable (a gh PR json → one of three verdicts), so it lives here as a PURE,
 * unit-tested function — never a policy the conveyor skill re-derives in prose each tick.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors the sibling readiness scripts, e.g. conveyor-state.mjs #2611):
 *   • The PURE core ({@link classifyPr}) has NO gh / child_process / clock — it takes an ALREADY-PARSED gh PR
 *     object and returns `'merged' | 'parked' | 'pending'`. It is unit-tested directly against fixtures
 *     (scripts/conveyor/__tests__/pr-watch.test.mjs) with zero network / gh.
 *   • The IO SHELL (the `main()` CLI, gated on the main-module check) owns the `gh` poll, the interval sleep,
 *     the wall-clock deadline, and the exit code. It calls the pure core on each poll and maps its verdict to
 *     the exit contract below.
 *
 * THE EXIT CONTRACT (the conveyor skill reads process.exitCode as the outcome — keep these stable):
 *   • {@link EXIT_MERGED} (0)   — the PR MERGED. The lane it was on is now free; the skill re-dispatches into it.
 *   • {@link EXIT_PARKED} (2)   — the PR PARKED: it carries `review:human` / `review:pending`, OR it was CLOSED
 *                                 without merging (an anomaly). Terminal for the watcher — the main session must
 *                                 handle it (run /review on a parked PR; investigate an anomalous close).
 *   • {@link EXIT_TIMEOUT} (3)  — the wall-clock deadline elapsed while the PR was still PENDING (never reached
 *                                 a terminal state). The skill re-arms a watcher or investigates a stuck lane.
 *   • {@link EXIT_ERROR} (1)    — bad arguments (no PR number). A per-poll `gh` failure is NOT this: it is logged
 *                                 and retried until the deadline (a transient gh hiccup must not kill the watch),
 *                                 so a permanently-unreadable PR surfaces as EXIT_TIMEOUT, not a crash.
 *
 * UPGRADE SEAM (#2605 — a CONSUMER upgrade, not a blocker). The gh-poll loop in {@link watchPr} is deliberately
 * isolated behind the injected `pollOnce`, so once #2605 lands the daemon's nudge/SSE push seam this internal
 * poller can be swapped for a single blocking call to `plateau:tools/drain-daemon/cli.mjs watch --pr <N>` —
 * WITHOUT changing the pure {@link classifyPr} verdicts or the exit contract above. The daemon's blocking watch
 * would replace the poll+sleep only; this file stays the stable interface the conveyor skill spawns. See the
 * marked seam in {@link watchPr}.
 */

// ── PURE CORE (no gh / child_process / clock — the gh PR object is passed IN) ─────────────────────────────────

/** The review labels that mark a PR as PARKED for human review (the drain daemon applies these on escalation). */
export const PARK_LABELS = Object.freeze(['review:human', 'review:pending']);

/** The exit-code contract (see the file header). Exported so a test / the conveyor skill can reference them by
 *  name rather than a magic number. */
export const EXIT_MERGED = 0;
export const EXIT_PARKED = 2;
export const EXIT_TIMEOUT = 3;
export const EXIT_ERROR = 1;

/** Normalize a gh `labels` array to a plain lowercased name list. gh emits `[{name}]`; tolerate a bare-string
 *  array too (mirrors conveyor-state.mjs `shapePrs`). */
function labelNames(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter(Boolean)
    .map((n) => String(n).toLowerCase());
}

/**
 * The DETERMINISTIC watcher verdict — the pure keystone. Same gh PR json → same verdict, always.
 *
 * Precedence (terminal states win over pending; MERGED wins over a stray park label):
 *   1. MERGED  — `state === 'MERGED'` OR `mergedAt` is set. The drain landed it; the lane is free.
 *   2. PARKED  — an OPEN PR carrying a park label (`review:human` / `review:pending`), OR a CLOSED-unmerged PR.
 *                Both are terminal for the watcher and need the main session: a review to clear, or an
 *                anomalous close to investigate. (The verdict vocabulary is three-valued, so a closed-unmerged
 *                PR maps to `parked` — the "stop and wake the session, it did NOT merge" outcome — never
 *                `pending`, which would poll a terminally-closed PR forever.)
 *   3. PENDING — none of the above: an open PR still in flight (green-and-queued, CI running, or a plain open
 *                PR the drain hasn't reached). Keep polling.
 *
 * @param {{state?:string, mergedAt?:string|null, labels?:Array<{name?:string}|string>}|null|undefined} pr
 *   the parsed `gh pr view --json state,mergedAt,labels` object.
 * @returns {'merged'|'parked'|'pending'}
 */
export function classifyPr(pr) {
  if (!pr || typeof pr !== 'object') return 'pending'; // no data parsed yet → keep waiting (never a false exit)
  const state = String(pr.state || '').toUpperCase();
  if (state === 'MERGED' || pr.mergedAt) return 'merged';
  const labels = labelNames(pr.labels);
  if (labels.some((l) => PARK_LABELS.includes(l))) return 'parked';
  if (state === 'CLOSED') return 'parked'; // closed WITHOUT merging — terminal, wake the session
  return 'pending';
}

/** Map a pure verdict to its exit code. `'pending'` has no exit code (the loop keeps going) → null. */
export function exitCodeForVerdict(verdict) {
  if (verdict === 'merged') return EXIT_MERGED;
  if (verdict === 'parked') return EXIT_PARKED;
  return null;
}

// ── IO SHELL (runs only as a CLI — owns gh / the interval sleep / the wall-clock deadline / the exit) ─────────

/**
 * The watch loop: poll → classify → exit-on-terminal → sleep → repeat, until the deadline. The gh poll and the
 * sleep are INJECTED (`pollOnce`, `sleep`, `now`) so the loop is drivable in isolation and the poller can later
 * be swapped for the #2605 daemon watch (see the file-header UPGRADE SEAM) without touching this control flow.
 *
 * @param {{
 *   pollOnce: () => Promise<object|null>,     // one `gh pr view` read → parsed PR object (or null on a gh hiccup)
 *   sleep: (ms:number) => Promise<void>,      // interval wait
 *   now: () => number,                         // clock (epoch ms) — injected for determinism
 *   intervalMs: number, deadlineMs: number,   // poll cadence + wall-clock budget
 *   log?: (m:string) => void,                  // stderr progress line (optional)
 * }} io
 * @returns {Promise<number>} the resolved EXIT_* code (merged / parked / timeout).
 */
export async function watchPr({ pollOnce, sleep, now, intervalMs, deadlineMs, log = () => {} }) {
  const start = now();
  for (;;) {
    // ── UPGRADE SEAM (#2605): this single `pollOnce()` is the ONLY gh touch in the loop. Swap it for a blocking
    //    `drain-daemon/cli.mjs watch --pr N` call (same parsed-PR return) and the classify/exit contract below
    //    is unchanged — the daemon push replaces the poll+sleep, nothing else. ─────────────────────────────────
    let pr = null;
    try {
      pr = await pollOnce();
    } catch (e) {
      // A transient gh failure must NOT kill the watch — log and let the deadline (below) bound it.
      log(`  ⚠ gh poll failed (retrying): ${String(e?.message || e).split('\n')[0]}`);
    }
    const verdict = classifyPr(pr);
    const code = exitCodeForVerdict(verdict);
    if (code !== null) {
      log(`  ● PR ${verdict} → exit ${code}`);
      return code;
    }
    if (now() - start >= deadlineMs) {
      log(`  ⏱ deadline reached while still pending → exit ${EXIT_TIMEOUT}`);
      return EXIT_TIMEOUT;
    }
    await sleep(intervalMs);
  }
}

async function main(argv) {
  const { execFileSync } = await import('node:child_process');

  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  const log = (m) => process.stderr.write(m + '\n');

  const prNumber = positionals[0] ?? flags.pr;
  if (prNumber == null || !/^\d+$/.test(String(prNumber))) {
    log('usage: pr-watch.mjs <pr-number> [--interval=20] [--timeout-min=30] [--repo=owner/name] [--json]');
    process.exit(EXIT_ERROR);
  }

  const intervalMs = Math.max(1, Number(flags.interval) || 20) * 1000; // default 20s poll cadence
  const deadlineMs = Math.max(1, Number(flags['timeout-min']) || 30) * 60_000; // default 30min wall-clock budget

  // ONE gh poll → the parsed PR object (or null on any gh failure, so watchPr's retry-until-deadline applies).
  const pollOnce = async () => {
    const args = ['pr', 'view', String(prNumber), '--json', 'state,mergedAt,labels'];
    if (typeof flags.repo === 'string') args.push('--repo', flags.repo);
    const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  log(`watching PR #${prNumber} (poll ${intervalMs / 1000}s · deadline ${deadlineMs / 60_000}min) …`);
  const code = await watchPr({ pollOnce, sleep, now: Date.now, intervalMs, deadlineMs, log });

  if (flags.json) {
    const outcome = code === EXIT_MERGED ? 'merged' : code === EXIT_PARKED ? 'parked' : 'timeout';
    process.stdout.write(JSON.stringify({ pr: Number(prNumber), outcome, exit: code }, null, 2) + '\n');
  }
  process.exit(code);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
