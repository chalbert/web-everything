/**
 * agy-launcher-probation — the pure launcher decisions: argv, task text, the checker verdict, the diff bound,
 * when a model is needed at all, the trailers, and the launch scorecard row.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCheckerArgv, buildCiHealTask, buildDocFixCommitMessage, buildDocFixTask, buildHealCommitMessage,
  buildWorkerArgv, coAuthorTrailerForWorker, frontmatterTamperedBeyondClaim, healDiffWithinEnvelope,
  launchScorecardRow, newUntrackedPaths, parseCheckerVerdict, summarizeNumstat, workerNeeded,
} from '../probation-launcher.mjs';
import { PROVEN_TASK_ENVELOPES } from '../provider-routing.mjs';
import { validateScorecard } from '../../conveyor/run-scorecard-store.mjs';

const agyClaude = { id: 'antigravity-claude', provider: 'antigravity', model: 'claude-sonnet-4-6', executor: 'antigravity', launcher: 'scripts/gemini-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const codex = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', launcher: 'scripts/codex-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const agyGemini = { ...agyClaude, id: 'antigravity-gemini', model: 'gemini-3.8-flash-high', checker: 'codex' };
const docFixCodex = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', launcher: 'scripts/codex-direct-task.mjs', checker: null, taskType: 'doc-fix' };

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

describe('buildDocFixTask (#4291)', () => {
  it('names the item, embeds its spec, states the doc-fix rules, and forbids commit/push/resolve', () => {
    const t = buildDocFixTask({ num: 4291, title: 'Probation launcher for doc-fix builds', spec: '## Done when\n\n1. it works.', scope: ['we:scripts/lib/a.mjs'] });
    expect(t).toContain('#4291: Probation launcher for doc-fix builds');
    expect(t).toContain('## Done when\n\n1. it works.');
    expect(t).toContain('at most 2 files');
    expect(t).toContain('about 100 changed lines');
    expect(t).toContain('we:scripts/lib/a.mjs');
    expect(t).toContain('Do not commit, push, open a pull request, resolve the backlog item');
    expect(t).toContain('Never weaken, skip or delete a test');
  });
  it('a task with no declared scope still tells the worker to stay inside documentation paths', () => {
    expect(buildDocFixTask({ num: 1, spec: 'x' })).toContain('no declared scope — stay inside documentation paths only');
  });
  it('refuses with no num or no spec', () => {
    expect(() => buildDocFixTask({ spec: 'x' })).toThrow(/num is required/);
    expect(() => buildDocFixTask({ num: 1, spec: '' })).toThrow(/spec is required/);
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
  it('leaves out excluded paths (untracked before the worker ran)', () => {
    expect(summarizeNumstat('1\t0\tnode_modules\n3\t1\ta.mjs', { exclude: ['node_modules'] })).toEqual({ files: 1, loc: 4, paths: ['a.mjs'] });
  });
  it('holds a heal to 3 files and 150 lines', () => {
    expect(healDiffWithinEnvelope({ files: 3, loc: 150 }).ok).toBe(true);
    expect(healDiffWithinEnvelope({ files: 4, loc: 10 }).ok).toBe(false);
    expect(healDiffWithinEnvelope({ files: 1, loc: 151 }).ok).toBe(false);
  });
});

describe('newUntrackedPaths — only files the WORKER created join the heal diff', () => {
  // Live-caught (agy-launcher-probation proof, 2026-09-27): an untracked `node_modules` symlink that was in the
  // lane BEFORE the worker ran was swept into the heal commit. Only paths new since the pre-run snapshot count.
  it('drops every path that was already untracked before the worker ran', () => {
    expect(newUntrackedPaths(['node_modules', 'scratch.txt'], ['node_modules', 'scratch.txt', 'scripts/new.test.mjs'])).toEqual(['scripts/new.test.mjs']);
    expect(newUntrackedPaths([], ['a'])).toEqual(['a']);
    expect(newUntrackedPaths(['a'], [])).toEqual([]);
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
  it('a doc-fix build commit message carries the same trailers, keyed to the item not a PR (#4291)', () => {
    const m = buildDocFixCommitMessage({ num: 4291, worker: docFixCodex });
    expect(m.split('\n')[0]).toBe('WE #4291: doc-fix build on probation (codex/gpt-6-astra)');
    expect(m).toContain('Probation-Worker: codex');
    expect(m).toContain('Executor: codex');
    expect(m).toContain('Co-Authored-By: Codex <noreply@openai.com>');
    expect(m).toContain('Full review and a run rating are owed');
  });
});

describe('launchScorecardRow', () => {
  it('is a valid store row with no outcome and no verifier — a launch is not a judged trial', () => {
    const r = launchScorecardRow({ worker: agyClaude, pr: 7, repo: 'chalbert/web-everything', handle: 'ci-heal-7', launchOutcome: 'healed' });
    expect(validateScorecard(r)).toEqual({ ok: true, errors: [] });
    expect(r).toMatchObject({ dispatchKind: 'probation-launch', taskType: 'ci-heal', outcome: null, verifiedBy: null, executor: 'antigravity' });
  });
  it('a doc-fix build row is valid too, with no PR at launch time (#4291)', () => {
    const r = launchScorecardRow({ worker: docFixCodex, pr: null, repo: 'chalbert/web-everything', handle: 'probation-4291', item: '4291', launchOutcome: 'opened-pr' });
    expect(validateScorecard(r)).toEqual({ ok: true, errors: [] });
    expect(r).toMatchObject({ dispatchKind: 'probation-launch', taskType: 'doc-fix', outcome: null, verifiedBy: null, executor: 'codex', item: '4291' });
  });
});

describe('the doc-fix envelope bound reuses the same generic check (#4291)', () => {
  it('holds a doc-fix build to 2 files and 100 lines — the ci-heal default does not silently widen it', () => {
    expect(healDiffWithinEnvelope({ files: 2, loc: 100 }, PROVEN_TASK_ENVELOPES['doc-fix']).ok).toBe(true);
    expect(healDiffWithinEnvelope({ files: 3, loc: 10 }, PROVEN_TASK_ENVELOPES['doc-fix']).ok).toBe(false);
    expect(healDiffWithinEnvelope({ files: 1, loc: 101 }, PROVEN_TASK_ENVELOPES['doc-fix']).ok).toBe(false);
  });
});

describe('frontmatterTamperedBeyondClaim — a doc-fix worker rewriting a field the claim does not own (#4291)', () => {
  const before = '---\nstatus: open\nscope: ["we:a.md"]\ndateOpened: "2026-09-27"\n---\n\nbody text';
  it('the claim/resolve/prepare-stamp\'s own fields changing is NOT tamper', () => {
    const after = '---\nstatus: active\nscope: ["we:a.md"]\ndateOpened: "2026-09-27"\ndateStarted: "2026-09-28"\npreparedDate: "2026-09-28"\npreparedAgainstSha: "abc123"\n---\n\nbody text';
    expect(frontmatterTamperedBeyondClaim(before, after)).toBe(false);
  });
  it('a changed `scope:` (or any other non-owned field) IS tamper', () => {
    const after = '---\nstatus: open\nscope: ["we:evil.mjs"]\ndateOpened: "2026-09-27"\n---\n\nbody text';
    expect(frontmatterTamperedBeyondClaim(before, after)).toBe(true);
  });
  it('an added, unrecognized field IS tamper', () => {
    const after = '---\nstatus: open\nscope: ["we:a.md"]\ndateOpened: "2026-09-27"\nblockedBy: ["1"]\n---\n\nbody text';
    expect(frontmatterTamperedBeyondClaim(before, after)).toBe(true);
  });
  it('no frontmatter block on either side is trivially not tampered', () => {
    expect(frontmatterTamperedBeyondClaim('plain text', 'plain text')).toBe(false);
  });
  it('a narrower `allowedKeys` (a caller that never calls prepare-stamp/graduated resolve) treats those fields as tamper too (#4291 plan review round 8)', () => {
    const after = '---\nstatus: open\nscope: ["we:a.md"]\ndateOpened: "2026-09-27"\npreparedDate: "2026-09-28"\n---\n\nbody text';
    expect(frontmatterTamperedBeyondClaim(before, after)).toBe(false); // fine under the full default allowlist
    expect(frontmatterTamperedBeyondClaim(before, after, ['status', 'dateStarted', 'dateResolved'])).toBe(true); // tamper under a narrower one
  });
});
