/**
 * @file scripts/lib/__tests__/nnn-collision-heal.test.mjs
 * @description Proof of the shared merge-TIME NNN-collision self-heal (#2222) — the pre-check analogue of the
 *   drain's rebase-drop. The pure PLAN is decided here (collision-on-base ⇒ renumber the incoming new item to a
 *   free GAP id below the max+1 frontier, rewrite inbound refs; no-collision ⇒ untouched); the git plumbing is
 *   the injected-`run` I/O boundary, its SEQUENCE (detect cheaply, then read/rebuild only on a real collision)
 *   asserted with a scripted runner.
 */
import { describe, it, expect } from 'vitest';
import { allocateGapId } from '../../backlog/renumber-collisions.mjs';
import { planBaseCollisionHeal, backlogBasenames, healNnnCollision } from '../nnn-collision-heal.mjs';

const mk = (num, slug, body = '') => ({
  name: `${num}-${slug}.md`,
  text: `---\nkind: story\nsize: 3\nstatus: active\ndateOpened: "2026-07-04"\ntags: []\n---\n\n# ${slug}\n\n${body}\n`,
});

describe('allocateGapId (#2222 — a GAP below the max+1 frontier a concurrent scaffold owns)', () => {
  it('takes the highest free slot below max, not max+1', () => {
    // used 2218,2219,2221 → the hole nearest the frontier is 2220 (2222 is what a scaffold would grab).
    expect(allocateGapId(new Set(['2218', '2219', '2221']))).toBe('2220');
  });
  it('never re-uses a base id, and skips an already-allocated gap', () => {
    // max 2224; 2223 is the highest free slot below it (2220 base-owned, 2221/2222 used).
    expect(allocateGapId(new Set(['2218', '2221', '2222', '2224']), new Set(), new Set(['2220', '2219']))).toBe('2223');
    // 2223 is the highest free slot below max 2224 (2220 already handed out this plan).
    expect(allocateGapId(new Set(['2218', '2219', '2221', '2222', '2224']), new Set(['2220']), new Set())).toBe('2223');
  });
  it('a range dense at the top has no hole below max → falls back to the frontier (max+1)', () => {
    expect(allocateGapId(new Set(['2218', '2219', '2220']))).toBe('2221');
  });
  it('keeps zero-padding to the widest id', () => {
    expect(allocateGapId(new Set(['007', '009']))).toBe('008');
  });
});

describe('backlogBasenames', () => {
  it('extracts NNN-slug.md basenames from ls-tree output (with or without the backlog/ prefix)', () => {
    expect(backlogBasenames('backlog/2218-a.md\nbacklog/2219-b-c.md\nREADME.md')).toEqual(['2218-a.md', '2219-b-c.md']);
    expect(backlogBasenames('2218-a.md\n')).toEqual(['2218-a.md']);
    expect(backlogBasenames('')).toEqual([]);
  });
});

describe('planBaseCollisionHeal — collision on base ⇒ renumber-to-gap', () => {
  it('renumbers the incoming lane new-item to a GAP id and rewrites inbound refs; the base file is untouched', () => {
    // Base carries #2219 (a DIFFERENT item) plus a 2220 hole. The lane authored its OWN #2219 (drain finding),
    // colliding on the number, and another lane item references it via every shape.
    const laneFiles = [
      mk('2219', 'drain-finding', 'the storm-collision finding'),
      {
        name: '1800-refs.md',
        text: 'see #2219 and /backlog/2219/ and /backlog/2219-drain-finding/\nblockedBy: [2219]\n',
      },
    ];
    const plan = planBaseCollisionHeal(laneFiles, {
      baseNums: ['2218', '2219', '2221'],                 // 2220 is a free interior gap
      baseNames: ['2218-x.md', '2219-existing-item.md', '2221-z.md'],
    });
    expect(plan.collisions).toHaveLength(1);
    const mv = plan.collisions[0];
    expect(mv.oldNum).toBe('2219');
    expect(mv.newNum).toBe('2220');                       // a GAP below the 2222 frontier, not max+1
    expect(mv.oldName).toBe('2219-drain-finding.md');
    expect(mv.newName).toBe('2220-drain-finding.md');
    expect(plan.deletes).toEqual(['2219-drain-finding.md']);
    // the referencing lane file now points at the gap id
    const ref = plan.writes.find((w) => w.name === '1800-refs.md');
    expect(ref.text).toContain('#2220');
    expect(ref.text).toContain('/backlog/2220/');
    expect(ref.text).toContain('/backlog/2220-drain-finding/');
    expect(ref.text).toContain('blockedBy: [2220]');
    // the yielded file is re-filed under its new name
    expect(plan.writes.map((w) => w.name)).toContain('2220-drain-finding.md');
  });

  it('two incoming collisions get distinct gap ids (no re-collision within the plan)', () => {
    const laneFiles = [mk('2219', 'a'), mk('2221', 'b')];
    const plan = planBaseCollisionHeal(laneFiles, {
      baseNums: ['2218', '2219', '2221', '2225'],         // holes: 2220, 2222, 2223, 2224
      baseNames: ['2218-x.md', '2219-keep.md', '2221-keep.md', '2225-z.md'],
    });
    const newNums = plan.collisions.map((c) => c.newNum);
    expect(new Set(newNums).size).toBe(2);
    expect(newNums).toEqual(['2224', '2223']);            // the two highest gaps below max (distinct, no re-collision)
  });
});

