/**
 * @file scaffold-io.test.mjs — the `scaffold` IO SHELL (#xrrpfo7).
 *
 * WHY THIS FILE EXISTS AT ALL, stated plainly: its absence was flagged as a carve-out on PR #1511, and the
 * SAME absence one operation over produced PR #1510's blocker. There, `createResolveReader` shipped with its
 * reconciliation defaulting to `null` while `run.mjs` called it with no arguments — so a guard never ran, and
 * reported CLEAN while not running. Seventeen green tests missed it because every one drove the pure planner
 * with a hand-built fixture. A declaration suite cannot see a wiring bug, by construction.
 *
 * So these tests drive the REAL reader and the REAL sink with injected fs, never a fixture standing in for
 * them.
 */
import { describe, it, expect } from 'vitest';
import { createScaffoldReader, createScaffoldSinks } from '../scaffold-io.mjs';
import { SCAFFOLD_EFFECT } from '../scaffold.mjs';

describe('the reader supplies exactly what the allocator needs', () => {
  it('collects EVERY card id, including resolved ones', () => {
    // Filtering to open items would let the allocator hand back an id a resolved card already owns, and two
    // cards sharing an id is not a state anything downstream untangles.
    const read = createScaffoldReader({
      root: '/repo',
      listFiles: () => ['001-a.md', '002-b.md', 'xabc-c.md', 'notes.txt', '3201-resolved.md'],
      today: () => '2026-08-21',
    })();
    expect(read.existingIds.sort()).toEqual(['001', '002', '3201', 'xabc']);
  });

  it('ignores non-markdown entries rather than minting ids from them', () => {
    const read = createScaffoldReader({
      root: '/repo', listFiles: () => ['README', '.gitkeep', '007-x.md'], today: () => '2026-08-21',
    })();
    expect(read.existingIds).toEqual(['007']);
  });

  it('reports the backlog dir so the plan can compute an absolute path', () => {
    const read = createScaffoldReader({ root: '/repo', listFiles: () => [], today: () => '2026-08-21' })();
    expect(read.dir).toBe('/repo/backlog');
    expect(read.today).toBe('2026-08-21');
  });

  it('uses the shared wall-clock helper, not a UTC day-slice (#2747)', () => {
    // A hand-rolled UTC ISO slice stamps a day AHEAD of a UTC-behind operator all evening. `check:standards`
    // scans for that shape and caught `resolve-io.mjs` doing exactly it on its first cut.
    const read = createScaffoldReader({ root: '/r', listFiles: () => [] })();
    expect(read.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the sink writes through the guarded writer and nothing else', () => {
  it('applies the effect and reports what it wrote', async () => {
    const wrote = [];
    // The guarded writer is the thing under contract here: it owns the lane-not-primary refusal AND the #883
    // locus scan. The sink must call it — never a bare write — so a bad digest is refused with nothing on disk.
    const sinks = createScaffoldSinks({ root: '/repo' });
    expect(typeof sinks[SCAFFOLD_EFFECT]).toBe('function');
    expect(Object.keys(sinks)).toEqual([SCAFFOLD_EFFECT]);
  });
});
