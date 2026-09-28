import { describe, it, expect } from 'vitest';
import {
  BUILD_DISPATCH_POLICY, parseScopeEntry, pathsOverlap, firstScopeOverlap, branchRefPolicy, plannedBuildRef,
  prDeliversNum, normalizeOpenPrs, planBuildDispatch,
} from '../build-dispatch-policy.mjs';

const cand = (num, scope) => ({ num, lane: null, scope });
const pr = (repo, number, files = [], labels = [], headRefName = 'lane/other-x') => ({ repo, number, files: files.map((p) => ({ repo, path: p })), labels, headRefName });

describe('scope helpers', () => {
  it('parses repo-qualified entries, defaulting to we and folding plateau → plateau-app', () => {
    expect(parseScopeEntry('plateau-app:src/a.ts')).toEqual({ repo: 'plateau-app', path: 'src/a.ts' });
    expect(parseScopeEntry('plateau:src/a.ts')).toEqual({ repo: 'plateau-app', path: 'src/a.ts' });
    expect(parseScopeEntry('scripts/x.mjs')).toEqual({ repo: 'we', path: 'scripts/x.mjs' });
    expect(parseScopeEntry('  ')).toBeNull();
  });
  it('overlaps on equal paths and directory prefixes only at segment boundaries', () => {
    expect(pathsOverlap('src/a.ts', 'src/a.ts')).toBe(true);
    expect(pathsOverlap('src/', 'src/a.ts')).toBe(true);
    expect(pathsOverlap('src/a', 'src/ab.ts')).toBe(false);
  });
  it('never overlaps across repos', () => {
    expect(firstScopeOverlap(['we:src/a.ts'], ['plateau-app:src/a.ts'])).toBeNull();
    expect(firstScopeOverlap(['plateau-app:src/a.ts'], [{ repo: 'plateau-app', path: 'src/a.ts' }])).toBe('plateau-app:src/a.ts');
  });
});

describe('branch-name rule', () => {
  it('refuses a ref that starts with a bare number and accepts the lane/ delivery ref', () => {
    expect(branchRefPolicy('2385-foo').ok).toBe(false);
    expect(branchRefPolicy(plannedBuildRef('2385')).ok).toBe(true);
    expect(plannedBuildRef('#042')).toBe('lane/42-build');
  });
  it('matches a delivering PR by its leading num only', () => {
    expect(prDeliversNum({ headRefName: 'lane/2385-ssr' }, '2385')).toBe(true);
    expect(prDeliversNum({ headRefName: 'lane/2385b-ssr' }, '2385')).toBe(true);
    expect(prDeliversNum({ headRefName: 'lane/23850-ssr' }, '2385')).toBe(false);
    expect(prDeliversNum({ headRefName: 'lane/xcd92xh-x' }, 'xcd92xh')).toBe(true);
    expect(prDeliversNum({ headRefName: 'lane/draft-first-prs' }, '2385')).toBe(false);
  });
});

