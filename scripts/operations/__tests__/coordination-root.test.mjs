/** #3383 — Shared defaults must survive moving the calling checkout. */
import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { resolveCoordinationRoot, coordinationPaths } from '../coordination-root.mjs';
import { resolveRunsDir } from '../run-store.mjs';
describe('coordination root', () => {
  it('resolves a trimmed override and defaults beneath the supplied home', () => {
    expect(resolveCoordinationRoot({ env: { WE_COORDINATION_ROOT: ' ./fixture ' }, home: '/fake' })).toBe(resolve('fixture'));
    expect(resolveCoordinationRoot({ env: {}, home: '/fake' })).toBe('/fake/workspace/.operations/coordination');
  });
  it('shares the run default but preserves the explicit run-store override', () => {
    const prior = process.env.OPERATION_RUNS_DIR;
    try {
      delete process.env.OPERATION_RUNS_DIR;
      expect(resolveRunsDir()).toBe(coordinationPaths(process.env.WE_COORDINATION_ROOT).runs);
      process.env.OPERATION_RUNS_DIR = join(process.env.WE_COORDINATION_ROOT, 'custom');
      expect(resolveRunsDir()).toBe(process.env.OPERATION_RUNS_DIR);
    } finally { if (prior === undefined) delete process.env.OPERATION_RUNS_DIR; else process.env.OPERATION_RUNS_DIR = prior; }
  });
});
