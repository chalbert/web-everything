import { describe, it, expect } from 'vitest';
import { classifyLane, orderByBlockedBy, landDecision, land } from '../lane-resume.mjs';

const resolved = new Set([2110, 2113]); // blockers already landed on main

describe('lane-resume — classifyLane (#2200)', () => {
  const lane = (o) => ({ num: 1, mergeable: 'MERGEABLE', mergeState: 'CLEAN', testConclusion: 'SUCCESS', item: 100, repos: [{ repo: 'we', ref: 'lane/x' }], blockedBy: [], ...o });

  it('BLOCKED wins — a blockedBy item not yet resolved defers the lane', () => {
    const v = classifyLane(lane({ blockedBy: [2113, 9999] }), resolved);
    expect(v.disposition).toBe('blocked');
    expect(v.reason).toMatch(/9999/); // names the unlanded blocker, not the landed one
  });

  it('a satisfied blockedBy (all blockers resolved) does NOT block', () => {
    expect(classifyLane(lane({ blockedBy: [2110, 2113] }), resolved).disposition).toBe('ready');
  });

  it('test-red beats a conflict — the lane bug must be fixed first', () => {
    const v = classifyLane(lane({ testConclusion: 'FAILURE', mergeable: 'CONFLICTING', mergeState: 'DIRTY' }), resolved);
    expect(v.disposition).toBe('test-red');
  });

  it('CONFLICTING (green test) → conflict (rebase + resolve)', () => {
    expect(classifyLane(lane({ mergeable: 'CONFLICTING', mergeState: 'DIRTY' }), resolved).disposition).toBe('conflict');
  });

  it('clean + green → ready (drain will take it, not resume)', () => {
    expect(classifyLane(lane({}), resolved).disposition).toBe('ready');
  });

  it('flags cross-repo when any repo is not `we`', () => {
    const v = classifyLane(lane({ repos: [{ repo: 'frontierui', ref: 'l' }, { repo: 'we', ref: 'l', carriesResolve: true }] }), resolved);
    expect(v.crossRepo).toBe(true);
  });

  it('unknown mergeability → unknown (not a false ready/conflict)', () => {
    expect(classifyLane(lane({ mergeable: 'UNKNOWN', mergeState: 'UNKNOWN', testConclusion: null }), resolved).disposition).toBe('unknown');
  });
});

describe('lane-resume — orderByBlockedBy (#2200)', () => {
  const mk = (num, item, blockedBy, disposition = 'conflict') => ({ num, item, blockedBy, disposition, repos: [], crossRepo: false, reason: '' });

  it('a lane never precedes a lane it is blockedBy', () => {
    const a = mk(1, 100, [200]); // blocked by item 200 (=PR b)
    const b = mk(2, 200, []);
    const ordered = orderByBlockedBy([a, b]).map((l) => l.num);
    expect(ordered.indexOf(2)).toBeLessThan(ordered.indexOf(1));
  });

  it('blocked lanes sort last (can’t run this pass)', () => {
    const ok = mk(1, 100, []);
    const blk = mk(2, 200, [], 'blocked');
    expect(orderByBlockedBy([blk, ok]).map((l) => l.num)).toEqual([1, 2]);
  });

  it('a dependency cycle does not hang or drop lanes', () => {
    const a = mk(1, 100, [200]);
    const b = mk(2, 200, [100]);
    expect(orderByBlockedBy([a, b]).map((l) => l.num).sort()).toEqual([1, 2]);
  });
});

describe('lane-resume — landDecision (#2202)', () => {
  it('a red required `test` never lands (a real bug)', () => {
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'CLEAN', testConclusion: 'FAILURE' }).action).toBe('red');
  });
  it('test not reported / pending → not-green (wait)', () => {
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'CLEAN', testConclusion: null }).action).toBe('not-green');
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'BLOCKED', testConclusion: 'PENDING' }).action).toBe('not-green');
  });
  it('test green + mergeable → clean merge', () => {
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'CLEAN', testConclusion: 'SUCCESS' }).action).toBe('clean');
  });
  it('UNSTABLE + test=pass IS mergeable (only `test` is required; cla/Workers-Builds are not)', () => {
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'UNSTABLE', testConclusion: 'SUCCESS' }).action).toBe('clean');
  });
  it('test green but CONFLICTING/DIRTY/BEHIND → rebuild (rebase-drop the manifest)', () => {
    expect(landDecision({ mergeable: 'CONFLICTING', mergeState: 'DIRTY', testConclusion: 'SUCCESS' }).action).toBe('rebuild');
    expect(landDecision({ mergeable: 'MERGEABLE', mergeState: 'BEHIND', testConclusion: 'SUCCESS' }).action).toBe('rebuild');
  });
});

