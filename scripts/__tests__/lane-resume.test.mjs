import { describe, it, expect } from 'vitest';
import { classifyLane, orderByBlockedBy, landDecision, land, remoteManifestApiArgs } from '../lane-resume.mjs';

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

describe('lane-resume — land (#2202/#2290: enqueue + trigger the drain, never merges directly)', () => {
  const hasLabelEdit = (calls) => calls.some((c) => c.cmd === 'gh' && c.args[1] === 'edit' && c.args.includes('--add-label'));
  const hasDrainTrigger = (calls) => calls.some((c) => c.cmd === 'node' && c.args.some((a) => String(a).startsWith('--only=')));
  const hasGhMerge = (calls) => calls.some((c) => c.cmd === 'gh' && c.args[1] === 'merge');

  it('a clean PR → enqueue (label ready-to-merge) + trigger a single-couple drain; NEVER gh pr merge', () => {
    const { run, calls } = scriptedRun({ ...prView(), 'git merge-tree': { status: 0, stdout: 'x' } });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v).toMatchObject({ action: 'enqueued', merged: false, rebased: false });
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false); // no rebuild needed
    expect(hasLabelEdit(calls)).toBe(true);
    expect(hasDrainTrigger(calls)).toBe(true);
    expect(hasGhMerge(calls)).toBe(false); // #2290 — lane-resume is not a writer to main
  });

  it('a manifest-only conflict → rebase-drop, THEN enqueue + trigger the drain (dropped, not merged here)', () => {
    const { run, calls } = scriptedRun({
      'git merge-tree': { status: 1, stdout: mergeTreeConflict(['.lane-manifest.json']) },
      ...RESOLVE_PLUMBING,
      'gh pr': { status: 0 },
    });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v).toMatchObject({ action: 'rebuilt-enqueued', merged: false, rebased: true });
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(true);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(true);
    expect(hasLabelEdit(calls)).toBe(true);
    expect(hasDrainTrigger(calls)).toBe(true);
    expect(hasGhMerge(calls)).toBe(false);
  });

  it('a real (non-manifest) conflict → skip, never enqueues or merges', () => {
    const { run, calls } = scriptedRun({ 'git merge-tree': { status: 1, stdout: mergeTreeConflict(['.lane-manifest.json', 'src/app.ts']) } });
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.action).toBe('skip');
    expect(v.merged).toBe(false);
    expect(hasGhMerge(calls)).toBe(false);
    expect(hasDrainTrigger(calls)).toBe(false); // repaired code first — nothing enqueued
  });

  it('a red `test` → never enqueues (no merge-tree, no label, no trigger)', () => {
    const { run, calls } = scriptedRun({});
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] } });
    expect(v.action).toBe('red');
    expect(calls.length).toBe(0); // decided from signals alone, touches nothing
  });

  it('dry-run reports the enqueue plan without touching git/gh', () => {
    const { run, calls } = scriptedRun({});
    const v = land({ prNum: 5, run, dryRun: true, prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.merged).toBe(false);
    expect(v.reason).toMatch(/dry-run/);
    expect(v.reason).toMatch(/enqueue|drain/);
    expect(calls.length).toBe(0);
  });

  it('triggerDrain:false enqueues (labels) but does NOT shell the drain — for a batch closeout', () => {
    const { run, calls } = scriptedRun({ ...prView() });
    const v = land({ prNum: 5, run, triggerDrain: false, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.action).toBe('enqueued');
    expect(hasLabelEdit(calls)).toBe(true);
    expect(hasDrainTrigger(calls)).toBe(false);
    expect(hasGhMerge(calls)).toBe(false);
  });
});

describe('lane-resume — land is repo-aware (#2383: /finish spans all constellation repos like /drain)', () => {
  const labelEdit = (calls) => calls.find((c) => c.cmd === 'gh' && c.args[1] === 'edit' && c.args.includes('--add-label'));
  const drainTrigger = (calls) => calls.find((c) => c.cmd === 'node' && c.args.some((a) => String(a).startsWith('--only=')));

  it('a REMOTE repo → every gh call is `--repo`-scoped and the drain trigger targets that repo via `--repos=`', () => {
    const { run, calls } = scriptedRun({ ...prView() });
    const v = land({ prNum: 5, run, repo: 'chalbert/plateau-app', prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v.action).toBe('enqueued');
    const edit = labelEdit(calls);
    expect(edit.args).toEqual(expect.arrayContaining(['--repo', 'chalbert/plateau-app']));
    const trig = drainTrigger(calls);
    expect(trig.args).toContain('--repos=chalbert/plateau-app'); // NOT --this-repo — that would sweep the cwd repo
    expect(trig.args).not.toContain('--this-repo');
  });

  it('a REMOTE repo manifest-conflict DEFERS the rebuild to the drain (no local rebase-drop plumbing)', () => {
    // No RESOLVE_PLUMBING scripted: a local rebaseDropManifest would call git write-tree/commit-tree/push and
    // fail here — proving the remote path never runs it, just enqueues + lets the (sibling-clone-aware) drain rebuild.
    const { run, calls } = scriptedRun({ ...prView() });
    const v = land({ prNum: 5, run, repo: 'chalbert/frontierui', prInfo: { headRefName: 'lane/x-2202', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(v).toMatchObject({ action: 'enqueued', rebased: false }); // deferred, not 'rebuilt-enqueued'
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false); // never touched local git
    expect(drainTrigger(calls).args).toContain('--repos=chalbert/frontierui');
  });

  it('the LOCAL repo (no `repo`) keeps the established `--this-repo` trigger and un-scoped gh calls', () => {
    const { run, calls } = scriptedRun({ ...prView() });
    land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] } });
    expect(labelEdit(calls).args).not.toContain('--repo');
    expect(drainTrigger(calls).args).toContain('--this-repo');
  });

  it('the remote-manifest `gh api` read forces `--method GET` (else `-f` makes gh POST → 404 → every remote lane silently drops item/blockedBy)', () => {
    const args = remoteManifestApiArgs('chalbert/plateau-app', 'lane/x-2343');
    // GET must be explicit and precede the endpoint (a POST to the read-only contents endpoint 404s).
    expect(args).toContain('--method');
    expect(args[args.indexOf('--method') + 1]).toBe('GET');
    expect(args).toContain('repos/chalbert/plateau-app/contents/.lane-manifest.json');
    expect(args).toEqual(expect.arrayContaining(['-f', 'ref=lane/x-2343']));
  });
});
