import { describe, it, expect } from 'vitest';
import { classifyLane, orderByBlockedBy } from '../lane-resume.mjs';

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
