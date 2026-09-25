import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hookDecision, runHook, DEFAULT_COOLDOWN_MS } from '../../land-advance-hook.mjs';
import { tryAcquireSingleFlight } from '../land-advance-gate.mjs';
let lockRoot;
beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'la-hook-')); });
afterEach(() => rmSync(lockRoot, { recursive: true, force: true }));
it('decides: disabled, busy, cooling down, or launch', () => {
  expect(hookDecision({ disabled: true })).toBe('skip-disabled');
  expect(hookDecision({ leaseHeld: true, nowMs: 1e6 })).toBe('skip-busy');
  expect(hookDecision({ lastRunMs: 1e6 - 1000, nowMs: 1e6 })).toBe('skip-cooldown');
  expect(hookDecision({ lastRunMs: 1e6 - DEFAULT_COOLDOWN_MS - 1, nowMs: 1e6 })).toBe('launch');
  expect(hookDecision({ lastRunMs: null, nowMs: 1e6 })).toBe('launch');
});
it('launches the operation detached in dispatch mode (the gate downgrades it), then honours the cooldown', () => {
  const spawn = vi.fn(() => ({ unref: vi.fn() }));
  expect(runHook({ lockRoot, spawn, nowMs: 1e7, env: {} })).toBe('launch');
  expect(spawn).toHaveBeenCalledOnce();
  const [program, args, opts] = spawn.mock.calls[0];
  expect(program).toBe(process.execPath);
  expect(args[0]).toMatch(/scripts\/operations\/land-advance-cli\.mjs$/);
  expect(args.slice(1)).toEqual(['--mode=dispatch', '--caller=stop-hook']);
  expect(opts).toMatchObject({ detached: true });
  expect(runHook({ lockRoot, spawn, nowMs: 1e7 + 1000, env: {} })).toBe('skip-cooldown');
  expect(spawn).toHaveBeenCalledOnce();
});
it('honours an explicit zero cooldown override rather than falling back to the default (#2170 review finding)', () => {
  const spawn = vi.fn(() => ({ unref: vi.fn() }));
  expect(runHook({ lockRoot, spawn, nowMs: 1e7, env: { WE_LAND_ADVANCE_COOLDOWN_MS: '0' } })).toBe('launch');
  expect(spawn).toHaveBeenCalledOnce();
  expect(runHook({ lockRoot, spawn, nowMs: 1e7 + 1, env: { WE_LAND_ADVANCE_COOLDOWN_MS: '0' } })).toBe('launch');
  expect(spawn).toHaveBeenCalledTimes(2);
});
it('exits at once while another call holds the single-flight lease, and on the kill switch', () => {
  const spawn = vi.fn(() => ({ unref: vi.fn() }));
  expect(tryAcquireSingleFlight({ lockRoot, owner: 'other', nowMs: 1e7 }).ok).toBe(true);
  expect(runHook({ lockRoot, spawn, nowMs: 1e7 + 1000, env: {} })).toBe('skip-busy');
  expect(runHook({ lockRoot, spawn, nowMs: 1e7 + 1000, env: { WE_LAND_ADVANCE_HOOK: '0' } })).toBe('skip-disabled');
  expect(spawn).not.toHaveBeenCalled();
  expect(existsSync(join(lockRoot, 'land-advance-hook-last-run.json'))).toBe(false);
});
