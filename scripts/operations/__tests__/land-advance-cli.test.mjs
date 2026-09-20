import { it, expect, vi } from 'vitest';
import { main } from '../land-advance-cli.mjs';
it('defaults to zero-write, zero-dispatch JSON plan', async () => {
  const dispatch = vi.fn(), write = vi.fn(), apply = vi.fn(), stdout = vi.fn(), stderr = vi.fn();
  const code = await main({ argv: ['--json'], deps: { readInputs: () => ({ now: 0, freeLanes: 1, prs: [], errors: [] }), apply, dispatch, write }, stdout, stderr });
  expect(code).toBe(0); expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ rows: [], proposed: [], capacity: { budget: 1 } });
  expect(apply).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(stderr).not.toHaveBeenCalled();
});
it('reports partial source failures and exits 1', async () => {
  const stdout = vi.fn(), stderr = vi.fn();
  expect(await main({ argv: ['--json'], deps: { readInputs: () => ({ now: 0, errors: [{ source: 'prs:frontierui', message: 'failed' }] }) }, stdout, stderr })).toBe(1);
  expect(JSON.parse(stdout.mock.calls[0][0]).errors).toHaveLength(1); expect(stderr).toHaveBeenCalledWith('prs:frontierui: failed\n');
});
it('passes explicit apply to its injected port and propagates failure', async () => {
  const apply = vi.fn(() => ({ errors: [{ message: 'failed' }] }));
  expect(await main({ argv: ['--apply'], deps: { readInputs: () => ({ now: 0 }), apply }, stdout: vi.fn(), stderr: vi.fn() })).toBe(1);
  expect(apply).toHaveBeenCalledOnce();
});
