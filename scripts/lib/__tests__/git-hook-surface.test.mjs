/**
 * x55dojc — the git-hook hardening primitives `probation-heal-run.mjs`/`probation-build-run.mjs` share.
 * Real temp dirs throughout (cheap: plain fs + one `git init`), never mocked — the whole point of this module
 * is fs/git-adjacent behavior that a fake would just re-assert.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HOOKS_DISABLED_ENV, hookSurfaceChanged, resetHookSurface, snapshotHookSurface, withHooksDisabled,
} from '../git-hook-surface.mjs';

let dirs = [];
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'we-hook-surface-'));
  dirs.push(dir);
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'a.txt'), 'v0\n');
  execFileSync('git', ['add', 'a.txt'], { cwd: dir });
  execFileSync('git', ['commit', '--quiet', '-m', 'base'], { cwd: dir });
  return dir;
}
afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = []; });

describe('withHooksDisabled', () => {
  it('overlays the env-based git-config override without mutating the input', () => {
    const env = { PATH: '/bin', GIT_CONFIG_COUNT: 'should-be-overwritten' };
    const out = withHooksDisabled(env);
    expect(out).toEqual({ PATH: '/bin', ...HOOKS_DISABLED_ENV });
    expect(env.GIT_CONFIG_COUNT).toBe('should-be-overwritten'); // input untouched
  });
});

describe('a real planted pre-commit hook', () => {
  it('executes on a plain `git commit`, but is inert once the process env is withHooksDisabled', () => {
    const dir = makeRepo();
    const marker = join(dir, 'HOOK-RAN');
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, `#!/bin/sh\necho ran > ${JSON.stringify(marker)}\n`);
    chmodSync(hook, 0o755);
    writeFileSync(join(dir, 'a.txt'), 'v1\n');
    execFileSync('git', ['add', 'a.txt'], { cwd: dir });

    // RED (the vulnerability): an ordinary commit, no env override, lets the planted hook run.
    execFileSync('git', ['commit', '-m', 'plain commit'], { cwd: dir });
    expect(() => execFileSync('cat', [marker])).not.toThrow();
    rmSync(marker);

    // GREEN (this fix): the SAME planted hook, the SAME commit machinery, but with HOOKS_DISABLED_ENV in the
    // child's env — git finds no hook under `/dev/null` and skips it silently.
    writeFileSync(join(dir, 'a.txt'), 'v2\n');
    execFileSync('git', ['add', 'a.txt'], { cwd: dir, env: withHooksDisabled(process.env) });
    execFileSync('git', ['commit', '-m', 'protected commit'], { cwd: dir, env: withHooksDisabled(process.env) });
    expect(() => execFileSync('cat', [marker])).toThrow();
  });

  it('is inert even if the worker rewrites the lane\'s own .git/config hooksPath back', () => {
    const dir = makeRepo();
    const marker = join(dir, 'HOOK-RAN');
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, `#!/bin/sh\necho ran > ${JSON.stringify(marker)}\n`);
    chmodSync(hook, 0o755);
    // A hostile worker re-points hooksPath back at the real hooks dir on disk.
    execFileSync('git', ['config', 'core.hooksPath', '.git/hooks'], { cwd: dir });
    writeFileSync(join(dir, 'a.txt'), 'v1\n');
    execFileSync('git', ['add', 'a.txt'], { cwd: dir, env: withHooksDisabled(process.env) });
    execFileSync('git', ['commit', '-m', 'protected commit'], { cwd: dir, env: withHooksDisabled(process.env) });
    expect(() => execFileSync('cat', [marker])).toThrow(); // env override still wins over the on-disk config
  });
});

describe('snapshotHookSurface / hookSurfaceChanged', () => {
  it('reads a fresh repo as an unremarkable baseline — only *.sample templates, never a live hook name', () => {
    const dir = makeRepo();
    const snap = snapshotHookSurface(dir);
    expect(snap.configHash).toEqual(expect.any(String));
    // `git init` ships inert `*.sample` templates by default; none of them is a live hook name.
    expect(Object.keys(snap.files).every((name) => name.endsWith('.sample'))).toBe(true);
    expect(Object.keys(snap.files)).not.toContain('pre-commit');
  });

  it('flags an added hook file', () => {
    const dir = makeRepo();
    const before = snapshotHookSurface(dir);
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 0\n');
    const after = snapshotHookSurface(dir);
    const check = hookSurfaceChanged(before, after);
    expect(check.changed).toBe(true);
    expect(check.reason).toMatch(/added: pre-commit/);
  });

  it('flags a content-only edit to an existing hook file (no name change)', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, 'v0\n');
    const before = snapshotHookSurface(dir);
    writeFileSync(hook, 'v1\n');
    const after = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(before, after)).toEqual(expect.objectContaining({ changed: true }));
  });

  it('flags a mode-only edit (chmod +x with unchanged content)', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, 'same content\n');
    chmodSync(hook, 0o644);
    const before = snapshotHookSurface(dir);
    chmodSync(hook, 0o755);
    const after = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(before, after).changed).toBe(true);
  });

  it('flags a symlink swapped in for a hook name', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const before = snapshotHookSurface(dir);
    writeFileSync(join(dir, 'payload.sh'), '#!/bin/sh\nexit 0\n');
    symlinkSync(join(dir, 'payload.sh'), join(dir, '.git', 'hooks', 'pre-commit'));
    const after = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(before, after)).toEqual(expect.objectContaining({ changed: true }));
  });

  it('flags a .git/config change (hooksPath or any other entry)', () => {
    const dir = makeRepo();
    const before = snapshotHookSurface(dir);
    execFileSync('git', ['config', 'core.hooksPath', '/tmp/evil'], { cwd: dir });
    const after = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(before, after)).toEqual({ changed: true, reason: expect.stringMatching(/\.git\/config changed/) });
  });

  it('does not flag an untouched repo (no false positive)', () => {
    const dir = makeRepo();
    const before = snapshotHookSurface(dir);
    const after = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(before, after)).toEqual({ changed: false, reason: 'unchanged' });
  });

  it('fails closed when a snapshot is missing entirely', () => {
    const dir = makeRepo();
    const snap = snapshotHookSurface(dir);
    expect(hookSurfaceChanged(null, snap).changed).toBe(true);
    expect(hookSurfaceChanged(snap, undefined).changed).toBe(true);
  });
});

describe('resetHookSurface', () => {
  const hooksPathOnDisk = (dir) => {
    try { return execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: dir, encoding: 'utf8' }).trim(); } catch { return null; }
  };

  it('deletes a planted hook, keeps *.sample files, and drops a repointed hooksPath (repo tracks no .githooks/)', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n');
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit.sample'), '#!/bin/sh\nexit 0\n');
    execFileSync('git', ['config', 'core.hooksPath', '/tmp/evil'], { cwd: dir });

    const result = resetHookSurface(dir);
    expect(result.clean).toBe(true);
    expect(result.leftover).toEqual([]);
    expect(Object.keys(result.snapshot.files)).not.toContain('pre-commit'); // the planted (non-sample) hook is gone
    expect(Object.keys(result.snapshot.files)).toContain('pre-commit.sample'); // the sample template is untouched
    expect(hooksPathOnDisk(dir)).toBe(null);
  });

  it('restores the repo\'s own tracked .githooks/ as hooksPath — a pooled lane\'s guard hooks stay on for its next holder', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.githooks'));
    writeFileSync(join(dir, '.githooks', 'pre-push'), '#!/bin/sh\nexit 0\n');
    execFileSync('git', ['add', '.githooks/pre-push'], { cwd: dir });
    execFileSync('git', ['commit', '--quiet', '-m', 'hooks'], { cwd: dir });
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: dir }); // what `npm prepare` sets
    expect(resetHookSurface(dir).clean).toBe(true);
    expect(hooksPathOnDisk(dir)).toBe('.githooks'); // not left pinned at /dev/null

    execFileSync('git', ['config', 'core.hooksPath', '/tmp/evil'], { cwd: dir }); // a worker repoints it
    expect(resetHookSurface(dir).clean).toBe(true);
    expect(hooksPathOnDisk(dir)).toBe('.githooks');
  });

  it('never trusts an UNTRACKED .githooks/ a worker created — hooksPath is dropped, not pointed at it', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.githooks'));
    writeFileSync(join(dir, '.githooks', 'pre-commit'), '#!/bin/sh\nexit 0\n');
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: dir });
    expect(resetHookSurface(dir).clean).toBe(true);
    expect(hooksPathOnDisk(dir)).toBe(null);
    execFileSync('git', ['add', '.githooks/pre-commit'], { cwd: dir }); // staged, but never committed
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: dir });
    expect(resetHookSurface(dir).clean).toBe(true);
    expect(hooksPathOnDisk(dir)).toBe(null);
  });

  it('reports uncleanable leftovers rather than silently proceeding', () => {
    const dir = makeRepo();
    mkdirSync(join(dir, '.git', 'hooks', 'pre-commit'), { recursive: true }); // a DIRECTORY named pre-commit
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit', 'nested'), 'x');
    chmodSync(join(dir, '.git', 'hooks'), 0o555); // read-only dir: rmSync of the entry inside will fail
    let result;
    try {
      result = resetHookSurface(dir);
    } finally {
      chmodSync(join(dir, '.git', 'hooks'), 0o755); // restore so afterEach's rmSync can clean up
    }
    expect(result.clean).toBe(false);
    expect(result.leftover.length).toBeGreaterThan(0);
  });
});
