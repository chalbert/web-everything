#!/usr/bin/env node
/**
 * @file scripts/conveyor/session-reaper.mjs
 * @description THE CONVEYOR SESSION REAPER (WE #3435, epic #3383). Walks `claude agents --json` and calls
 *   `claude stop <id>` on every BACKGROUND session that CLAUDE ITSELF already reports as terminal — nothing
 *   did this before: `lease-reaper.mjs` (#2667) reclaims LANE leases, a wholly separate resource from a
 *   `claude agents` session registration. Left undone, every review/fix/build dispatch this epic's own
 *   mechanism runs adds one more entry that stays listed until a human runs `claude stop <id>` by hand — 12
 *   finished `review-*` sessions plus 4 stale `conveyor-*` ones in one live-fire night alone.
 *
 * MIRRORS `lease-reaper.mjs`'S PURE-CORE / IO-SHELL SPLIT:
 *   • The PURE core ({@link classifySessionReap}, {@link sessionReapPlan}) has NO fs / exec / clock — every
 *     session row is passed in exactly as `claude agents --json` shapes it. Unit-tested directly on fixtures.
 *   • The IO SHELL (the `main()` CLI) owns the one `claude agents --json` read and delegates the actual stop
 *     to `dispatch-abort.mjs`'s `stopSession` — the ONE existing `claude stop <id>` wrapper in this repo
 *     (built for #3383's own "don't `kill`, `claude stop`" lesson) — rather than re-shelling `claude` a
 *     second way.
 *
 * WHY STATE ALONE, NO GROUND-TRUTH CROSS-CHECK (measured live 2026-09-03, see below). The reap axis here is
 * deliberately narrower than `lease-reaper.mjs`'s PR/TTL axes: it acts ONLY on a state `claude agents` itself
 * reports as terminal for THIS session's own process (`done`, `failed`) — never on an inference about the
 * ITEM the session was working (merged PR, resolved backlog status). The found-live notes on WE #3435 name
 * four failure patterns from `working`/`blocked` LAGGING or MISLABELLING a session's true liveness — never a
 * `done`/`failed` FALSE POSITIVE (a session `claude` itself reports finished but that was still actually
 * running). So the two states this reaper acts on are exactly the ones with no observed failure mode; adding
 * a cross-check for the two it does NOT act on (`working`, `blocked`) would be solving the wrong half of the
 * problem — the *never touch a live one* guarantee already holds by construction, not by inference, because
 * this reaper simply never calls `classifySessionReap` reap:true on anything but `done`/`failed`.
 *
 * THE THREE TERMINAL STATES, measured live against a real `claude agents --json --all` listing (192 rows,
 * 2026-09-03) rather than assumed: `done` (134), `stopped` (31), `failed` (1) — `working` (21) is the only
 * non-terminal state this environment's own dispatches produced that day; `blocked` is the fixture's own
 * shape (`__fixtures__/claude-agents-payload.json`). `stopped` needs NO action (the session is already
 * stopped — re-stopping it is a wasted subprocess call, not a correctness issue, since {@link stopSession}
 * treats an already-gone handle as benign; still worth naming so `keep`'s reason distinguishes it from a
 * live one). `done` and `failed` are the two ({@link TERMINAL_REAP_STATES}) this reaper acts on.
 *
 * `kind !== 'background'` IS AN ABSOLUTE GUARD, CHECKED BEFORE STATE. The SAME listing that carries every
 * dispatched agent also carries the operator's own INTERACTIVE terminal sessions (`kind: 'interactive'`,
 * `pid` set, no `state` field at all — measured live, 5 of 192 rows). An interactive row never has a `state`
 * of `done`/`failed` today, but nothing in the CLI's contract promises that stays true, and the blast radius
 * of `claude stop`-ing a human's own open terminal session is categorically worse than leaving a finished
 * background dispatch listed one tick longer — so this is checked structurally, not left to depend on state
 * never colliding.
 *
 * `claude stop`'S REPORTED SUCCESS IS A HINT, NOT A CERTAINTY (found live 2026-09-02, confirmed against
 * upstream `anthropics/claude-code` issues #65925/#45250/#41461): a stop can report success while the local
 * listing keeps reporting the session unchanged. This reaper does not re-poll to confirm — that would add a
 * second `claude agents --json` read (and a race) for a confirmation this repo already knows is unreliable —
 * it logs {@link stopSession}'s own `alreadyGone` distinction and moves on, exactly as best-effort as
 * `lease-reaper.mjs`'s own per-candidate try/catch.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { stopSession } from '../operations/dispatch-abort.mjs';
import { defaultListAgents, normalizeHandle } from '../operations/dispatch-lane-io.mjs';

// ── PURE CORE (no fs / exec / clock — every signal is injected) ────────────────────────────────────────────

/** States `claude agents` reports for a session's OWN process that mean "stop it — it is done producing more
 *  work" (see the file header for the live count that grounds this pair). */