describe('planBaseCollisionHeal — no collision ⇒ untouched', () => {
  it('a lane new-item with a fresh id (not on base) is left alone', () => {
    const laneFiles = [mk('2230', 'fresh-item', 'no clash')];
    const plan = planBaseCollisionHeal(laneFiles, { baseNums: ['2218', '2219'], baseNames: ['2218-x.md', '2219-y.md'] });
    expect(plan.collisions).toEqual([]);
    expect(plan.writes).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.summary).toMatch(/no-op/i);
  });
  it('a lane file that IS the base file (same num AND same name) is a keeper, never yielded', () => {
    const laneFiles = [mk('2219', 'existing-item', 'edited on the lane')];
    const plan = planBaseCollisionHeal(laneFiles, { baseNums: ['2219'], baseNames: ['2219-existing-item.md'] });
    expect(plan.collisions).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });
});

// A scripted `run` that returns canned results per git subcommand and records the call sequence.
function scriptedRun(script) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts?.env, input: opts?.input });
    const key = args[0];
    const handler = script[key];
    const res = typeof handler === 'function' ? handler(args, opts) : handler;
    return { status: 0, stdout: '', stderr: '', ...(res || {}) };
  };
  return { run, calls };
}

describe('healNnnCollision — git boundary sequence', () => {
  it('no collision → action:none, reads NOTHING beyond the two ls-trees (cheap common path)', () => {
    const { run, calls } = scriptedRun({
      fetch: { status: 0 },
      'ls-tree': (args) => ({ status: 0, stdout: args.includes('origin/main') ? 'backlog/2218-a.md\nbacklog/2219-b.md\n' : 'backlog/2230-fresh.md\n' }),
    });
    const r = healNnnCollision({ laneRef: 'lane/x-2222', run });
    expect(r.action).toBe('none');
    // never paid to read file contents / rebuild
    expect(calls.some((c) => c.args[0] === 'cat-file')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('collision → rebuilds a renumbered tip and pushes it to the bare lane ref', () => {
    const laneName = '2219-drain-finding.md';
    const { run, calls } = scriptedRun({
      fetch: { status: 0 },
      'ls-tree': (args) => ({ status: 0, stdout: args.includes('origin/main') ? 'backlog/2218-a.md\nbacklog/2219-existing.md\nbacklog/2221-c.md\n' : `backlog/${laneName}\n` }),
      'cat-file': { status: 0, stdout: mk('2219', 'drain-finding', 'x').text },
      'read-tree': { status: 0 },
      'hash-object': { status: 0, stdout: 'b'.repeat(40) + '\n' },
      'update-index': { status: 0 },
      rm: { status: 0 },
      'write-tree': { status: 0, stdout: 'tree'.padEnd(40, '0') + '\n' },
      'commit-tree': { status: 0, stdout: 'newCommit'.padEnd(40, '0') + '\n' },
      push: { status: 0 },
    });
    const r = healNnnCollision({ laneRef: 'lane/x-2222', run });
    expect(r.action).toBe('rebased');
    expect(r.renumbered).toEqual([{ oldNum: '2219', newNum: '2220', oldName: laneName, newName: '2220-drain-finding.md' }]);
    // commit-tree parents the lane tip (single parent → push is a fast-forward).
    const ct = calls.find((c) => c.args[0] === 'commit-tree');
    expect(ct.args.slice(0, 5)).toEqual(['commit-tree', 'tree'.padEnd(40, '0'), '-p', 'origin/lane/x-2222', '-m']);
    // pushes the rebuilt commit to the BARE lane ref (guard-safe, no checkout).
    const push = calls.find((c) => c.args[0] === 'push');
    expect(push.args).toEqual(['push', 'origin', 'newCommit'.padEnd(40, '0') + ':refs/heads/lane/x-2222']);
    // the new blob was written to a TEMP index (GIT_INDEX_FILE set on update-index), never the working tree.
    const up = calls.find((c) => c.args[0] === 'update-index');
    expect(up.env?.GIT_INDEX_FILE).toBeTruthy();
  });

  it('no laneRef → error', () => {
    expect(healNnnCollision({ run: () => ({ status: 0 }) }).action).toBe('error');
  });

  it('a failed fetch → error, no ls-tree/push', () => {
    const { run, calls } = scriptedRun({ fetch: { status: 1, stderr: 'fatal: no ref' } });
    const r = healNnnCollision({ laneRef: 'lane/gone', run });
    expect(r.action).toBe('error');
    expect(r.reason).toMatch(/fetch/);
    expect(calls.some((c) => c.args[0] === 'ls-tree')).toBe(false);
  });
});
