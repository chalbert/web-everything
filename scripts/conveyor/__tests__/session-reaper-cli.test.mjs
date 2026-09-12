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
 * `claude` (and, below, `gh`) is stubbed — a small `sh` script on the child's `PATH` that appends every
 * invocation's argv to a file and answers canned output — so no real `claude agents`/`claude stop`/`gh pr view`
 * ever runs.
 *
 * THE GROUND-TRUTH AXIS (found live 2026-09-03, `conveyor-3451`) gets the SAME real-CLI treatment, for the
 * identical reason: `sessionReapPlan`'s own fixture-level tests inject a `groundTruthFor` stub directly and
 * never touch `main()`'s wiring of `makeGroundTruthResolver` to `execFileSync`/`WE_BACKLOG_DIR` — exactly the
 * class of gap the original `session-reaper-cli.test.mjs` was written to close for the base axis. A `gh` stub
 * plus a real temp `WE_BACKLOG_DIR` prove the wiring end to end, not just the pure classification.
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
let ghArgvFile;

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-bin-'));
  argvFile = join(binDir, 'argv.txt');
  ghArgvFile = join(binDir, 'gh-argv.txt');
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
      // `stop` optionally fails its first `STUB_STOP_FAIL_TIMES` invocations PER id (a per-id counter file
      // under `STUB_STOP_COUNT_DIR`, default unset ⇒ 0 ⇒ succeeds immediately, byte-identical to the old
      // unconditional `exit 0`) — proves `stopSessionWithRetry` (WE #3479, found live 2026-09-04) actually
      // retries through the REAL CLI, not just against a fixture-injected fake `exec`.
      '  stop)',
      '    id="$2"',
      '    cnt_file="$STUB_STOP_COUNT_DIR/stopcount-$id"',
      // A shell BUILTIN (`read`), never an external `cat` — the stub's `PATH` deliberately holds nothing but
      // itself (see the header above), so any external command here would silently break the same way `cat`
      // first did (found running this stub for real, not guessed: "cat: command not found").
      '    n=0',
      '    if [ -f "$cnt_file" ]; then read n < "$cnt_file"; fi',
      '    n=$((n + 1))',
      '    echo "$n" > "$cnt_file"',
      '    if [ "$n" -le "${STUB_STOP_FAIL_TIMES:-0}" ]; then',
      '      echo "stub: transient claude-stop failure, attempt $n" >&2',
      '      exit 7',
      '    fi',
      '    exit 0 ;;',
      'esac',
    ].join('\n') + '\n',
  );
  chmodSync(stub, 0o755);
  // THE STUB `gh` — a separate argv file (kept apart from `claude`'s so the base-axis assertions below stay
  // byte-identical) and a canned `pr view` answer, keyed by PR number via `STUB_GH_PR_<num>` so one test can
  // stand up several distinct PR ground-truth answers at once without a real network call.
  const ghStub = join(binDir, 'gh');
  writeFileSync(
    ghStub,
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$*" >> "$STUB_GH_ARGV_FILE"',
      'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
      '  eval "ans=\\$STUB_GH_PR_$3"',
      // A literal `{}` inside a `${var:-word}` default confuses `sh`'s own brace matching (found running this
      // stub for real, not guessed) — an explicit if/else avoids nesting `{}` inside the expansion syntax.
      '  if [ -n "$ans" ]; then printf \'%s\' "$ans"; else printf \'{}\'; fi',
      'fi',
    ].join('\n') + '\n',
  );
  chmodSync(ghStub, 0o755);
});

afterEach(() => {
  rmSync(binDir, { recursive: true, force: true });
});

/** Run the REAL `session-reaper.mjs` CLI in a child whose `PATH` holds only the stub `claude`/`gh`. */
function runReaperCli(args = [], { agents = '[]', env = {} } = {}) {
  return execFileSync(process.execPath, [REAPER_CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: EXEC_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    env: {
      HOME: process.env.HOME,
      PATH: binDir,
      STUB_AGENTS: agents,
      STUB_ARGV_FILE: argvFile,
      STUB_GH_ARGV_FILE: ghArgvFile,
      STUB_STOP_COUNT_DIR: binDir,
      ...env,
    },
  });
}

