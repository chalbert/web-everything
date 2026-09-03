/**
 * @file scripts/conveyor/__tests__/session-reaper-cli.test.mjs
 * @description THE REAL CLI ENTRYPOINT, not the fabricated-fixture pure core (PR #1861 review, #3435).
 *
 * WHAT WENT WRONG, AND WHY THE EXISTING 12 CASES DID NOT CATCH IT. `session-reaper.test.mjs` drives
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
 * `claude` is stubbed — a small `sh` script on the child's `PATH` that appends every invocation's argv to a
 * file and answers `agents` calls with a canned listing — so no real `claude agents`/`claude stop` ever runs.
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAPER_CLI = resolve(HERE, '..', 'session-reaper.mjs');
const EXEC_TIMEOUT_MS = 30_000;

let binDir;
let argvFile;

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-bin-'));
  argvFile = join(binDir, 'argv.txt');
  // THE STUB `claude`. `sh` builtins only, on a `PATH` holding nothing else, so the child has no way to reach a
  // real `claude` — no agent is ever stopped and no real listing is ever read. Appends (`>>`, not `>`) because a
  // real pass shells `claude` MORE THAN ONCE (the list, then one `stop` per reaped session) and every call needs
  // to survive to be asserted, in order.
  const stub = join(binDir, 'claude');
  writeFileSync(
    stub,
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$*" >> "$STUB_ARGV_FILE"',
      'case "$1" in',
      '  agents) printf \'%s\' "$STUB_AGENTS" ;;',
      '  stop) exit 0 ;;',
      'esac',
    ].join('\n') + '\n',
  );
  chmodSync(stub, 0o755);
});

afterEach(() => {
  rmSync(binDir, { recursive: true, force: true });
});

/** Run the REAL `session-reaper.mjs` CLI in a child whose `PATH` holds only the stub `claude`. */
function runReaperCli(args = [], { agents = '[]' } = {}) {
  return execFileSync(process.execPath, [REAPER_CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: EXEC_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    env: { HOME: process.env.HOME, PATH: binDir, STUB_AGENTS: agents, STUB_ARGV_FILE: argvFile },
  });
}

describe('the session-reaper CLI lists via `claude agents --json --all` — the argv this PR was bounced over', () => {
  it('passes `--all`, unlike every other `defaultListAgents` caller (dispatch observer, dispatch guard)', () => {
    runReaperCli(['--dry-run', '--json'], { agents: '[]' });
    // The argv the CLI actually handed `claude`, recorded by the stub across a real process boundary — the
    // same proof shape `wake-cli.test.mjs` uses for the INVERSE claim (that its own caller never passes `--all`).
    expect(readFileSync(argvFile, 'utf8').trim()).toBe('agents --json --all');
  }, EXEC_TIMEOUT_MS);

  it('end to end: with `--all`, a DONE session from the real listing is actually planned for reap', () => {
    const agents = JSON.stringify([
      { sessionId: 'done-1', kind: 'background', state: 'done', name: 'conveyor-1' },
      { sessionId: 'live-1', kind: 'background', state: 'working', name: 'conveyor-2' },
    ]);
    const out = runReaperCli(['--dry-run', '--json'], { agents });
    const report = JSON.parse(out);
    // Before the fix, the stub's `agents --json` (no `--all`) branch would still have answered with this same
    // fixture — the defect was never in what the fixture said, only in whether `--all` was ever asked for. This
    // proves the CLI's own request now round-trips into an actual reap decision, not just a bare argv string.
    expect(report.wouldStop.map((r) => r.sessionId)).toEqual(['done-1']);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass actually calls `claude stop` on the reaped session — the step that was never reached', () => {
    const agents = JSON.stringify([{ sessionId: 'done-1', kind: 'background', state: 'done', name: 'conveyor-1' }]);
    runReaperCli([], { agents });
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop done-1']);
  }, EXEC_TIMEOUT_MS);
});