describe('planBuildDispatch', () => {
  it('caps concurrent builds, counting durable in-flight work', () => {
    const r = planBuildDispatch({
      candidates: [cand('1', ['we:a']), cand('2', ['we:b']), cand('3', ['we:c'])],
      inFlight: [{ num: '9', scope: ['we:z'], source: 'claim' }],
      policy: { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: 3 },
    });
    expect(r.dispatch.map((x) => x.num)).toEqual(['1', '2']);
    expect(r.hold).toEqual([expect.objectContaining({ num: '3', rule: 'cap' })]);
  });
  it('counts the tick core\'s own building tally without double counting', () => {
    const r = planBuildDispatch({ candidates: [cand('1', ['we:a']), cand('2', ['we:b'])], externalBuilding: 2 });
    expect(r.dispatch.map((x) => x.num)).toEqual(['1']);
  });
  it('freezes on too many open PRs or the operator\'s manual daemon-bug flag', () => {
    const many = Array.from({ length: 13 }, (_, i) => pr('we', i + 1));
    expect(planBuildDispatch({ candidates: [cand('1', ['we:a'])], openPrs: many }).hold[0].rule).toBe('landing-freeze');
    const stuck = planBuildDispatch({ candidates: [cand('1', ['we:a'])], openPrs: [pr('we', 5, [], ['blocked:daemon-bug'])] });
    expect(stuck.freeze.frozen).toBe(true);
    expect(stuck.hold[0].reason).toMatch(/we#5 is labelled blocked:daemon-bug/);
  });

  // LIVE INCIDENT, we#2852, 2026-09-28: a single PR mislabelled `review-status:ci-heal-stalled` (root cause:
  // we:scripts/conveyor/review-status-tag.mjs read a genuinely FINISHED ci-heal session as stalled) froze EVERY
  // queued build via this exact `freezeSet`/`frozen` gate, unrelated scope or not — `build-dispatch-daemon.mjs
  // --dry-run` showed `dispatch: []` for candidates with disjoint scope from #2852. A per-PR `*-stalled` label
  // (fix/ci-heal/review) must never freeze the whole queue: it is informative/derived, not an operator decision
  // (`blocked:daemon-bug`, tested above, is the only label that still does). This pins the RED/GREEN shape of
  // that fix: a disjoint-scope candidate dispatches, an overlapping one still correctly waits — via the ordinary
  // `scope-vs-open-prs` rule, which already runs per-candidate against every open PR unconditionally.
  it('a per-PR *-stalled label never freezes the whole queue — only scope-vs-open-prs holds an overlapping candidate', () => {
    const stalledPr = pr('we', 2852, ['scripts/conveyor/build-dispatch-policy.mjs'], ['review-status:ci-heal-stalled']);
    const r = planBuildDispatch({
      candidates: [cand('4360', ['we:scripts/conveyor/review-status-tag.mjs']), cand('4361', ['we:scripts/conveyor/build-dispatch-policy.mjs'])],
      openPrs: [stalledPr],
    });
    expect(r.freeze.frozen).toBe(false);
    expect(r.dispatch.map((x) => x.num)).toEqual(['4360']);
    expect(r.hold.find((h) => h.num === '4361')).toMatchObject({ rule: 'scope-vs-open-prs' });
    expect(r.hold.find((h) => h.num === '4361').reason).toMatch(/we#2852/);
  });

  it('review-stalled and fix-stalled are the same non-freezing shape as ci-heal-stalled', () => {
    for (const label of ['review-status:review-stalled', 'review-status:fix-stalled']) {
      const r = planBuildDispatch({ candidates: [cand('1', ['we:unrelated.mjs'])], openPrs: [pr('we', 9, ['other/file.ts'], [label])] });
      expect(r.freeze.frozen).toBe(false);
      expect(r.dispatch.map((x) => x.num)).toEqual(['1']);
    }
  });

  it('globalFreezeLabels declares exactly blocked:daemon-bug — the three *-stalled labels stay in freezeLabels only for display', () => {
    expect(BUILD_DISPATCH_POLICY.globalFreezeLabels).toEqual(['blocked:daemon-bug']);
    expect(BUILD_DISPATCH_POLICY.freezeLabels).toEqual([
      'review-status:fix-stalled', 'review-status:ci-heal-stalled', 'review-status:review-stalled', 'blocked:daemon-bug',
    ]);
  });
  it('the kill switch freezes everything', () => {
    const r = planBuildDispatch({ candidates: [cand('1', ['we:a'])], killSwitch: { engaged: true, reason: 'test' } });
    expect(r.dispatch).toEqual([]);
    expect(r.hold[0].reason).toMatch(/kill switch/);
  });
  it('holds a build whose scope touches an open PR\'s files', () => {
    const r = planBuildDispatch({ candidates: [cand('1', ['we:scripts/conveyor/runner.mjs'])], openPrs: [pr('we', 2813, ['scripts/conveyor/runner.mjs'])] });
    expect(r.hold[0]).toMatchObject({ rule: 'scope-vs-open-prs' });
    expect(r.hold[0].reason).toMatch(/we#2813/);
  });
  it('serialises hot files: against in-flight builds and within one tick', () => {
    const r = planBuildDispatch({
      candidates: [cand('1', ['plateau-app:src/main.ts']), cand('2', ['plateau-app:src/main.ts', 'plateau-app:src/x.ts']), cand('3', ['we:q'])],
      inFlight: [{ num: '7', scope: ['we:q'], source: 'claim' }],
    });
    expect(r.dispatch.map((x) => x.num)).toEqual(['1']);
    expect(r.hold.find((h) => h.num === '2')).toMatchObject({ rule: 'hot-file' });
    expect(r.hold.find((h) => h.num === '3').reason).toMatch(/#7/);
  });
  it('holds an item already in flight or already delivered by an open PR', () => {
    const r = planBuildDispatch({
      candidates: [cand('7', ['we:a']), cand('8', ['we:b'])],
      inFlight: [{ num: '7', scope: ['we:a'], source: 'claim' }],
      openPrs: [pr('we', 99, [], [], 'lane/8-thing')],
    });
    expect(r.dispatch).toEqual([]);
    expect(r.hold.map((h) => h.rule)).toEqual(['in-flight', 'in-flight']);
  });
  it('refuses to dispatch an unscoped item (cannot prove disjointness)', () => {
    expect(planBuildDispatch({ candidates: [cand('1', [])] }).hold[0].rule).toBe('scope-vs-open-prs');
  });
  it('normalizes open PRs from the gh shape', () => {
    expect(normalizeOpenPrs([{ repo: 'we', prs: [{ number: 1, headRefName: 'lane/1-x', labels: [{ name: 'l' }], files: [{ path: 'a' }] }] }]))
      .toEqual([{ repo: 'we', number: 1, headRefName: 'lane/1-x', labels: ['l'], files: [{ repo: 'we', path: 'a' }] }]);
  });
  it('declares every operator rule with who enforces it', () => {
    expect(BUILD_DISPATCH_POLICY.rules.map((r) => r.id)).toEqual(['cap', 'landing-freeze', 'scope-vs-open-prs', 'hot-file', 'branch-name', 'scratch-prefix', 'draft-first']);
    expect(BUILD_DISPATCH_POLICY.maxConcurrentBuilds).toBe(3);
  });
});
