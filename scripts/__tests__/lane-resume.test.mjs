import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyLane, orderByBlockedBy, landDecision, land, remoteManifestApiArgs, markStackDescendantsBlocked, planStackRebuild, rebuildDescendant, deriveLandedFromMain, resolvedOnMain, resolvedItemSet } from '../lane-resume.mjs';

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

  it('a review:changes bounce NEVER classifies ready — green CI + mergeable is irrelevant, a human rejected the diff (#2396)', () => {
    const v = classifyLane(lane({ reviewChanges: true }), resolved); // clean + green, but bounced
    expect(v.disposition).toBe('review-changes');
    expect(v.reason).toMatch(/review:changes/);
  });

  it('review:changes beats a conflict (repair the diff first; the rebase happens as part of the repair)', () => {
    expect(classifyLane(lane({ reviewChanges: true, mergeable: 'CONFLICTING', mergeState: 'DIRTY' }), resolved).disposition).toBe('review-changes');
  });

  it('BLOCKED still wins over a red test, but the RAW testRed flag is carried so the breakage is not masked (#2396)', () => {
    const v = classifyLane(lane({ blockedBy: [9999], testConclusion: 'FAILURE' }), resolved);
    expect(v.disposition).toBe('blocked'); // blockedBy still owns the disposition …
    expect(v.testRed).toBe(true);          // … but the broken-link signal survives for markStackDescendantsBlocked
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

  it('a review:changes-labelled PR → never enqueues, even green + mergeable (a human bounced the diff, #2396)', () => {
    const { run, calls } = scriptedRun({});
    const v = land({ prNum: 5, run, prInfo: { headRefName: 'lane/x-2202', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }], labels: [{ name: 'review:changes' }] } });
    expect(v.action).toBe('review-changes');
    expect(v.merged).toBe(false);
    expect(calls.length).toBe(0); // no label edit, no drain trigger — nothing pushed toward main
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

  it('a depth-≥2 descendant reason names the broken ROOT, never its (merely poisoned) immediate parent (#2396)', () => {
    const m = byItem(markStackDescendantsBlocked(chain()));
    expect(m[400].reason).toMatch(/#200/);     // the actual broken link
    expect(m[400].reason).not.toMatch(/#300/); // NOT the BFS predecessor — #300 has nothing to repair
  });

  it('a blockedBy-masked red-test link (disposition blocked, raw testRed) still poisons its descendants (#2396)', () => {
    // classifyLane's 'BLOCKED wins' overwrote B's disposition; the RAW testRed flag must still mark it broken,
    // else C/D stay ready and land past the unrepaired parent.
    const ls = chain({ reviewChanges: false, disposition: 'blocked', testRed: true });
    const m = byItem(markStackDescendantsBlocked(ls));
    expect(m[200].disposition).toBe('blocked'); // the link keeps its own (blockedBy) disposition
    expect(m[300].disposition).toBe('blocked');
    expect(m[300].reason).toMatch(/#200/);
    expect(m[400].disposition).toBe('blocked');
  });

  it('a review-changes DISPOSITION (no raw flag) is also a broken link', () => {
    const ls = chain({ reviewChanges: false, disposition: 'review-changes' });
    const m = byItem(markStackDescendantsBlocked(ls));
    expect(m[300].disposition).toBe('blocked');
    expect(m[400].disposition).toBe('blocked');
  });

  it('no broken link → every lane keeps its disposition (a clean chain is untouched)', () => {
    const clean = chain({ reviewChanges: false });
    const m = byItem(markStackDescendantsBlocked(clean));
    expect(Object.values(m).every((l) => l.disposition === 'conflict')).toBe(true);
  });

  it('a number-vs-string id spelling mismatch still poisons — broken item 2396 (number) matches stackParents ["2396"] (quoted frontmatter string)', () => {
    // The fail-OPEN bug this pins: a raw-keyed match across JSON-number / quoted-string spellings silently
    // skips the poisoning, so a review:changes-bounced parent's descendant stays ready and lands.
    const ls = [
      { num: 1, item: 2396, stackParents: [], disposition: 'conflict', reviewChanges: true, reason: 'r' }, // broken, NUMBER
      { num: 2, item: '2400', stackParents: ['2396'], disposition: 'conflict', reason: 'r' },              // child, STRING parent
      { num: 3, item: 2401, stackParents: [2400], disposition: 'conflict', reason: 'r' },                  // grandchild, NUMBER parent of a STRING item
    ];
    const m = byItem(markStackDescendantsBlocked(ls));
    expect(m['2400'].disposition).toBe('blocked');       // string-spelled parent edge still matched
    expect(m['2400'].reason).toMatch(/#2396/);
    expect(m[2401].disposition).toBe('blocked');         // transitive across the mixed-spelling hop too
    expect(m[2401].reason).toMatch(/#2396/);
  });

  it('the reverse spelling (broken item "2396" string, child stackParents [2396] number) also poisons', () => {
    const ls = [
      { num: 1, item: '2396', stackParents: [], disposition: 'test-red', reason: 'r' },
      { num: 2, item: 2400, stackParents: [2396], disposition: 'conflict', reason: 'r' },
    ];
    const m = byItem(markStackDescendantsBlocked(ls));
    expect(m[2400].disposition).toBe('blocked');
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

  it('normalizes caller-supplied spec.landed — landed [300] (number) matches a "300" (string) stackParent, and vice versa', () => {
    // Before the entry-point normalization, the raw-keyed landedSet.has("300") missed 300 and wrongly deferred.
    const num = planStackRebuild({
      repaired: 200,
      descendants: [{ item: '400', ref: 'lane/d', stackParents: ['300'], fileset: [] }], // quoted-string manifest
      landed: new Set([300]), // caller-supplied numbers (e.g. hand-written spec JSON)
    });
    expect(num.order.map((s) => s.item)).toEqual([400]); // placed, not deferred; item emitted in canonical form
    expect(num.deferred).toHaveLength(0);
    const str = planStackRebuild({
      repaired: 200,
      descendants: [{ item: 400, ref: 'lane/d', stackParents: [300], fileset: [] }],
      landed: ['300'], // array + string spelling
    });
    expect(str.order.map((s) => s.item)).toEqual([400]);
    expect(str.deferred).toHaveLength(0);
  });

  it('normalizes the repaired id too — repaired "200" (string) is an available base for stackParents [200] (number)', () => {
    const plan = planStackRebuild({
      repaired: '200',
      descendants: [{ item: 300, ref: 'lane/c', stackParents: [200], fileset: [] }],
    });
    expect(plan.order.map((s) => s.item)).toEqual([300]);
    expect(plan.order[0].onto).toBe(200); // onto reported in canonical asItemId form
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

  it('a non-SHA ontoSha (branch-controlled manifest content) is REFUSED before any git call — option-injection guard (#2396)', () => {
    for (const bad of ['--upload-pack=touch /tmp/pwn', 'origin/main', 'HEAD~1', 'abc123', 'g'.repeat(40)]) {
      const { run, calls } = scriptedRun({});
      const v = rebuildDescendant({ laneRef: 'lane/child', ontoSha: bad, run });
      expect(v.action).toBe('error');
      expect(v.reason).toMatch(/not a commit SHA/);
      expect(calls.length).toBe(0); // the crafted value never reaches git argv
    }
  });

  it('a non-lane laneRef (branch-controlled manifest content) is REFUSED before any git call — protected-branch / refspec-injection guard (#2396)', () => {
    for (const bad of ['main', 'refs/heads/main', '--upload-pack=touch /tmp/pwn', '+refs/heads/x:refs/heads/main', 'lane/x:refs/heads/main', 'lane/../main', 'lane/', 'lane/a b', 'origin/lane/child']) {
      const { run, calls } = scriptedRun({});
      const v = rebuildDescendant({ laneRef: bad, ontoSha: onto, run });
      expect(v.action).toBe('error');
      expect(v.reason).toMatch(/not a lane\/\* ref/);
      expect(calls.length).toBe(0); // the crafted value never reaches git argv
    }
  });

  it('accepts an abbreviated (7-40 hex) SHA, case-insensitive', () => {
    const { run } = scriptedRun({ 'git merge-tree': { status: 0, stdout: 'tree'.padEnd(40, '0') }, ...RESOLVE_PLUMBING, 'gh pr': { status: 0 } });
    expect(rebuildDescendant({ laneRef: 'lane/child', ontoSha: 'AbC1234', run }).action).toBe('rebased');
  });

  // IDEMPOTENCY (drain re-push churn bug) — a re-run of `rebuild` on an already-rebuilt-but-unlanded descendant
  // (tip already on the repaired tip, manifest-free) makes rebaseDropManifest short-circuit to `current`: nothing
  // minted, nothing pushed. rebuildDescendant must surface that verbatim (it is NOT a guided-conflict or error).
  it('an already-rebuilt, manifest-free descendant tip → action:current, no commit-tree/push', () => {
    const { run, calls } = scriptedRun({
      'git merge-tree': { status: 0, stdout: 'merged'.padEnd(40, '0') }, // clean merge onto the repaired tip
      ...RESOLVE_PLUMBING,                                               // write-tree → 'resolved'.padEnd(40,'0')
      'git merge-base': { status: 0 },                                  // the repaired tip IS an ancestor of the tip
      'git rev-parse': (args) => String(args[1]).endsWith('^{tree}')
        ? { status: 0, stdout: 'resolved'.padEnd(40, '0') }             // tip's tree already == the resolved tree
        : { status: 0, stdout: 'tipcommit'.padEnd(40, '0') },           // the tip's current commit sha
    });
    const v = rebuildDescendant({ laneRef: 'lane/child', ontoSha: onto, run });
    expect(v.action).toBe('current');
    expect(v.ontoSha).toBe(onto);
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  // The real bug the panel caught: the CLI `rebuild` subcommand mapped ONLY `rebased`→exit 0, so a `current`
  // verdict exited 2, which `/finish` reads as a guided-conflict/error and derails. Drive the actual CLI against
  // a real repo whose lane tip is genuinely already on `--onto` and manifest-free → rebaseDropManifest returns
  // `current` for real → assert exit 0. (Pre-fix this exited 2.) No branch/checkout — plumbing only, so the
  // global single-branch guard never fires.
  it('the `rebuild` CLI subcommand exits 0 (SUCCESS) on a `current` no-op, not 2', () => {
    const LR = join(process.cwd(), 'scripts', 'lane-resume.mjs');
    const repo = mkdtempSync(join(tmpdir(), 'lane-resume-current-'));
    const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      git('init', '-q');
      git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
      git('config', 'commit.gpgsign', 'false');
      writeFileSync(join(repo, 'a'), 'x\n');
      git('add', 'a'); git('commit', '-qm', 'seed');
      const onto = git('rev-parse', 'HEAD').trim();
      // Build a descendant lane tip (commit2, a child of onto, no manifest) via plumbing — NO branch/checkout.
      writeFileSync(join(repo, 'b'), 'y\n');
      git('add', 'b');
      const tree2 = git('write-tree').trim();
      const commit2 = git('commit-tree', tree2, '-p', onto, '-m', 'child').trim();
      git('update-ref', 'refs/heads/lane/child', commit2);
      git('restore', '--staged', 'b'); rmSync(join(repo, 'b'));
      git('remote', 'add', 'origin', repo); // self-remote so `git fetch origin lane/child` resolves
      let exit = 0, out = '';
      try { out = execFileSync('node', [LR, 'rebuild', 'lane/child', `--onto=${onto}`, '--json'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (e) { exit = e.status ?? 1; out = e.stdout || ''; }
      expect(exit).toBe(0);
      expect(JSON.parse(out).action).toBe('current'); // and it took the no-op path, not a real rebuild
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
});

describe('lane-resume — deriveLandedFromMain (#2396: stackParent landed status via positive on-main proof)', () => {
  const d = (item, stackParents) => ({ item, ref: `lane/${item}`, stackParents, fileset: [] });

  it('a numeric NNN parent is proven landed ONLY by a positive status:resolved-on-main record — never by construction', () => {
    const resolvedLookup = (n) => n === 300; // 300 resolved on main; anything else not
    const landed = deriveLandedFromMain([d(400, [300]), d(500, [2399])], { lookup: () => null, resolvedLookup });
    expect(landed.has(300)).toBe(true);   // positive proof → landed
    expect(landed.has(2399)).toBe(false); // numbered-yet-UNLANDED (e.g. a sibling batch lane still queued) → NOT landed
  });

  it('a numeric parent with NO on-main resolve is not landed — absence/id-format never reads as landed (fails closed)', () => {
    const landed = deriveLandedFromMain([d(400, [300])], { lookup: () => null, resolvedLookup: () => false });
    expect(landed.size).toBe(0);
  });

  it('a hash parent is landed ONLY on a positive bornAs-on-main record — absence is never read as landed', () => {
    const lookup = (h) => (h === 'xaaaaaa' ? '312' : null);
    const landed = deriveLandedFromMain([d(400, ['xaaaaaa']), d(500, ['xbbbbbb'])], { lookup, resolvedLookup: () => false });
    expect(landed.has('xaaaaaa')).toBe(true);  // bornAs record found → proven
    expect(landed.has('xbbbbbb')).toBe(false); // no record → NOT landed (the F5 stowaway guard)
  });

  it('a parent that is ITSELF in the rebuild set is never counted landed (it rebuilds this pass)', () => {
    const landed = deriveLandedFromMain([d(300, [200]), d(400, [300])], { lookup: () => null, resolvedLookup: () => true });
    expect(landed.has(300)).toBe(false); // 300 is a descendant being rebuilt, not a landed base
    expect(landed.has(200)).toBe(true);  // 200 is outside the set AND resolved on main → landed
  });

  it('a quoted-string numeric parent ("300") is normalized before proof and returned in canonical form', () => {
    const seen = [];
    const landed = deriveLandedFromMain([d(400, ['300'])], { lookup: () => null, resolvedLookup: (n) => { seen.push(n); return true; } });
    expect(seen).toEqual([300]);      // proof queried with the normalized number
    expect(landed.has(300)).toBe(true); // canonical form — planStackRebuild normalizes its side too
  });

  it('feeds planStackRebuild end-to-end: the derived set unblocks a descendant whose parent already landed', () => {
    const descendants = [d(400, [300])]; // 300 landed on main in a prior pass, absent from the rebuild set
    const plan = planStackRebuild({ repaired: 200, descendants, fixTouched: [], landed: deriveLandedFromMain(descendants, { lookup: () => null, resolvedLookup: (n) => n === 300 }) });
    expect(plan.order.map((s) => s.item)).toEqual([400]); // NOT deferred with an empty default set
    expect(plan.deferred).toHaveLength(0);
  });

  it('end-to-end deferral: a numeric parent with NO on-main resolve leaves its descendant deferred, never placed', () => {
    // The stowaway this pins: stackParents [2399] where #2399 is numbered but its lane is still queued —
    // the old landed-by-construction path placed the descendant and let it land past the unlanded parent.
    const descendants = [d(400, [2399])];
    const plan = planStackRebuild({ repaired: 200, descendants, fixTouched: [], landed: deriveLandedFromMain(descendants, { lookup: () => null, resolvedLookup: () => false }) });
    expect(plan.order).toHaveLength(0);
    expect(plan.deferred.map((s) => s.item)).toEqual([400]);
  });

  it('resolvedOnMain rejects a non-numeric id without touching git (fails closed)', () => {
    expect(resolvedOnMain('not-a-number')).toBe(false);
    expect(resolvedOnMain(null)).toBe(false);
  });

  it('resolvedOnMain reads status from the FRONTMATTER only — a body carrying a fenced `status: resolved` example never spoofs proof-of-land', () => {
    // The stowaway this pins: an OPEN item whose prose quotes a frontmatter example at column 0. A
    // whole-file grep reads it as landed → deriveLandedFromMain marks the unlanded stackParent landed →
    // planStackRebuild places its descendant past an unlanded parent. Real git repo, origin/main ref
    // pointed at HEAD (same fixture shape as lane-drain-numbering's landedNumberFor proof).
    const repo = mkdtempSync(join(tmpdir(), 'lane-resume-rom-'));
    const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      git('init', '-q');
      git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
      git('config', 'commit.gpgsign', 'false');
      mkdirSync(join(repo, 'backlog'));
      writeFileSync(join(repo, 'backlog/777-open-spoof.md'),
        '---\nkind: story\nstatus: open\n---\n# Open item\n\nExample frontmatter:\n\n```yaml\nstatus: resolved\n```\n');
      writeFileSync(join(repo, 'backlog/778-really-resolved.md'),
        '---\nkind: story\nstatus: resolved\n---\n# Landed item\n');
      git('add', 'backlog'); git('commit', '-qm', 'seed');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD'); // no real remote — point origin/main at HEAD
      expect(resolvedOnMain(777, repo)).toBe(false); // open + spoofed body → NOT landed (the F5 stowaway guard)
      expect(resolvedOnMain(778, repo)).toBe(true);  // genuinely resolved in frontmatter → landed
      expect(resolvedOnMain(999, repo)).toBe(false); // no file at all → fails closed
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });

  it('resolvedItemSet reads the SAME frontmatter-strict predicate as resolvedOnMain — both entry points agree on the spoof (#2455)', () => {
    // The unification #2455 pins: before it, discover's `resolvedItemSet` regex-matched `status: resolved`
    // anywhere in the first 400 bytes, so a fenced frontmatter example in an OPEN item's body read as a
    // LANDED blocker — while the same /finish pass's rebuild half (`resolvedOnMain`) correctly refused it.
    // One question, two answers. Now both route through `docIsResolved` (frontmatter-only), so the spoof
    // reads NOT resolved through BOTH entry points.
    const repo = mkdtempSync(join(tmpdir(), 'lane-resume-ris-'));
    const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      git('init', '-q');
      git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
      git('config', 'commit.gpgsign', 'false');
      mkdirSync(join(repo, 'backlog'));
      // 777: OPEN, but a column-0 `status: resolved` sits in the body within the first 400 bytes — the exact
      // shape the old loose reader mis-read as landed.
      writeFileSync(join(repo, 'backlog/777-open-spoof.md'),
        '---\nkind: story\nstatus: open\n---\n# Open item\n\nExample frontmatter:\n\n```yaml\nstatus: resolved\n```\n');
      // 778: genuinely resolved in the frontmatter.
      writeFileSync(join(repo, 'backlog/778-really-resolved.md'),
        '---\nkind: story\nstatus: resolved\n---\n# Landed item\n');
      git('add', 'backlog'); git('commit', '-qm', 'seed');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const set = resolvedItemSet(repo);
      expect(set.has(777)).toBe(false); // the spoof is NOT a landed blocker (this is the #2455 fix)
      expect(set.has(778)).toBe(true);  // the genuinely-resolved item IS
      // The two readers now answer identically for every item in the fixture — the whole point of #2455.
      for (const n of [777, 778, 999]) expect(set.has(n)).toBe(resolvedOnMain(n, repo));
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
});
