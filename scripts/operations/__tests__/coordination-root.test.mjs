/** #3383 — Shared defaults must survive moving the calling checkout. */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolveCoordinationRoot } from '../coordination-root.mjs';
describe('coordination root', () => {
  it('resolves a trimmed override and defaults beneath the supplied home', () => {
    expect(resolveCoordinationRoot({ env: { WE_COORDINATION_ROOT: ' ./fixture ' }, home: '/fake' })).toBe(resolve('fixture'));
    expect(resolveCoordinationRoot({ env: {}, home: '/fake' })).toBe('/fake/workspace/.operations/coordination');
  });
  // Wave B finding (2026-09-24) dropped the branch's second case here — 'shares the run default but
  // preserves the explicit run-store override' — which asserted `resolveRunsDir()` (`run-store.mjs`, out of
  // #3901's scope, not graduated by this slice) defaults beneath `WE_COORDINATION_ROOT`. Main's own
  // `run-store.mjs` already resolves runs by SCRIPT LOCATION (`<repo>/.operations/runs`), an independently
  // diverged, already-shipped design (`OPERATION_RUNS_DIR` is its only override) — not something this
  // faithful-port slice may change. See the backlog card's Wave B finding for the full account.
});
