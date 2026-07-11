import { describe, it, expect } from 'vitest';
import { classifyLane, orderByBlockedBy, landDecision, land, remoteManifestApiArgs, markStackDescendantsBlocked, planStackRebuild, rebuildDescendant } from '../lane-resume.mjs';

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

// ─────────────────────────── finish stack-repair (#2396 / #2387 F5) ───────────────────────────

describe('lane-resume — markStackDescendantsBlocked (#2396)', () => {
  // A stacked chain A(100) → B(200) → C(300) → D(400); B is the broken link. Item S(500) is a disjoint sibling.
  const chain = (over = {}) => [
    { num: 1, item: 100, stackParents: [], disposition: 'conflict', reason: 'r' },
    { num: 2, item: 200, stackParents: [100], disposition: 'conflict', reviewChanges: true, reason: 'r', ...over }, // broken link
    { num: 3, item: 300, stackParents: [200], disposition: 'conflict', reason: 'r' },
    { num: 4, item: 400, stackParents: [300], disposition: 'conflict', reason: 'r' },
    { num: 5, item: 500, stackParents: [], disposition: 'conflict', reason: 'r' }, // disjoint sibling
  ];
  const byItem = (ls) => Object.fromEntries(ls.map((l) => [l.item, l]));

  it('a review:changes link poisons ONLY its overlap-descendants (transitively) — not its ancestor or a sibling', () => {
    const m = byItem(markStackDescendantsBlocked(chain()));
    expect(m[300].disposition).toBe('blocked'); // direct descendant
    expect(m[400].disposition).toBe('blocked'); // transitive descendant
    expect(m[100].disposition).toBe('conflict'); // ANCESTOR — lands independently, never poisoned
    expect(m[500].disposition).toBe('conflict'); // disjoint sibling — untouched
  });

  it('the broken link KEEPS its own disposition (the finisher repairs it in place)', () => {
    const m = byItem(markStackDescendantsBlocked(chain()));
    expect(m[200].disposition).toBe('conflict'); // not re-bucketed to blocked — it IS the link
  });

  it('a red required `test` is also a broken link (not just review:changes)', () => {
    const ls = chain({ reviewChanges: false, disposition: 'test-red' }); // B red-CI instead of bounced
    const m = byItem(markStackDescendantsBlocked(ls));
    expect(m[200].disposition).toBe('test-red'); // kept
    expect(m[300].disposition).toBe('blocked');
    expect(m[400].disposition).toBe('blocked');
  });

  it('the poison reason names the broken stackParent so the finisher knows what to repair', () => {
    const m = byItem(markStackDescendantsBlocked(chain()));
    expect(m[300].reason).toMatch(/#200/);
  });

  it('no broken link → every lane keeps its disposition (a clean chain is untouched)', () => {
    const clean = chain({ reviewChanges: false });
    const m = byItem(markStackDescendantsBlocked(clean));
    expect(Object.values(m).every((l) => l.disposition === 'conflict')).toBe(true);
  });
});

describe('lane-resume — planStackRebuild (#2396)', () => {
  it('rebuilds ONLY the salvageable tail onto the repaired tip — ff when the fix shares no file, one guided conflict when it does', () => {
    // B(200) repaired; its fix touched `we:a.ts`. C(300) also touches a.ts (overlap → guided conflict);
    // D(400) touches only b.ts (no overlap → fast-forward). A(100) and S(500) are NOT descendants → absent.
    const plan = planStackRebuild({
      repaired: 200,
      descendants: [
        { item: 300, ref: 'lane/c', stackParents: [200], fileset: ['we:a.ts'] },
        { item: 400, ref: 'lane/d', stackParents: [300], fileset: ['we:b.ts'] },
      ],
      fixTouched: ['we:a.ts'],
      landed: new Set([100]),
    });
    expect(plan.order.map((s) => s.item)).toEqual([300, 400]); // topological: parent before child
    expect(plan.order.find((s) => s.item === 300).action).toBe('guided-conflict');
    expect(plan.order.find((s) => s.item === 400).action).toBe('ff');
    expect(plan.deferred).toHaveLength(0);
    // the "no blind whole-batch rebase" guarantee: only the poisoned tail is in the plan, never A(100)/S(500).
    expect(plan.order.map((s) => s.item)).not.toContain(100);
    expect(plan.order.map((s) => s.item)).not.toContain(500);
  });

  it('NEVER rebuilds a descendant past an unlanded parent — a missing base defers it', () => {
    // D(400) stacks on C(300), but C is neither landed nor in the descendant set → D cannot be placed.
    const plan = planStackRebuild({
      repaired: 200,
      descendants: [{ item: 400, ref: 'lane/d', stackParents: [300], fileset: ['we:b.ts'] }],
      fixTouched: ['we:a.ts'],
      landed: new Set(),
    });
    expect(plan.order).toHaveLength(0);
    expect(plan.deferred.map((d) => d.item)).toEqual([400]);
    expect(plan.deferred[0].reason).toMatch(/unlanded parent/);
  });

  it('a bornAs-proven / landed-this-pass parent counts as available (positive proof-of-land, not absence)', () => {
    // C(300) landed this pass; D(400) stacks on it → D IS placeable onto the repaired chain.
    const plan = planStackRebuild({
      repaired: 200,
      descendants: [{ item: 400, ref: 'lane/d', stackParents: [300], fileset: ['we:b.ts'] }],
      fixTouched: [],
      landed: new Set([300]),
    });
    expect(plan.order.map((s) => s.item)).toEqual([400]);
    expect(plan.order[0].action).toBe('ff'); // empty fix → nothing shared → fast-forward
  });

  it('places a two-level tail in topological order across sweeps (child after the parent it also rebuilds)', () => {
    const plan = planStackRebuild({
      repaired: 200,
      descendants: [
        { item: 400, ref: 'lane/d', stackParents: [300], fileset: [] }, // given out of order …
        { item: 300, ref: 'lane/c', stackParents: [200], fileset: [] },
      ],
      fixTouched: [],
    });
    expect(plan.order.map((s) => s.item)).toEqual([300, 400]); // C placed first, then D onto it
  });
});

describe('lane-resume — rebuildDescendant (#2396: reuse the rebase-drop plumbing, base = repaired tip)', () => {
  const onto = 'a'.repeat(40);
  it('a clean/manifest-only merge onto the repaired tip → a fast-forward rebuild (action rebased)', () => {
    const { run, calls } = scriptedRun({ 'git merge-tree': { status: 0, stdout: 'tree'.padEnd(40, '0') }, ...RESOLVE_PLUMBING, 'gh pr': { status: 0 } });
    const v = rebuildDescendant({ laneRef: 'lane/child', ontoSha: onto, run });
    expect(v.action).toBe('rebased');
    expect(v.ontoSha).toBe(onto);
    // merge inputs are fed the REPAIRED tip as the base, not origin/main.
    expect(calls.some((c) => c.args[0] === 'merge-tree' && c.args.includes(onto))).toBe(true);
  });

  it('a REAL (non-manifest) conflict → guided-conflict (the one conflict the finisher resolves with topology)', () => {
    const { run } = scriptedRun({ 'git merge-tree': { status: 1, stdout: mergeTreeConflict(['src/app.ts']) } });
    const v = rebuildDescendant({ laneRef: 'lane/child', ontoSha: onto, run });
    expect(v.action).toBe('guided-conflict');
    expect(v.conflictPaths).toContain('src/app.ts');
  });

  it('missing ontoSha (no repaired tip) → error, never touches git', () => {
    const { run, calls } = scriptedRun({});
    const v = rebuildDescendant({ laneRef: 'lane/child', run });
    expect(v.action).toBe('error');
    expect(calls.length).toBe(0);
  });
});
