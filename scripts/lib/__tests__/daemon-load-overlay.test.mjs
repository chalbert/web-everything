/**
 * @file scripts/lib/__tests__/daemon-load-overlay.test.mjs
 * @description #3383 — the operator's manual "load this early" CLI, gated through the SAME merge → live-smoke →
 *   adopt/rollback path as `daemon-self-sync.mjs#withSelfSync`. Injected `sync`/`gate`/`readHead` throughout —
 *   no real git, no real child process — proving the WIRING, not `gateMergedCommit`'s own behavior (that is
 *   `daemon-live-smoke.test.mjs`'s job) or `selfSyncCheckout`'s own behavior (`daemon-self-sync.test.mjs`'s job).
 */
import { describe, it, expect, vi } from 'vitest';
import { runDaemonLoadOverlay } from '../daemon-load-overlay.mjs';

describe('runDaemonLoadOverlay', () => {
  it('requires --clone', async () => {
    await expect(runDaemonLoadOverlay({ clone: null })).rejects.toThrow(/--clone/);
  });

  it('nothing to merge (e.g. up to date) → reports it, gate is never called', async () => {
    const gate = vi.fn();
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const readHead = vi.fn(() => 'sha');
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', sync, gate, readHead });
    expect(result).toMatchObject({ mergedAnything: false, adopted: false, reason: 'up-to-date' });
    expect(gate).not.toHaveBeenCalled();
  });

  it('merged + gate adopts → adopted:true, reason and commit count passed through', async () => {
    const sync = vi.fn(() => ({ merged: true, commits: 5, reason: 'merged' }));
    const gate = vi.fn(async () => ({ adopt: true, reason: 'smoke-pass', smoke: { pass: true } }));
    const readHead = vi.fn(() => 'pre-sha');
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', sync, gate, readHead });
    expect(result).toMatchObject({ mergedAnything: true, adopted: true, commits: 5, reason: 'smoke-pass' });
  });

  it('merged + gate rejects → adopted:false, the rollback/smoke detail is surfaced', async () => {
    const sync = vi.fn(() => ({ merged: true, commits: 2, reason: 'merged' }));
    const gate = vi.fn(async () => ({ adopt: false, reason: 'smoke-fail', smoke: { pass: false, results: [{ name: 'gh-api-repo', ok: false }] } }));
    const readHead = vi.fn(() => 'pre-sha');
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', sync, gate, readHead });
    expect(result.adopted).toBe(false);
    expect(result.reason).toBe('smoke-fail');
    expect(result.smoke.results[0].name).toBe('gh-api-repo');
  });

  it('the gate receives the PRE-merge HEAD (read before sync runs) as its rollback target', async () => {
    const order = [];
    const readHead = vi.fn(() => { order.push('readHead'); return 'pre-sha-xyz'; });
    const sync = vi.fn(() => { order.push('sync'); return { merged: true, commits: 1, reason: 'merged' }; });
    const gate = vi.fn(async (o) => { order.push('gate'); return { adopt: true, reason: 'ok', ...o }; });
    await runDaemonLoadOverlay({ clone: '/some/clone', sync, gate, readHead });
    expect(order).toEqual(['readHead', 'sync', 'gate']);
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ preMergeSha: 'pre-sha-xyz' }));
  });

  it('defaults --ref/base to main', async () => {
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    await runDaemonLoadOverlay({ clone: '/some/clone', sync, gate: vi.fn(), readHead: vi.fn(() => 'x') });
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ base: 'main' }));
  });

  it('an explicit ref/base is forwarded to sync', async () => {
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    await runDaemonLoadOverlay({ clone: '/some/clone', base: 'lane/daemon-poc', sync, gate: vi.fn(), readHead: vi.fn(() => 'x') });
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ base: 'lane/daemon-poc' }));
  });
});