export const TERMINAL_REAP_STATES = new Set(['done', 'failed']);

/** States that mean the session is already stopped — nothing to do, kept apart from `not-terminal` so a
 *  caller can tell "already handled" from "still live, leave it alone". */
export const ALREADY_STOPPED_STATES = new Set(['stopped']);

/**
 * The DETERMINISTIC reap verdict for ONE `claude agents --json` row — pure, same row → same verdict.
 *
 * @param {object|null} session - one element of a `claude agents --json` listing.
 * @returns {{reap:boolean, reason:('done'|'failed'|'already-stopped'|'not-background'|'not-terminal')}}
 */
export function classifySessionReap(session) {
  if (!session || typeof session !== 'object') return { reap: false, reason: 'not-terminal' };
  // Structural guard FIRST — see the file header on why this can never be state-dependent.
  if (session.kind !== 'background') return { reap: false, reason: 'not-background' };
  const state = session.state;
  if (TERMINAL_REAP_STATES.has(state)) return { reap: true, reason: state };
  if (ALREADY_STOPPED_STATES.has(state)) return { reap: false, reason: 'already-stopped' };
  return { reap: false, reason: 'not-terminal' }; // working / blocked / undefined — never touched
}

/**
 * Map {@link classifySessionReap} over a full `claude agents --json` listing.
 * @param {unknown[]} sessions
 * @returns {{reap:Array, keep:Array}} each entry carries the original row plus its `reason`.
 */
export function sessionReapPlan(sessions) {
  const reap = [];
  const keep = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const verdict = classifySessionReap(session);
    const row = { session, reason: verdict.reason };
    (verdict.reap ? reap : keep).push(row);
  }
  return { reap, keep };
}

// ── IO SHELL (runs only as a CLI — owns the one `claude agents --json` read + the stop delegation) ─────────

const log = (m) => process.stderr.write(m + '\n');

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

function main(argv) {
  const flags = parseFlags(argv);
  const dryRun = !!flags['dry-run'];

  let sessions;
  try {
    sessions = defaultListAgents({ exec: execFileSync });
  } catch (e) {
    // Best-effort like every other mechanical pass (Done-when #3): an unreadable listing means there is
    // nothing safe to act on this tick, not a hard failure — the next tick tries again.
    log(`  ⚠ \`claude agents --json\` unreadable — session-reaper skipping this tick: ${String(e?.message || e).split('\n')[0]}`);
    process.exit(0);
  }
  if (!Array.isArray(sessions)) sessions = [];

  const { reap, keep } = sessionReapPlan(sessions);

  let stopped = 0;
  let alreadyGone = 0;
  let failures = 0;
  const done = [];
  for (const { session, reason } of reap) {
    const handle = normalizeHandle(session.sessionId);
    if (!handle) continue; // no usable id — nothing this pass can act on
    if (dryRun) {
      log(`  would stop ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      continue;
    }
    try {
      const res = stopSession({ handle, exec: execFileSync });
      if (res.alreadyGone) alreadyGone++;
      else stopped++;
      log(`  ${res.alreadyGone ? 'already gone' : 'stopped'} ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      done.push({ sessionId: handle, name: session.name ?? null, reason, alreadyGone: res.alreadyGone });
    } catch (e) {
      // ONE session's stop failing never blocks the rest of the pass (Done-when #3) — the same
      // "couldn't confirm, background service may be restarting" flakiness lease-reaper.mjs already treats
      // as per-candidate, not pass-fatal.
      log(`  ⚠ ${handle}: stop failed (${String(e?.message || e).split('\n')[0]}) — left for the next tick`);
      failures++;
    }
  }

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: sessions.length,
          stopped: dryRun ? 0 : stopped,
          alreadyGone: dryRun ? 0 : alreadyGone,
          failures: dryRun ? 0 : failures,
          wouldStop: dryRun ? reap.map((r) => ({ sessionId: normalizeHandle(r.session.sessionId), name: r.session.name ?? null, reason: r.reason })) : undefined,
          collected: dryRun ? undefined : done,
          kept: keep.length,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    log(
      `session-reaper: ${sessions.length} session(s) listed · ` +
        `${dryRun ? `${reap.length} would stop` : `${stopped} stopped${alreadyGone ? `, ${alreadyGone} already gone` : ''}${failures ? `, ${failures} failed` : ''}`} · ${keep.length} kept`,
    );
  }
  // Non-zero exit only when a stop we ATTEMPTED actually failed — mirrors lease-reaper.mjs's own convention,
  // so a cron/loop wrapper can tell a clean sweep from a partial one. `runQuiet` (the runner's own caller)
  // swallows this either way — it is surfaced for anyone invoking the CLI directly.
  process.exit(failures > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