/** A throwaway backlog dir holding exactly the item cards a test needs, for `WE_BACKLOG_DIR`. */
function makeBacklogDir(items) {
  const dir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-backlog-'));
  for (const [id, status] of Object.entries(items)) {
    writeFileSync(join(dir, `${id}-fixture-item.md`), `---\nstatus: ${status}\n---\n# Fixture ${id}\n`);
  }
  return dir;
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
      { id: 'done1', sessionId: 'done-1-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' },
      { id: 'live1', sessionId: 'live-1-full-uuid', kind: 'background', state: 'working', name: 'conveyor-2' },
    ]);
    const out = runReaperCli(['--dry-run', '--json'], { agents });
    const report = JSON.parse(out);
    // Before the fix, the stub's `agents --json` (no `--all`) branch would still have answered with this same
    // fixture — the defect was never in what the fixture said, only in whether `--all` was ever asked for. This
    // proves the CLI's own request now round-trips into an actual reap decision, not just a bare argv string.
    expect(report.wouldStop.map((r) => r.id)).toEqual(['done1']);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass actually calls `claude stop <id>` (the SHORT form) on the reaped session', () => {
    // `id` and `sessionId` deliberately differ here — the only way a pinned-argv assertion can prove which one
    // the CLI actually shells out with, rather than a coincidence of both fixture values being equal (WE #3435
    // wrong-field bug: the shipped code passed `sessionId`, the full UUID `claude stop` does not match on).
    const agents = JSON.stringify([{ id: 'done1', sessionId: 'done-1-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' }]);
    runReaperCli([], { agents });
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop done1']);
  }, EXEC_TIMEOUT_MS);

  it('a reap candidate missing `id` is never passed to `claude stop` — logged as an anomaly, not a silent skip or a bad call', () => {
    // Structurally this should never happen (every `kind: background` row measured, live and fixture, carries
    // an `id` — only `kind: interactive` rows lack one, and those never reach `reap` at all, see the
    // `kind !== 'background'` guard). Fabricated here anyway to prove the guard holds if that invariant ever
    // breaks, rather than crashing or silently dropping the row.
    const agents = JSON.stringify([{ sessionId: 'no-id-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' }]);
    let stderr = '';
    let status = 0;
    try {
      runReaperCli(['--json'], { agents });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
    }
    // No `claude stop` call was ever made — only the initial listing read.
    expect(readFileSync(argvFile, 'utf8').trim()).toBe('agents --json --all');
    expect(stderr).toMatch(/missing `id`/);
    expect(stderr).toMatch(/anomaly/);
    // Non-zero exit — an anomaly is surfaced, never swallowed.
    expect(status).toBe(1);
  }, EXEC_TIMEOUT_MS);
});

describe('the stop loop retries a transient `claude stop` failure — WE #3479, found live 2026-09-04', () => {
  it('recovers within the retry budget: 2 transient failures then success ⇒ clean pass, 3 real `stop` calls', () => {
    const agents = JSON.stringify([{ id: 'flaky01', sessionId: 'flaky-01-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' }]);
    const out = runReaperCli(['--json'], { agents, env: { STUB_STOP_FAIL_TIMES: '2' } });
    const report = JSON.parse(out);
    // Recovered — counts as a real stop, no failure at all, despite two underlying `claude stop` errors.
    expect(report.stopped).toBe(1);
    expect(report.failures).toBe(0);
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop flaky01', 'stop flaky01', 'stop flaky01']);
  }, EXEC_TIMEOUT_MS);

  it('a failure that never clears is still a real failure after exhausting the retry budget — bounded, not silent', () => {
    const agents = JSON.stringify([{ id: 'stuck01', sessionId: 'stuck-01-full-uuid', kind: 'background', state: 'done', name: 'conveyor-2' }]);
    let stderr = '';
    let status = 0;
    try {
      runReaperCli(['--json'], { agents, env: { STUB_STOP_FAIL_TIMES: '99' } });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
    }
    expect(status).toBe(1);
    expect(stderr).toMatch(/stop failed after 3 attempts/);
    // Exactly 3 attempts — the retry budget bounds it, it never spins forever on a truly stuck candidate.
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop stuck01', 'stop stuck01', 'stop stuck01']);
  }, EXEC_TIMEOUT_MS);
});

