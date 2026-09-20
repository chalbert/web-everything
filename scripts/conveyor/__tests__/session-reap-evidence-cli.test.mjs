/**
 * @file scripts/conveyor/__tests__/session-reap-evidence-cli.test.mjs
 * @description The GROUND-TRUTH axis through the REAL reaper CLI (split out of `session-reaper-cli.test.mjs`).
 *
 * THE GROUND-TRUTH AXIS (found live 2026-09-03, `conveyor-3451`) gets the SAME real-CLI treatment, for the
 * identical reason: `sessionReapPlan`'s own fixture-level tests inject a `groundTruthFor` stub directly and
 * never touch `main()`'s wiring of `makeGroundTruthResolver` to `execFileSync`/`WE_BACKLOG_DIR` — exactly the
 * class of gap the original `session-reaper-cli.test.mjs` was written to close for the base axis. A `gh` stub
 * plus a real temp `WE_BACKLOG_DIR` prove the wiring end to end, not just the pure classification.
 *
 * Also the repo-less PR names (`review-148` is plateau-app#148, found live 2026-09-20): a `gh` stub keyed by `--repo`.
 */

import { readFileSync, rmSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { writeFollowUp } from '../../operations/land-advance-io.mjs';
import { createFileRunStore } from '../../operations/run-store.mjs';
import { EXEC_TIMEOUT_MS, argvFile, ghArgvFile, runsDir, installReaperCliHarness, makeBacklogDir, runReaperCli } from './helpers/session-reaper-cli-harness.mjs';

installReaperCliHarness();

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
    expect(report.wouldStop).toEqual([{ id: 'review1', sessionId: 'review-1-full-uuid', name: 'review-1862', reason: 'ground-truth-pr:pr#1862:merged@we+frontierui+plateau-app' }]);
    // A repo-less `review-1862` names no repo, so the PR number is asked of EVERY constellation repo — pinned
    // with `--repo` each time (a bare `gh pr view` reads whichever repo the reaper's cwd happens to be).
    expect(readFileSync(ghArgvFile, 'utf8').trim().split('\n')).toEqual([
      'pr view 1862 --repo chalbert/web-everything --json state,mergedAt',
      'pr view 1862 --repo chalbert/frontierui --json state,mergedAt',
      'pr view 1862 --repo chalbert/plateau-app --json state,mergedAt',
    ]);
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
    expect(report.wouldStop).toEqual([{ id: 'review1', sessionId: 'review-1-full-uuid', name: 'review-1862', reason: 'ground-truth-pr:pr#1862:merged@we+frontierui+plateau-app' }]);
    // A repo-less `review-1862` names no repo, so the PR number is asked of EVERY constellation repo — pinned
    // with `--repo` each time (a bare `gh pr view` reads whichever repo the reaper's cwd happens to be).
    expect(readFileSync(ghArgvFile, 'utf8').trim().split('\n')).toEqual([
      'pr view 1862 --repo chalbert/web-everything --json state,mergedAt',
      'pr view 1862 --repo chalbert/frontierui --json state,mergedAt',
      'pr view 1862 --repo chalbert/plateau-app --json state,mergedAt',
    ]);
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


describe('repo-less PR session names — review-148 is plateau-app#148 (merged), not WE#148 (#3383, found live 2026-09-20)', () => {
  const review148 = { id: '9eff9f54', sessionId: '9eff9f54-d1d3-44ff-883d-91d4072f17ca', kind: 'background', state: 'blocked', status: 'idle', name: 'review-148' };
  const run = (gh, { agents = [review148], args = ['--dry-run', '--json'], env = {} } = {}) => {
    const backlogDir = makeBacklogDir({});
    try {
      return runReaperCli(args, { agents: JSON.stringify(agents), env: { WE_BACKLOG_DIR: backlogDir, ...gh, ...env } });
    } finally {
      rmSync(backlogDir, { recursive: true, force: true });
    }
  };
  const MERGED = JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-20T12:20:00Z' });
  const OPEN = JSON.stringify({ state: 'OPEN', mergedAt: null });

  it('UNAMBIGUOUS: merged in WE and plateau-app, absent in frontierui → planned for reap, evidence names both repos', () => {
    const report = JSON.parse(run({ STUB_GH_PR_148_WE: MERGED, STUB_GH_PR_148_FUI: 'ABSENT', STUB_GH_PR_148_PA: MERGED }));
    expect(report.wouldStop).toEqual([{ id: '9eff9f54', sessionId: review148.sessionId, name: 'review-148', reason: 'ground-truth-pr:pr#148:merged@we+plateau-app' }]);
    expect(readFileSync(ghArgvFile, 'utf8').trim().split('\n')).toEqual([
      'pr view 148 --repo chalbert/web-everything --json state,mergedAt',
      'pr view 148 --repo chalbert/frontierui --json state,mergedAt',
      'pr view 148 --repo chalbert/plateau-app --json state,mergedAt',
    ]);
  }, EXEC_TIMEOUT_MS);

  it('AMBIGUOUS: merged in plateau-app but the same number is still OPEN in WE → kept', () => {
    const report = JSON.parse(run({ STUB_GH_PR_148_WE: OPEN, STUB_GH_PR_148_FUI: 'ABSENT', STUB_GH_PR_148_PA: MERGED }));
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('UNREADABLE: one repo\'s lookup fails → kept, even though the others say merged', () => {
    const report = JSON.parse(run({ STUB_GH_PR_148_WE: MERGED, STUB_GH_PR_148_FUI: 'ERROR', STUB_GH_PR_148_PA: MERGED }));
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('the number exists in no repo → kept', () => {
    const report = JSON.parse(run({ STUB_GH_PR_148: 'ABSENT' }));
    expect(report.wouldStop).toEqual([]);
    expect(report.kept).toBe(1);
  }, EXEC_TIMEOUT_MS);

  it('the follow-up ledger names the repo → that repo alone (one gh call, in plateau-app), even with WE#148 open', () => {
    writeFollowUp(
      { session: review148.id, kind: 'review', target: 'plateau-app#148', launchedAt: '2026-09-20T12:00:00.000Z', deadline: '2026-09-20T13:00:00.000Z' },
      { store: createFileRunStore(runsDir) },
    );
    const report = JSON.parse(run({ STUB_GH_PR_148_WE: OPEN, STUB_GH_PR_148_PA: MERGED }));
    expect(report.wouldStop.map((w) => w.reason)).toEqual(['ground-truth-pr:pr#148:merged@plateau-app']);
    // (The verdict axis's own `gh api` PR-signal reads for the ledger entry are a separate lookup, not counted.)
    const prViews = readFileSync(ghArgvFile, 'utf8').trim().split('\n').filter((l) => l.startsWith('pr view'));
    expect(prViews).toEqual(['pr view 148 --repo chalbert/plateau-app --json state,mergedAt']);
  }, EXEC_TIMEOUT_MS);

  it('`--dry-run --json` keeps its shape: the same top-level keys and `wouldStop` entry keys as before this change', () => {
    const report = JSON.parse(run({ STUB_GH_PR_148: MERGED }));
    expect(Object.keys(report)).toEqual(['scanned', 'stopped', 'alreadyGone', 'cleared', 'failures', 'anomalies', 'wouldStop', 'kept', 'attention']);
    expect(Object.keys(report.wouldStop[0])).toEqual(['id', 'sessionId', 'name', 'reason']);
    expect(report).toMatchObject({ scanned: 1, stopped: 0, failures: 0, anomalies: 0, kept: 0, attention: [] });
  }, EXEC_TIMEOUT_MS);

  it('is deterministic: two identical passes print byte-identical reports', () => {
    const gh = { STUB_GH_PR_148_WE: MERGED, STUB_GH_PR_148_FUI: 'ABSENT', STUB_GH_PR_148_PA: MERGED };
    expect(run(gh)).toBe(run(gh));
  }, EXEC_TIMEOUT_MS);

  it('a real (non-dry-run) pass stops the unambiguous one with the SHORT id, and never touches an ambiguous one', () => {
    run({ STUB_GH_PR_148_WE: MERGED, STUB_GH_PR_148_FUI: 'ABSENT', STUB_GH_PR_148_PA: MERGED }, { args: [] });
    expect(readFileSync(argvFile, 'utf8').trim().split('\n')).toEqual(['agents --json --all', 'stop 9eff9f54']);
    rmSync(argvFile);
    run({ STUB_GH_PR_148_WE: OPEN, STUB_GH_PR_148_FUI: 'ABSENT', STUB_GH_PR_148_PA: MERGED }, { args: [] });
    expect(readFileSync(argvFile, 'utf8').trim().split('\n')).toEqual(['agents --json --all']);
  }, EXEC_TIMEOUT_MS);
});
