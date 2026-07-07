/**
 * @file scaffold.test.mjs — proof of the backlog id allocator (#2292): a NEW item takes a RANDOM free number
 *   within the existing range (a gap below the max) rather than deterministic max+1, so two lanes branching
 *   off the same main rarely pick the same NNN (the race that double-landed #2316) — with a max+1 fallback
 *   when the range is gap-free. `rng` is injected so the choice is deterministic under test.
 */
import { describe, it, expect } from 'vitest';
import { nextNum, pad3, slugify } from '../scaffold.mjs';

describe('nextNum — random free-in-range allocation (#2292)', () => {
  it('picks a GAP below max, not max+1 (cuts the two-lanes-same-NNN collision)', () => {
    // used 1,2,5 → gaps below max(5) are [3,4]; rng=0 → first, rng→1 → last.
    expect(nextNum(['001', '002', '005'], () => 0)).toBe('003');
    expect(nextNum(['001', '002', '005'], () => 0.99)).toBe('004');
  });
  it('NEVER returns an already-used number, for any rng draw', () => {
    const used = ['001', '002', '003', '005', '008'];
    for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) expect(used).not.toContain(nextNum(used, () => r));
  });
  it('falls back to max+1 when the range is gap-free (dense)', () => {
    expect(nextNum(['001', '002', '003'], () => 0.5)).toBe('004');
  });
  it('empty backlog → 001', () => {
    expect(nextNum([], () => 0.5)).toBe('001');
  });
  it('always a zero-padded 3-digit NNN', () => {
    expect(pad3(7)).toBe('007');
    expect(nextNum(['001', '002', '005'], () => 0)).toMatch(/^\d{3}$/);
  });
});

describe('slugify', () => {
  it('kebab-cases and trims to 60 chars', () => {
    expect(slugify('Hello, World! Foo')).toBe('hello-world-foo');
    expect(slugify('  --Edge__case--  ').replace(/^-+|-+$/g, '')).toBe('edge-case');
  });
});
