/**
 * @file scripts/lib/__tests__/duplicate-id-tripwire.test.mjs
 * @description Unit proof of the post-land duplicate-NNN tripwire (#2318) — the impossible-or-LOUD guarantee
 * that a duplicate numeric id can never sit silently on main (the #2316 double-land failure mode).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findDuplicateIds, summarizeDuplicates } from '../duplicate-id-tripwire.mjs';

describe('findDuplicateIds (#2318)', () => {
  let dir;
  const write = (...names) => names.forEach((n) => writeFileSync(join(dir, n), 'x'));
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'dup-tripwire-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('flags a numeric id carried by two files (the #2316 double-land)', () => {
    write('2316-alpha.md', '2316-beta.md', '2317-gamma.md');
    expect(findDuplicateIds(dir)).toEqual([{ num: '2316', names: ['2316-alpha.md', '2316-beta.md'] }]);
  });

  it('is clean when every numeric id is unique', () => {
    write('2314-a.md', '2315-b.md', '2316-c.md');
    expect(findDuplicateIds(dir)).toEqual([]);
  });

  it('never flags provisional hash ids — a hash is globally unique by construction (#2288)', () => {
    write('x7k2q9a-a.md', 'x7k2q9b-b.md', 'xbb000a-c.md');
    expect(findDuplicateIds(dir)).toEqual([]);
  });

  it('ignores non-backlog / non-md entries', () => {
    write('2316-a.md', '2316-b.md', 'README', '.gitignore', 'notes.txt');
    expect(findDuplicateIds(dir)).toHaveLength(1);
  });

  it('reports multiple collided ids, sorted ascending', () => {
    write('2316-a.md', '2316-b.md', '2100-x.md', '2100-y.md');
    const dups = findDuplicateIds(dir);
    expect(dups.map((d) => d.num)).toEqual(['2100', '2316']);
  });

  it('returns [] for a missing directory (never throws from a tripwire)', () => {
    expect(findDuplicateIds(join(dir, 'does-not-exist'))).toEqual([]);
  });

  it('summarizeDuplicates renders a loud one-liner', () => {
    write('2316-a.md', '2316-b.md');
    expect(summarizeDuplicates(findDuplicateIds(dir))).toBe('#2316 (2316-a.md + 2316-b.md)');
  });
});