describe('the ground-truth axis, end to end through the real CLI wiring — the conveyor-3451 shape', () => {
  let backlogDir;
  afterEach(() => {
    if (backlogDir) rmSync(backlogDir, { recursive: true, force: true });
    backlogDir = undefined;
  });

  it('a `blocked` session whose target item is `status: resolved` is planned for reap — reproduces conveyor-3451 live', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    const out = runReaperCli(['--dry-run', '--json'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', name: 'conveyor-3451', reason: 'ground-truth-item:backlog#3451:resolved' }]);
    expect(report.kept).toBe(0);
  }, EXEC_TIMEOUT_MS);

  it('a `working` session whose target item is still `status: active` is kept — the genuinely-still-open shape', () => {
    backlogDir = makeBacklogDir({ 2786: 'active' });
    const agents = JSON.stringify([{ id: 'working1', sessionId: 'working-1-full-uuid', kind: 'background', state: 'working', name: 'conveyor-2786' }]);
    const out = runReaperCli(['--dry-run', '--json'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a `working` review-<PR> session whose PR is merged (via the stubbed `gh pr view`) is planned for reap', () => {
    backlogDir = makeBacklogDir({}); // no item cards needed — this target is PR-kind
    const agents = JSON.stringify([{ id: 'review1', sessionId: 'review-1-full-uuid', kind: 'background', state: 'working', name: 'review-1862' }]);
    const out = runReaperCli(['--dry-run', '--json'], {
      agents,
      env: { WE_BACKLOG_DIR: backlogDir, STUB_GH_PR_1862: JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-03T11:57:41Z' }) },
    });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([{ id: 'review1', sessionId: 'review-1-full-uuid', name: 'review-1862', reason: 'ground-truth-pr:pr#1862:merged' }]);
    // `gh pr view 1862 --json state,mergedAt` was the ONE real gh call this pass made — the review-1871 shape
    // (an unrelated open PR) never happens to be in this listing, so there is nothing else to bound here.
    expect(readFileSync(ghArgvFile, 'utf8').trim()).toBe('pr view 1862 --json state,mergedAt');
  }, EXEC_TIMEOUT_MS);

  it('a `working` review-<PR> session whose PR is still open (the review-1871 shape) is kept, not reaped', () => {
    backlogDir = makeBacklogDir({});
    const agents = JSON.stringify([{ id: 'review2', sessionId: 'review-2-full-uuid', kind: 'background', state: 'working', name: 'review-1871' }]);
    const out = runReaperCli(['--dry-run', '--json'], {
      agents,
      env: { WE_BACKLOG_DIR: backlogDir, STUB_GH_PR_1871: JSON.stringify({ state: 'OPEN', mergedAt: null }) },
    });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('`--no-ground-truth` disables the axis entirely — the rollback escape hatch, even for a resolved target', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    const out = runReaperCli(['--dry-run', '--json', '--no-ground-truth'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass ground-truth-reaps AND actually calls `claude stop <id>` (the SHORT form)', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    runReaperCli([], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop blocked1']);
  }, EXEC_TIMEOUT_MS);
});

describe('the ground-truth axis, end to end through the real CLI wiring — the conveyor-3451 shape', () => {
  let backlogDir;
  afterEach(() => {
    if (backlogDir) rmSync(backlogDir, { recursive: true, force: true });
    backlogDir = undefined;
  });

  it('a `blocked` session whose target item is `status: resolved` is planned for reap — reproduces conveyor-3451 live', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    const out = runReaperCli(['--dry-run', '--json'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', name: 'conveyor-3451', reason: 'ground-truth-item:backlog#3451:resolved' }]);
    expect(report.kept).toBe(0);
  }, EXEC_TIMEOUT_MS);

  it('a `working` session whose target item is still `status: active` is kept — the genuinely-still-open shape', () => {
    backlogDir = makeBacklogDir({ 2786: 'active' });
    const agents = JSON.stringify([{ id: 'working1', sessionId: 'working-1-full-uuid', kind: 'background', state: 'working', name: 'conveyor-2786' }]);
    const out = runReaperCli(['--dry-run', '--json'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a `working` review-<PR> session whose PR is merged (via the stubbed `gh pr view`) is planned for reap', () => {
    backlogDir = makeBacklogDir({}); // no item cards needed — this target is PR-kind
    const agents = JSON.stringify([{ id: 'review1', sessionId: 'review-1-full-uuid', kind: 'background', state: 'working', name: 'review-1862' }]);
    const out = runReaperCli(['--dry-run', '--json'], {
      agents,
      env: { WE_BACKLOG_DIR: backlogDir, STUB_GH_PR_1862: JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-03T11:57:41Z' }) },
    });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([{ id: 'review1', sessionId: 'review-1-full-uuid', name: 'review-1862', reason: 'ground-truth-pr:pr#1862:merged' }]);
    // `gh pr view 1862 --json state,mergedAt` was the ONE real gh call this pass made — the review-1871 shape
    // (an unrelated open PR) never happens to be in this listing, so there is nothing else to bound here.
    expect(readFileSync(ghArgvFile, 'utf8').trim()).toBe('pr view 1862 --json state,mergedAt');
  }, EXEC_TIMEOUT_MS);

  it('a `working` review-<PR> session whose PR is still open (the review-1871 shape) is kept, not reaped', () => {
    backlogDir = makeBacklogDir({});
    const agents = JSON.stringify([{ id: 'review2', sessionId: 'review-2-full-uuid', kind: 'background', state: 'working', name: 'review-1871' }]);
    const out = runReaperCli(['--dry-run', '--json'], {
      agents,
      env: { WE_BACKLOG_DIR: backlogDir, STUB_GH_PR_1871: JSON.stringify({ state: 'OPEN', mergedAt: null }) },
    });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('`--no-ground-truth` disables the axis entirely — the rollback escape hatch, even for a resolved target', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    const out = runReaperCli(['--dry-run', '--json', '--no-ground-truth'], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const report = JSON.parse(out);
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass ground-truth-reaps AND actually calls `claude stop <id>` (the SHORT form)', () => {
    backlogDir = makeBacklogDir({ 3451: 'resolved' });
    const agents = JSON.stringify([{ id: 'blocked1', sessionId: 'blocked-1-full-uuid', kind: 'background', state: 'blocked', name: 'conveyor-3451' }]);
    runReaperCli([], { agents, env: { WE_BACKLOG_DIR: backlogDir } });
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop blocked1']);
  }, EXEC_TIMEOUT_MS);
});
