import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planOpen } from '../open-pr.mjs';
import { createPrLandRunner } from '../open-pr-io.mjs';

const title = 'WE #4368: prepare item — Design/MVP/Test plan/Proof plan/Follow-ups';
const request = (extra = {}) => ({ ref: 'lane/4368-prepare-mid-work-guard', base: 'main',
  sha: 'HEAD', bodyFile: '/tmp/body.md', mode: 'label-on-green', ...extra });

describe('prepare PR publication', () => {
  it.each([undefined, 'Merge pull request #3073 from chalbert/lane/4341-prepare-wip-queue'])
  ('uses the item identity instead of title %s', (subject) => {
    const plan = planOpen(request({ title: subject }));
    expect(plan.argv).toContain(`--title=${title}`);
    expect(plan.title).toBe(title);
  });

  // Local git history exercises the actual three-dot diff, including inherited card changes.
  function fixture(run) {
    const cwd = mkdtempSync(join(tmpdir(), 'prepare-pr-'));
    const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' } });
    try {
      git(['init', '-q']);
      mkdirSync(join(cwd, 'backlog'));
      for (const id of ['4368', '4341']) writeFileSync(join(cwd, `backlog/${id}-card.md`), 'original\n');
      const snapshot = (parents = [], message = 'prepare') => {
        git(['add', '.']);
        const tree = git(['write-tree']).trim();
        const sha = git(['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-m', message]).trim();
        git(['update-ref', 'HEAD', sha]);
        return sha;
      };
      const main = snapshot();
      git(['update-ref', 'refs/heads/main', main]);
      git(['symbolic-ref', 'HEAD', 'refs/heads/preparing']);
      git(['update-ref', 'HEAD', main]);
      git(['remote', 'add', 'origin', cwd]);
      run({ cwd, git, snapshot, main, edit: (path) => writeFileSync(join(cwd, path), 'changed\n') });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  it('publishes only the own-card diff with a deterministic title and pinned SHA', () => fixture(({ cwd, git, snapshot, main, edit }) => {
    edit('backlog/4368-card.md');
    const sha = snapshot([main], 'Merge pull request #3073 from chalbert/lane/4341-prepare-wip-queue');
    const spawn = vi.fn(() => ({ status: 0, stdout: '{}' }));
    createPrLandRunner({ cwd, git, spawn })({ argv: planOpen(request()).argv });
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn.mock.calls[0][1]).toContain(`--title=${title}`);
    expect(spawn.mock.calls[0][1]).toContain(`--sha=${sha}`);
  }));

  it.each(['backlog/4341-card.md', 'unrelated.mjs'])('refuses inherited %s before spawning pr-land', (path) => fixture(({ cwd, git, snapshot, main, edit }) => {
    edit(path);
    const predecessor = snapshot([main]);
    edit('backlog/4368-card.md');
    snapshot([predecessor]);
    const spawn = vi.fn();
    const result = createPrLandRunner({ cwd, git, spawn })({ argv: planOpen(request()).argv });
    expect(result.outcome).toBe('refused');
    expect(result.reason).toContain(`diff outside backlog/4368-card.md: ${path}`);
    expect(spawn).not.toHaveBeenCalled();
  }));

  it('refuses a merge even when the final diff only changes the own card', () => fixture(({ cwd, git, snapshot, main, edit }) => {
    const other = snapshot([main], 'another lane');
    edit('backlog/4368-card.md');
    snapshot([main, other]);
    const spawn = vi.fn();
    expect(createPrLandRunner({ cwd, git, spawn })({ argv: planOpen(request()).argv }).reason).toContain('lane contains merge commits');
    expect(spawn).not.toHaveBeenCalled();
  }));

  it('fails closed when git cannot observe the diff', () => {
    const spawn = vi.fn();
    const git = () => { throw new Error('fetch unavailable'); };
    expect(createPrLandRunner({ git, spawn })({ argv: planOpen(request()).argv })).toEqual({ outcome: 'refused', reason: 'fetch unavailable' });
    expect(spawn).not.toHaveBeenCalled();
  });
});
