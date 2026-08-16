/**
 * @file scaffold.test.mjs — proof of the backlog id allocator (#2292): a NEW item takes a RANDOM free number
 *   within the existing range (a gap below the max) rather than deterministic max+1, so two lanes branching
 *   off the same main rarely pick the same NNN (the race that double-landed #2316) — with a max+1 fallback
 *   when the range is gap-free. `rng` is injected so the choice is deterministic under test.
 */
import { describe, it, expect } from 'vitest';
import { nextNum, pad3, slugify, normalizeScope, renderItem } from '../scaffold.mjs';

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

describe('normalizeScope — coarse, prefix-shaped touch-set the readiness flow authors (#2619)', () => {
  it('trims each entry and drops empties/whitespace', () => {
    expect(normalizeScope([' we:scripts/backlog/scaffold.mjs ', '', '   '])).toEqual([
      'we:scripts/backlog/scaffold.mjs',
    ]);
  });
  it('dedupes while preserving first-seen order (a set, not a sort)', () => {
    expect(normalizeScope(['we:b', 'we:a', 'we:b', 'we:a'])).toEqual(['we:b', 'we:a']);
  });
  it('collapses entries that differ only by surrounding whitespace', () => {
    expect(normalizeScope(['we:a', ' we:a '])).toEqual(['we:a']);
  });
  it('non-array / nullish → []', () => {
    expect(normalizeScope(undefined)).toEqual([]);
    expect(normalizeScope(null)).toEqual([]);
    expect(normalizeScope('we:a')).toEqual([]);
  });
});

describe('renderItem — predicted scope: frontmatter (#2619)', () => {
  const base = { kind: 'story', size: 3, slug: 'x', title: 'X', today: '2026-07-27' };
  it('emits an inline scope: array, normalized (deduped/trimmed) in author order', () => {
    const out = renderItem({ ...base, scope: [' we:scripts/backlog/scaffold.mjs ', 'we:skills-src/split-backlog-item/', 'we:scripts/backlog/scaffold.mjs'] });
    expect(out).toContain('scope: ["we:scripts/backlog/scaffold.mjs", "we:skills-src/split-backlog-item/"]');
  });
  it('omits scope: entirely when no touch-set is given (unscoped item)', () => {
    expect(renderItem(base)).not.toContain('scope:');
    expect(renderItem({ ...base, scope: [] })).not.toContain('scope:');
    expect(renderItem({ ...base, scope: ['  '] })).not.toContain('scope:');
  });
});

describe('renderItem — `## Done when` skeleton (#2949)', () => {
  const base = { kind: 'story', size: 3, slug: 'x', title: 'X', today: '2026-07-27' };
  it('appends a `## Done when` heading with an `**Executable**` TODO line after the digest', () => {
    const out = renderItem(base);
    expect(out).toContain('## Done when');
    expect(out).toMatch(/\*\*Executable\*\*/);
    // digest paragraph comes before the heading, not after
    expect(out.indexOf('TODO digest')).toBeLessThan(out.indexOf('## Done when'));
  });
});
