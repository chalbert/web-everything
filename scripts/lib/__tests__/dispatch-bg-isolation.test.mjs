/**
 * @file scripts/lib/__tests__/dispatch-bg-isolation.test.mjs
 * @description #x9fbg1x — {@link ensureWorktreeIsolationOff}'s merge contract: additive, idempotent, never
 *   throws. Every fs call is injected — no real filesystem touched, mirroring `gh-app-shim.test.mjs`'s own
 *   in-memory-store convention for `ensureSettingsFileEnv`/`ensureSettingsFilePermissions`.
 */
import { describe, it, expect } from 'vitest';
import { DISPATCH_WORKTREE_SETTINGS, ensureWorktreeIsolationOff, hasWorktreeIsolationOff } from '../dispatch-bg-isolation.mjs';

function memoryFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFile: (p) => {
      if (!(p in files)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
      return files[p];
    },
    writeFile: (p, body) => { files[p] = body; },
    mkdir: () => {},
  };
}

describe('DISPATCH_WORKTREE_SETTINGS', () => {
  it('is exactly the documented guard-off patch', () => {
    expect(DISPATCH_WORKTREE_SETTINGS).toEqual({ worktree: { bgIsolation: 'none' } });
  });
});

describe('ensureWorktreeIsolationOff', () => {
  it('creates the file fresh when neither it nor the .claude dir exists', () => {
    const fs = memoryFs();
    const path = '/scratch/dispatch/sess-1/.claude/settings.local.json';
    const result = ensureWorktreeIsolationOff({ cwd: '/scratch/dispatch/sess-1', ...fs });
    expect(result).toEqual({ ok: true, path });
    expect(JSON.parse(fs.files[path])).toEqual({ worktree: { bgIsolation: 'none' } });
  });

  it('is ADDITIVE — an existing env block (the gh-shim\'s own write) survives untouched', () => {
    const path = '/lane/.claude/settings.local.json';
    const fs = memoryFs({ [path]: JSON.stringify({ env: { PATH: '/shim:/usr/bin' } }) });
    ensureWorktreeIsolationOff({ cwd: '/lane', ...fs });
    expect(JSON.parse(fs.files[path])).toEqual({
      env: { PATH: '/shim:/usr/bin' },
      worktree: { bgIsolation: 'none' },
    });
  });

  it('is ADDITIVE within worktree too — an unrelated sibling key under `worktree` survives', () => {
    const path = '/lane/.claude/settings.local.json';
    const fs = memoryFs({ [path]: JSON.stringify({ worktree: { someOtherFlag: true } }) });
    ensureWorktreeIsolationOff({ cwd: '/lane', ...fs });
    expect(JSON.parse(fs.files[path])).toEqual({ worktree: { someOtherFlag: true, bgIsolation: 'none' } });
  });

  it('is IDEMPOTENT — calling it twice leaves the same result', () => {
    const path = '/lane/.claude/settings.local.json';
    const fs = memoryFs();
    ensureWorktreeIsolationOff({ cwd: '/lane', ...fs });
    ensureWorktreeIsolationOff({ cwd: '/lane', ...fs });
    expect(JSON.parse(fs.files[path])).toEqual({ worktree: { bgIsolation: 'none' } });
  });

  it('treats a corrupt existing file as empty rather than fatal', () => {
    const path = '/lane/.claude/settings.local.json';
    const fs = memoryFs({ [path]: '{ not json' });
    const result = ensureWorktreeIsolationOff({ cwd: '/lane', ...fs });
    expect(result.ok).toBe(true);
    expect(JSON.parse(fs.files[path])).toEqual({ worktree: { bgIsolation: 'none' } });
  });

  it('NEVER THROWS — a write failure resolves to {ok:false}, never an exception', () => {
    const writeFile = () => { throw new Error('EACCES'); };
    expect(() => ensureWorktreeIsolationOff({ cwd: '/lane', readFile: () => { throw new Error('ENOENT'); }, writeFile, mkdir: () => {} }))
      .not.toThrow();
    const result = ensureWorktreeIsolationOff({ cwd: '/lane', readFile: () => { throw new Error('ENOENT'); }, writeFile, mkdir: () => {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('write-failed');
  });

  it('answers {ok:false, reason:"no-cwd"} rather than writing anywhere when cwd is missing', () => {
    expect(ensureWorktreeIsolationOff({})).toEqual({ ok: false, reason: 'no-cwd' });
  });
});

describe('hasWorktreeIsolationOff', () => {
  it('reads back true once the override is on disk', () => {
    const path = '/lane/.claude/settings.local.json';
    const fs = memoryFs({ [path]: JSON.stringify({ worktree: { bgIsolation: 'none' } }) });
    expect(hasWorktreeIsolationOff('/lane', { readFile: fs.readFile })).toBe(true);
  });

  it('is false when nothing has been written, never throws', () => {
    expect(hasWorktreeIsolationOff('/lane', { readFile: () => { throw new Error('ENOENT'); } })).toBe(false);
  });
});
