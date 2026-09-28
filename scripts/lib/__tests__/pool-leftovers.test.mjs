/**
 * @file pool-leftovers.test.mjs — #4272: `newestMtime` must not judge a leftover directory's activity from its
 * top-level entries alone. A directory whose ancestor levels have all gone stale but which holds a genuinely
 * fresh file several levels down must still be classified as recently active — otherwise `sweepPoolLeftovers`
 * `rmSync`s the whole tree, including that fresh file, with no salvage step (unrecoverable data loss).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { sweepPoolLeftovers, LEFTOVER_MAX_AGE_DAYS } from '../pool-leftovers.mjs';

describe('sweepPoolLeftovers — nested-mtime activity detection (real filesystem)', () => {
  let poolDir;
  let salvageRoot;

  beforeEach(() => {
    poolDir = mkdtempSync(join(tmpdir(), 'pool-leftovers-test-'));
    salvageRoot = mkdtempSync(join(tmpdir(), 'pool-leftovers-salvage-'));
  });

  afterEach(() => {
    rmSync(poolDir, { recursive: true, force: true });
    rmSync(salvageRoot, { recursive: true, force: true });
  });

  it('keeps (never deletes) a scratch dir whose top-level entries are stale but a deeply nested file is fresh', () => {
    const nowMs = Date.now();
    const oldMs = nowMs - (LEFTOVER_MAX_AGE_DAYS + 3) * 24 * 60 * 60 * 1000;
    const old = new Date(oldMs);

    const dir = join(poolDir, 'scratch-old-top-fresh-deep');
    const midA = join(dir, 'a');
    const midB = join(midA, 'b');
    const nested = join(midB, 'c');
    mkdirSync(nested, { recursive: true });

    const topFile = join(dir, 'top.txt');
    writeFileSync(topFile, 'old\n');
    const deepFile = join(nested, 'deep.txt');
    writeFileSync(deepFile, 'fresh\n'); // written last — stays at its natural "now" mtime below

    // Age the directory itself and every ancestor/top-level entry PAST the retention window. The deepest
    // file is deliberately left untouched, so it is the only genuinely fresh thing in the whole tree.
    for (const p of [dir, topFile, midA, midB, nested]) utimesSync(p, old, old);

    const result = sweepPoolLeftovers({ poolDir, pool: 'test-pool', dryRun: false, nowMs, salvageRoot });

    const action = result.actions.find((a) => a.name === 'scratch-old-top-fresh-deep');
    expect(action?.action).toBe('keep');
    expect(existsSync(deepFile)).toBe(true); // the fresh file must never be swept — proves no data was lost
  });

  it('still deletes a scratch dir that is stale all the way down (no fresh activity anywhere)', () => {
    const nowMs = Date.now();
    const oldMs = nowMs - (LEFTOVER_MAX_AGE_DAYS + 3) * 24 * 60 * 60 * 1000;
    const old = new Date(oldMs);

    const dir = join(poolDir, 'scratch-fully-stale');
    const nested = join(dir, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    const deepFile = join(nested, 'deep.txt');
    writeFileSync(deepFile, 'stale\n');

    for (const p of [dir, join(dir, 'a'), join(dir, 'a', 'b'), nested, deepFile]) utimesSync(p, old, old);

    const result = sweepPoolLeftovers({ poolDir, pool: 'test-pool', dryRun: false, nowMs, salvageRoot });

    const action = result.actions.find((a) => a.name === 'scratch-fully-stale');
    expect(action?.action).toBe('delete');
    expect(existsSync(dir)).toBe(false);
  });
});
