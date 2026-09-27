/**
 * agy-launcher-probation — the pure launcher decisions: argv, task text, the checker verdict, the diff bound,
 * when a model is needed at all, the trailers, and the launch scorecard row.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCheckerArgv, buildCiHealTask, buildHealCommitMessage, buildWorkerArgv, coAuthorTrailerForWorker,
  healDiffWithinEnvelope, launchScorecardRow, parseCheckerVerdict, summarizeNumstat, workerNeeded,
} from '../probation-launcher.mjs';
import { validateScorecard } from '../../conveyor/run-scorecard-store.mjs';

const agyClaude = { id: 'antigravity-claude', provider: 'antigravity', model: 'claude-sonnet-4-6', executor: 'antigravity', launcher: 'scripts/gemini-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const codex = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', launcher: 'scripts/codex-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const agyGemini = { ...agyClaude, id: 'antigravity-gemini', model: 'gemini-3.8-flash-high', checker: 'codex' };

describe('buildWorkerArgv', () => {
  it('runs the worker\'s own launcher synchronously in the lane, with its model, no gate, JSON out', () => {
    expect(buildWorkerArgv({ worker: agyClaude, weRoot: '/we', dir: '/lane', taskFile: '/lane/.git/t.md', timeoutMs: 1000 })).toEqual([
      '/we/scripts/gemini-direct-task.mjs', '--dir=/lane', '--task-file=/lane/.git/t.md', '--model=claude-sonnet-4-6', '--timeout-ms=1000', '--gate=none', '--json',
    ]);
    expect(buildWorkerArgv({ worker: codex, weRoot: '/we', dir: '/lane', taskFile: '/t' })[0]).toBe('/we/scripts/codex-direct-task.mjs');
  });
  it('refuses an unknown launcher or a missing dir', () => {
    expect(() => buildWorkerArgv({ worker: { ...codex, launcher: 'rm.mjs' }, weRoot: '/we', dir: '/l', taskFile: '/t' })).toThrow(/unknown launcher/);
    expect(() => buildWorkerArgv({ worker: codex, weRoot: '/we', dir: '', taskFile: '/t' })).toThrow(/dir is required/);
  });
  it('the checker is Codex in read-only review mode', () => {
    expect(buildCheckerArgv({ checker: 'codex', weRoot: '/we', dir: '/l', taskFile: '/c' })).toEqual(['/we/scripts/codex-direct-task.mjs', '--review', '--dir=/l', '--task-file=/c', '--gate=none', '--json']);
    expect(() => buildCheckerArgv({ checker: 'gemini', weRoot: '/we', dir: '/l', taskFile: '/c' })).toThrow();
  });
});

describe('task text', () => {
  it('names the PR, the reason, the failing checks, the rules, and forbids commit/push', () => {
    const t = buildCiHealTask({ pr: 42, reason: 'red-ci', scope: ['we:scripts/a.mjs'], failingChecks: 'test\tfail', gateOutput: 'FAIL x' });
    expect(t).toContain('pull request #42 (red-ci)');
    expect(t).toContain('test\tfail');
    expect(t).toContain('Never weaken, skip or delete a test');
    expect(t).toContain('Do not commit, push');
    expect(t).toContain('we:scripts/a.mjs');
  });
});

describe('parseCheckerVerdict — fail closed', () => {
  it.each([
    ['APPROVE\nlooks right', true, 'approve'],
    ['**Approve**\nok', true, 'approve'],
    ['REJECT\nweakens a test', false, 'reject'],
    ['I think this is fine', false, 'unreadable'],
    ['', false, 'unreadable'],
    [null, false, 'unreadable'],
  ])('%j → approved=%s', (msg, approved, verdict) => {
    const v = parseCheckerVerdict(msg);
    expect(v.approved).toBe(approved);
    expect(v.verdict).toBe(verdict);
  });
});

describe('the heal diff bound', () => {
  it('sums numstat (binary counts as a file, zero lines)', () => {
    expect(summarizeNumstat('3\t1\ta.mjs\n-\t-\timg.png\n\n')).toEqual({ files: 2, loc: 4, paths: ['a.mjs', 'img.png'] });
  });
  it('holds a heal to 3 files and 150 lines', () => {
    expect(healDiffWithinEnvelope({ files: 3, loc: 150 }).ok).toBe(true);
    expect(healDiffWithinEnvelope({ files: 4, loc: 10 }).ok).toBe(false);
    expect(healDiffWithinEnvelope({ files: 1, loc: 151 }).ok).toBe(false);
  });
});

describe('workerNeeded — the script goes first, a model only when there is something to repair', () => {
  it('red gate → worker', () => expect(workerNeeded({ gateGreen: false, reason: 'behind', rebaseMovedHead: true }).needed).toBe(true));
  it('red CI and a no-op rebase → worker (the local gate cannot explain the red)', () => expect(workerNeeded({ gateGreen: true, reason: 'red-ci', rebaseMovedHead: false }).needed).toBe(true));
  it('a rebase that turned the gate green → no worker', () => expect(workerNeeded({ gateGreen: true, reason: 'red-ci', rebaseMovedHead: true }).needed).toBe(false));
  it('behind, already current, gate green → nothing to do', () => expect(workerNeeded({ gateGreen: true, reason: 'behind', rebaseMovedHead: false }).needed).toBe(false));
});

describe('attribution', () => {
  it('trailers name the real author family', () => {
    expect(coAuthorTrailerForWorker(codex)).toBe('Co-Authored-By: Codex <noreply@openai.com>');
    expect(coAuthorTrailerForWorker(agyClaude)).toContain('claude-sonnet-4-6, via Antigravity');
    expect(coAuthorTrailerForWorker(agyGemini)).toContain('noreply@google.com');
  });
  it('the commit message carries the worker, executor and model trailers', () => {
    const m = buildHealCommitMessage({ pr: 7, reason: 'behind', worker: agyClaude, item: '4001' });
    expect(m.split('\n')[0]).toBe('WE #4001: CI-heal PR #7 on probation (antigravity/claude-sonnet-4-6, behind)');
    expect(m).toContain('Probation-Worker: antigravity-claude');
    expect(m).toContain('Executor: antigravity');
  });
});

describe('launchScorecardRow', () => {
  it('is a valid store row with no outcome and no verifier — a launch is not a judged trial', () => {
    const r = launchScorecardRow({ worker: agyClaude, pr: 7, repo: 'chalbert/web-everything', handle: 'ci-heal-7', launchOutcome: 'healed' });
    expect(validateScorecard(r)).toEqual({ ok: true, errors: [] });
    expect(r).toMatchObject({ dispatchKind: 'probation-launch', taskType: 'ci-heal', outcome: null, verifiedBy: null, executor: 'antigravity' });
  });
});
