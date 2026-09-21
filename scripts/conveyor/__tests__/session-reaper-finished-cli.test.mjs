/**
 * @file scripts/conveyor/__tests__/session-reaper-finished-cli.test.mjs
 * @description THE REAL CLI on the finished-but-alive rule (#3721): a background session whose own result file is written is
 *   reaped only when it is at its prompt (`status: idle`) AND its transcript has been quiet past the grace period. Drives the
 *   real `session-reaper.mjs` in a child process with a private HOME (transcripts), a private jobs dir (result files) and the stub
 *   `claude` from the shared harness, so nothing real is listed or stopped. `--dry-run` throughout: the assertion is on what it
 *   WOULD stop.
 */
import { readFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEAD_PID, EXEC_TIMEOUT_MS, argvFile, installReaperCliHarness, runReaperCli } from './helpers/session-reaper-cli-harness.mjs';

installReaperCliHarness();

const MIN = 60000;
const CWD = '/Users/someone/workspace/wev-fixture';
let home;
let jobs;
afterEach(() => { for (const d of [home, jobs]) if (d) rmSync(d, { recursive: true, force: true }); });

/** One live row + its transcript (mtime `quietMin` ago) + its result file (written after the session started). */
function fixture({ name, status = 'idle', state = 'blocked', quietMin, withResult = true, waitingFor }) {
  const startedAt = Date.now() - 180 * MIN;
  const sessionId = `${name}-0000-4000-8000-000000000000`;
  const dir = join(home, '.claude/projects', CWD.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const transcript = join(dir, `${sessionId}.jsonl`);
  writeFileSync(transcript, '{}\n');
  const at = new Date(Date.now() - quietMin * MIN);
  utimesSync(transcript, at, at);
  if (withResult) {
    const result = join(jobs, `${name}.result.md`);
    writeFileSync(result, 'done\n');
    const written = new Date(startedAt + 30 * MIN);
    utimesSync(result, written, written);
  }
  return { id: name.slice(0, 8), sessionId, cwd: CWD, kind: 'background', startedAt, name, state, status, pid: process.pid, ...(waitingFor ? { waitingFor } : {}) };
}

function wouldStop(rows, extraArgs = []) {
  const out = runReaperCli(['--dry-run', '--json', '--no-ground-truth', ...extraArgs], {
    agents: JSON.stringify(rows),
    env: { HOME: home, OPERATION_JOBS_DIR: jobs },
  });
  const report = JSON.parse(out);
  return { names: report.wouldStop.map((r) => r.name), report };
}

function setup() {
  home = mkdtempSync(join(tmpdir(), 'we-3721-home-'));
  jobs = mkdtempSync(join(tmpdir(), 'we-3721-jobs-'));
}

describe('#3721 the real CLI reaps a finished, idle, quiet session and keeps everything else', () => {
  it('finished + idle + quiet 90 min is reaped; mid-turn, fresh, waiting, no-result and interactive rows are kept', () => {
    setup();
    const rows = [
      fixture({ name: 'zz-finished-quiet', quietMin: 90 }),
      fixture({ name: 'zz-finished-fresh', quietMin: 2 }),
      fixture({ name: 'zz-finished-busy', status: 'busy', quietMin: 90 }),
      fixture({ name: 'zz-finished-waiting', status: 'waiting', waitingFor: 'user input', quietMin: 90 }),
      fixture({ name: 'zz-no-result', quietMin: 10, withResult: false }),
      { ...fixture({ name: 'zz-operator-own', quietMin: 90 }), kind: 'interactive' },
    ];
    const { names, report } = wouldStop(rows);
    expect(names).toEqual(['zz-finished-quiet']);
    expect(report.wouldStop[0].reason).toContain('finished-unreaped');
    expect(report.wouldStop[0].reason).toContain('quiet 90 min');
    expect(report.kept).toBe(5);
  }, EXEC_TIMEOUT_MS);

  it('`--grace-minutes` moves the line: a session quiet 20 min is kept by default and reaped with `--grace-minutes=10`; a bad value falls back to the default', () => {
    setup();
    const rows = [fixture({ name: 'zz-finished-20', quietMin: 20 })];
    expect(wouldStop(rows).names).toEqual([]);
    expect(wouldStop(rows, ['--grace-minutes=10']).names).toEqual(['zz-finished-20']);
    expect(wouldStop(rows, ['--grace-minutes=soon']).names).toEqual([]);
    expect(wouldStop(rows, ['--grace-minutes=-5']).names).toEqual([]);
  }, EXEC_TIMEOUT_MS);
});

describe('#3721 a registry-`done` session whose process is still alive is stopped; a `done` row with no process is not', () => {
  const doneRow = (id, pid) => ({ id, sessionId: `${id}-full-uuid`, kind: 'background', state: 'done', status: 'idle', pid, name: `zz-${id}` });

  it('dry run: done+alive is planned for a stop, done+dead is counted already-terminal with no call', () => {
    setup();
    const { names, report } = wouldStop([doneRow('alive1', process.pid), doneRow('dead1', DEAD_PID)]);
    expect(names).toEqual(['zz-alive1']);
    expect(report.alreadyTerminal).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('a real pass stops ONLY the alive one, and reports it confirmed once the re-read row has lost its process', () => {
    setup();
    const rows = [doneRow('alive1', process.pid), doneRow('dead1', DEAD_PID)];
    const after = JSON.stringify([doneRow('alive1', undefined), doneRow('dead1', DEAD_PID)]);
    const out = runReaperCli(['--json', '--no-ground-truth'], { agents: JSON.stringify(rows), env: { HOME: home, OPERATION_JOBS_DIR: jobs, STUB_AGENTS_AFTER_STOP: after } });
    const report = JSON.parse(out);
    expect(readFileSync(argvFile, 'utf8').trim().split('\n')).toEqual(['agents --json --all', 'stop alive1', 'agents --json --all']);
    expect(report).toMatchObject({ confirmed: 1, unconfirmed: 0, alreadyTerminal: 1 });
  }, EXEC_TIMEOUT_MS);

  it('a real pass whose stop leaves the process running reports it UNCONFIRMED, not stopped', () => {
    setup();
    const rows = [doneRow('alive1', process.pid)];
    const out = runReaperCli(['--json', '--no-ground-truth'], { agents: JSON.stringify(rows), env: { HOME: home, OPERATION_JOBS_DIR: jobs } });
    expect(JSON.parse(out)).toMatchObject({ confirmed: 0, unconfirmed: 1, unconfirmedIds: ['alive1'] });
  }, EXEC_TIMEOUT_MS);
});