// A scripted runner: canned results per (cmd + subcommand), recording the call order.
function scriptedRun(script) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts?.env });
    const key = `${cmd} ${args[0]}`;
    const h = script[key];
    return { status: 0, stdout: '', stderr: '', ...((typeof h === 'function' ? h(args, opts) : h) || {}) };
  };
  return { run, calls };
}
const prView = (o) => ({ 'gh pr': { stdout: JSON.stringify({ number: 5, headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }], ...o }) } });
const mergeTreeConflict = (paths) => ['t'.repeat(40), ...paths.flatMap((p) => [1, 2, 3].map((s) => `100644 ${'a'.repeat(40)} ${s}\t${p}`)), '', `CONFLICT in ${paths[0]}`].join('\n');
const RESOLVE_PLUMBING = {
  'git read-tree': { status: 0 }, 'git rm': { status: 0 },
  'git write-tree': { status: 0, stdout: 'resolved'.padEnd(40, '0') },
  'git commit-tree': { status: 0, stdout: 'newc'.padEnd(40, '0') },
  'git push': { status: 0 }, 'gh pr': undefined /* set per-test */,
};

describe('lane-resume — land (#2202, reuses the #2198 helper)', () => {
  it('a clean PR → gh pr merge directly (no rebuild)', () => {
    const { run, calls } = scriptedRun({ ...prView(), 'git merge-tree': { status: 0, stdout: 'x' } });
    // fetch order: gh pr view (info), then straight to gh pr merge — no merge-tree/commit-tree.
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v).toMatchObject({ action: 'merged', merged: true, rebased: false });
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.find((c) => c.cmd === 'gh' && c.args[0] === 'pr' && c.args[1] === 'merge')).toBeTruthy();
  });

  it('a manifest-only conflict → rebase-drop, then merge (dropped + landed)', () => {
    const { run, calls } = scriptedRun({
      'git merge-tree': { status: 1, stdout: mergeTreeConflict(['.lane-manifest.json']) },
      ...RESOLVE_PLUMBING,
      'gh pr': { status: 0 },
    });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v).toMatchObject({ action: 'merged', merged: true, rebased: true });
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(true);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(true);
    expect(calls.some((c) => c.cmd === 'gh' && c.args[1] === 'merge')).toBe(true);
  });

  it('a real (non-manifest) conflict → skip, never merges', () => {
    const { run, calls } = scriptedRun({ 'git merge-tree': { status: 1, stdout: mergeTreeConflict(['.lane-manifest.json', 'src/app.ts']) } });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.action).toBe('skip');
    expect(v.merged).toBe(false);
    expect(calls.some((c) => c.cmd === 'gh' && c.args[1] === 'merge')).toBe(false);
  });

  it('a red `test` → never lands (no merge-tree, no merge)', () => {
    const { run, calls } = scriptedRun({});
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] } });
    expect(v.action).toBe('red');
    expect(calls.length).toBe(0); // decided from signals alone, touches nothing
  });

  it('dry-run reports the plan without touching git/gh', () => {
    const { run, calls } = scriptedRun({});
    const v = land({ prNum: 5, run, dryRun: true, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.merged).toBe(false);
    expect(v.reason).toMatch(/dry-run/);
    expect(calls.length).toBe(0);
  });

  it('after a rebuild, a bounced merge (CI re-running) is soft, not a hard failure', () => {
    const { run } = scriptedRun({
      'git merge-tree': { status: 1, stdout: mergeTreeConflict(['.lane-manifest.json']) },
      ...RESOLVE_PLUMBING,
      'gh pr': { status: 1, stderr: 'Pull request is not mergeable: the base branch requires all checks to pass' },
    });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.action).toBe('rebuilt-awaiting-ci');
    expect(v.merged).toBe(false);
    expect(v.rebased).toBe(true);
  });
});
