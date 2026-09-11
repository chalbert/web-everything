/** Preparation contract tests: injected execFn, real disposable files, no CLI/model spawn. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIsolationCloneArgv, createMacosDeletionIsolationProvider } from '../isolation-provider.mjs';

let root, source, scratch;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'we-isolation-test-')));
  source = join(root, 'source with spaces');
  scratch = join(root, 'scratch');
  await mkdir(source);
  await mkdir(scratch);
  await writeFile(join(source, 'AGENTS.md'), 'source doctrine');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function executor(prepare = async (cwd) => { await writeFile(join(cwd, 'AGENTS.md'), 'clone doctrine'); }) {
  return vi.fn(async (_file, argv) => {
    const cwd = argv.at(-1);
    await mkdir(cwd);
    await writeFile(join(cwd, 'work.txt'), 'work');
    await prepare(cwd);
  });
}

describe('IsolationProvider preparation contract', () => {
  it('keeps metacharacters in single argv entries with an option boundary', () => {
    const from = join(root, '$(touch nope); repo');
    const to = join(root, 'clone `whoami`');
    expect(buildIsolationCloneArgv(from, to)).toEqual(['clone', '--quiet', '--no-hardlinks', '--', from, to]);
  });

  it.each(['relative', '', '--upload-pack=bad', 'https://example.com/repo', '/bad\0path', null])(
    'rejects invalid source paths before exec or allocation: %s', async (sourceCwd) => {
      const execFn = executor();
      await expect(createMacosDeletionIsolationProvider({ execFn })({ sourceCwd, scratchParent: scratch }))
        .rejects.toThrow(/absolute local path/);
      expect(execFn).not.toHaveBeenCalled();
      expect(await readdir(scratch)).toEqual([]);
    },
  );

  it('rejects a relative scratch parent before exec', async () => {
    const execFn = executor();
    await expect(createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: '.' }))
      .rejects.toThrow(/absolute local path/);
    expect(execFn).not.toHaveBeenCalled();
  });

  it('awaits clone completion, excludes doctrine before handoff, preserves source and cleans edits', async () => {
    const execFn = executor(async (cwd) => {
      await Promise.resolve();
      await writeFile(join(cwd, 'AGENTS.md'), 'delayed doctrine');
    });
    const outcome = await createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: scratch });
    expect(execFn).toHaveBeenCalledTimes(1);
    expect(execFn).toHaveBeenCalledWith('git', buildIsolationCloneArgv(source, outcome.cwd), {
      cwd: scratch, encoding: 'utf8', shell: false,
    });
    expect(outcome.guarantee).toBe('root-agents-absent-before-start');
    expect(outcome.excludedPaths).toEqual(['AGENTS.md']);
    await expect(lstat(join(outcome.cwd, 'AGENTS.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(source, 'AGENTS.md'), 'utf8')).toBe('source doctrine');
    expect(await readFile(join(outcome.cwd, 'work.txt'), 'utf8')).toBe('work');
    await writeFile(join(outcome.cwd, 'proof.txt'), 'tool work');
    await outcome.cleanup();
    await outcome.cleanup();
    expect(await readdir(scratch)).toEqual([]);
    expect(await readFile(join(source, 'AGENTS.md'), 'utf8')).toBe('source doctrine');
  });

  it('accepts an already absent root AGENTS.md, while leaving other instruction sources alone', async () => {
    const execFn = executor(async (cwd) => {
      await mkdir(join(cwd, 'nested'));
      await writeFile(join(cwd, 'nested', 'AGENTS.md'), 'nested');
      await writeFile(join(cwd, 'AGENTS.override.md'), 'override');
    });
    const outcome = await createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: scratch });
    expect(await readFile(join(outcome.cwd, 'nested', 'AGENTS.md'), 'utf8')).toBe('nested');
    expect(await readFile(join(outcome.cwd, 'AGENTS.override.md'), 'utf8')).toBe('override');
    await outcome.cleanup();
  });

  it('unlinks an AGENTS.md symlink without deleting its target', async () => {
    const execFn = executor(async (cwd) => { await symlink(join(source, 'AGENTS.md'), join(cwd, 'AGENTS.md')); });
    const outcome = await createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: scratch });
    await expect(lstat(join(outcome.cwd, 'AGENTS.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(source, 'AGENTS.md'), 'utf8')).toBe('source doctrine');
    await outcome.cleanup();
  });

  it('surfaces a clone failure and removes partial scratch material', async () => {
    const failure = new Error('git clone failed');
    const execFn = executor(async () => { throw failure; });
    await expect(createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: scratch }))
      .rejects.toBe(failure);
    expect(await readdir(scratch)).toEqual([]);
  });

  it('fails closed and cleans up when AGENTS.md is a directory', async () => {
    const execFn = executor(async (cwd) => { await mkdir(join(cwd, 'AGENTS.md')); });
    await expect(createMacosDeletionIsolationProvider({ execFn })({ sourceCwd: source, scratchParent: scratch }))
      .rejects.toThrow();
    expect(await readdir(scratch)).toEqual([]);
  });

  it('rejects executor success without a clone instead of returning a nonexistent cwd', async () => {
    await expect(createMacosDeletionIsolationProvider({ execFn: vi.fn(async () => {}) })({
      sourceCwd: source, scratchParent: scratch,
    })).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(scratch)).toEqual([]);
  });

  it('allocates independent clones and cleanup cannot remove another outcome', async () => {
    const provider = createMacosDeletionIsolationProvider({ execFn: executor() });
    const request = { sourceCwd: source, scratchParent: scratch };
    const [first, second] = await Promise.all([provider(request), provider(request)]);
    expect(first.cwd).not.toBe(second.cwd);
    await first.cleanup();
    expect(await readFile(join(second.cwd, 'work.txt'), 'utf8')).toBe('work');
    await second.cleanup();
    expect(await readdir(scratch)).toEqual([]);
  });
});
