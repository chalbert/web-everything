/**
 * @file scripts/conveyor/__tests__/session-reaper-cli.test.mjs
 * @description THE REAL CLI ENTRYPOINT, not the fabricated-fixture pure core (PR #1861 review, #3435).
 *
 * WHAT WENT WRONG, AND WHY THE EXISTING 12 CASES DID NOT CATCH IT. the unit tests (now `session-reap-plan.test.mjs`) drive
 * `classifySessionReap`/`sessionReapPlan` directly on fixtures shaped exactly as `claude agents --json` reports
 * them — it never touches `main()`, the one place that actually calls `defaultListAgents`. The shipped `main()`
 * called `defaultListAgents({ exec: execFileSync })` with no `all` flag, which — per that function's own
 * `dispatch-lane-io.mjs` docblock, `explore-io.mjs`'s own `defaultListAgents`, and this repo's `wake-cli.test.mjs`
 * — means `claude agents --json` WITHOUT `--all`, which excludes every COMPLETED session from the listing
 * entirely. This reaper's whole purpose is to find and `claude stop` `done`/`failed` sessions, so that gap made
 * `sessionReapPlan` compute `reap: []` on essentially every real invocation: `claude stop` was never called, and
 * the exact clutter #3435 exists to fix kept accumulating silently while the item and PR both reported it solved.
 * No fixture-level test could ever see this — the bug was entirely in the one line wiring the IO shell to the
 * shared default, not in the pure classification logic those 12 cases exercise.
 *
 * SO THIS DRIVES THE REAL CLI, in a real child process, mirroring `wake-cli.test.mjs`'s own pinned-argv pattern
 * (its own case for `defaultListAgents`, "reads the live sessions as `claude agents --json`, and NEVER with
 * `--all`" — the OPPOSITE assertion this reaper needs, because the two callers have opposite jobs). Only
 * `claude` (and, below, `gh`) is stubbed — a small `sh` script on the child's `PATH` that appends every
 * invocation's argv to a file and answers canned output — so no real `claude agents`/`claude stop`/`gh pr view`
 * ever runs.
 *
 * (After the module split this file keeps the CLI's own wiring — the `--all` listing, the short-`id` stop handle, the
 * missing-`id` anomaly. The ground-truth and repo-less-PR-name cases are in `session-reap-evidence-cli.test.mjs`; the stop
 * retry and #77683 repair cases are in `session-reap-stop-cli.test.mjs`. All three share `helpers/session-reaper-cli-harness.mjs`.)
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { DEAD_PID, EXEC_TIMEOUT_MS, argvFile, installReaperCliHarness, runReaperCli } from './helpers/session-reaper-cli-harness.mjs';

installReaperCliHarness();

describe('the session-reaper CLI lists via `claude agents --json --all` — the argv this PR was bounced over', () => {
  it('passes `--all`, unlike every other `defaultListAgents` caller (dispatch observer, dispatch guard)', () => {
    runReaperCli(['--dry-run', '--json'], { agents: '[]' });
    // The argv the CLI actually handed `claude`, recorded by the stub across a real process boundary — the
    // same proof shape `wake-cli.test.mjs` uses for the INVERSE claim (that its own caller never passes `--all`).
    expect(readFileSync(argvFile, 'utf8').trim()).toBe('agents --json --all');
  }, EXEC_TIMEOUT_MS);

  it('end to end: with `--all`, a dead LIVE session is planned for a stop and a DONE one is counted already-terminal (#3744)', () => {
    const agents = JSON.stringify([
      { id: 'done1', sessionId: 'done-1-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' },
      { id: 'dead1', sessionId: 'dead-1-full-uuid', kind: 'background', state: 'working', pid: DEAD_PID, name: 'conveyor-3' },
      { id: 'live1', sessionId: 'live-1-full-uuid', kind: 'background', state: 'working', name: 'conveyor-2' },
    ]);
    const out = runReaperCli(['--dry-run', '--json'], { agents });
    const report = JSON.parse(out);
    // Before the #3435 fix, the stub's `agents --json` (no `--all`) branch would still have answered with this same
    // fixture — the defect was never in what the fixture said, only in whether `--all` was ever asked for. This
    // proves the CLI's own request round-trips into an actual reap decision, not just a bare argv string. Since #3744 the
    // finished (`done`) row is planned but needs no stop call: it is counted, not listed under `wouldStop`.
    expect(report.wouldStop.map((r) => r.id)).toEqual(['dead1']);
    expect(report.alreadyTerminal).toBe(1);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass actually calls `claude stop <id>` (the SHORT form) on the reaped session', () => {
    // `id` and `sessionId` deliberately differ here — the only way a pinned-argv assertion can prove which one
    // the CLI actually shells out with, rather than a coincidence of both fixture values being equal (WE #3435
    // wrong-field bug: the shipped code passed `sessionId`, the full UUID `claude stop` does not match on).
    const agents = JSON.stringify([{ id: 'dead1', sessionId: 'dead-1-full-uuid', kind: 'background', state: 'working', pid: DEAD_PID, name: 'conveyor-1' }]);
    // The registry catches up after the stop (`STUB_AGENTS_AFTER_STOP`), so the confirming re-read is the second `agents` call.
    runReaperCli([], { agents, env: { STUB_AGENTS_AFTER_STOP: '[]' } });
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop dead1', 'agents --json --all']);
  }, EXEC_TIMEOUT_MS);

  it('a reap candidate missing `id` is never passed to `claude stop` — logged as an anomaly, not a silent skip or a bad call', () => {
    // Structurally this should never happen (every `kind: background` row measured, live and fixture, carries
    // an `id` — only `kind: interactive` rows lack one, and those never reach `reap` at all, see the
    // `kind !== 'background'` guard). Fabricated here anyway to prove the guard holds if that invariant ever
    // breaks, rather than crashing or silently dropping the row.
    const agents = JSON.stringify([{ sessionId: 'no-id-full-uuid', kind: 'background', state: 'working', pid: DEAD_PID, name: 'conveyor-1' }]);
    let stderr = '';
    let status = 0;
    try {
      runReaperCli(['--json'], { agents });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
    }
    // No `claude stop` call was ever made — only the initial listing read (no stop ⇒ nothing to confirm ⇒ no re-read).
    expect(readFileSync(argvFile, 'utf8').trim()).toBe('agents --json --all');
    expect(stderr).toMatch(/missing `id`/);
    expect(stderr).toMatch(/anomaly/);
    // Non-zero exit — an anomaly is surfaced, never swallowed.
    expect(status).toBe(1);
  }, EXEC_TIMEOUT_MS);
});
