// Guards the unblock-leverage derivation (#254) — NOT magic numbers (the backlog changes daily). The
// point of this file: prove that however the backlog grows, the reverse-dependency edges and the
// leverage scores the Prioritisation tab ranks by stay internally consistent and deterministic.
// See src/_data/backlog.js (the `dependentsByNum` / leverage pass) + backlog/254-*.md.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loadBacklog = require('../backlog.js');

const items = loadBacklog();
const byNum = new Map<string, any>(items.map((i: any) => [i.num, i]));

describe('backlog unblock-leverage — derivation invariants', () => {
  it('every item carries the derived leverage fields with sane types', () => {
    for (const i of items) {
      expect(Array.isArray(i.dependents)).toBe(true);
      expect(typeof i.directUnblocks).toBe('number');
      expect(typeof i.transitiveUnblocks).toBe('number');
      expect(typeof i.unblocksToReady).toBe('number');
      expect(typeof i.leverageScore).toBe('number');
    }
  });

  it('dependents is the exact inverse of blockedBy (A blockedBy B ⇒ A ∈ B.dependents)', () => {
    for (const a of items) {
      for (const b of a.blockers) {
        const prereq = byNum.get(b.num);
        expect(prereq.dependents.some((d: any) => d.num === a.num)).toBe(true);
      }
    }
    // …and nothing extra: every dependent edge corresponds to a real blockedBy edge.
    for (const b of items) {
      for (const dep of b.dependents) {
        const a = byNum.get(dep.num);
        expect(a.blockers.some((x: any) => x.num === b.num)).toBe(true);
      }
    }
  });

  it('counts nest correctly: unblocksToReady ≤ directUnblocks ≤ transitiveUnblocks', () => {
    for (const i of items) {
      expect(i.unblocksToReady).toBeLessThanOrEqual(i.directUnblocks);
      expect(i.directUnblocks).toBeLessThanOrEqual(i.transitiveUnblocks);
    }
  });

  it('directUnblocks counts exactly the OPEN direct dependents', () => {
    for (const i of items) {
      const openDirect = i.dependents.filter((d: any) => d.status === 'open').length;
      expect(i.directUnblocks).toBe(openDirect);
    }
  });

  it('leverageScore is the documented composite (transitive-dominant, direct tiebreak)', () => {
    for (const i of items) {
      expect(i.leverageScore).toBe(i.transitiveUnblocks * 1000 + i.directUnblocks);
    }
  });

  it('unblocksToReady only ever names open non-decision dependents this is the last open blocker for', () => {
    for (const i of items) {
      const flips = i.dependents
        .filter((d: any) => d.status === 'open')
        .map((d: any) => byNum.get(d.num))
        .filter((dep: any) => dep.kind !== 'decision'
          && dep.blockers.every((b: any) => b.status === 'resolved' || b.num === i.num));
      expect(i.unblocksToReady).toBe(flips.length);
    }
  });

  it('is deterministic — a second load produces identical leverage fields', () => {
    const again = loadBacklog();
    const pick = (arr: any[]) => arr.map((i: any) =>
      `${i.num}:${i.directUnblocks}:${i.transitiveUnblocks}:${i.unblocksToReady}:${i.leverageScore}`).sort();
    expect(pick(again)).toEqual(pick(items));
  });
});
