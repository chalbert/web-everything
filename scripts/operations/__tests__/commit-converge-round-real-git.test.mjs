import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { commitConvergeRound } from '../deliver-item-wrapper.mjs';

describe('commitConvergeRound with real git', () => {
  it('commits tracked modifications and untracked new files via explicit staging and commit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-converge-round-real-git-'));
    try {
      execFileSync('git', ['init'], { cwd: dir });
      execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
      execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });

      writeFileSync(join(dir, 'tracked.md'), 'initial tracked content\n');
      execFileSync('git', ['add', 'tracked.md'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: dir });

      writeFileSync(join(dir, 'tracked.md'), 'modified tracked content\n');
      writeFileSync(join(dir, 'new-file.mjs'), 'export const answer = 42;\n');

      const result1 = commitConvergeRound({ lane: dir, item: '1234', round: 1 });
      expect(result1.committed).toBe(true);
      expect(result1.paths).toContain('tracked.md');
      expect(result1.paths).toContain('new-file.mjs');

      const logOutput = execFileSync('git', ['log', '-1', '--name-only', '--format='], { cwd: dir, encoding: 'utf8' });
      const loggedFiles = logOutput.trim().split('\n').map((f) => f.trim());
      expect(loggedFiles).toContain('tracked.md');
      expect(loggedFiles).toContain('new-file.mjs');

      const statusOutput = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
      const statusLines = statusOutput.split('\n').filter(Boolean);
      expect(statusLines.some((l) => l.includes('tracked.md'))).toBe(false);
      expect(statusLines.some((l) => l.includes('new-file.mjs'))).toBe(false);

      // Modified-only round: round 2
      writeFileSync(join(dir, 'tracked.md'), 'round 2 modified tracked content\n');
      const result2 = commitConvergeRound({ lane: dir, item: '1234', round: 2 });
      expect(result2.committed).toBe(true);
      expect(result2.paths).toEqual(['tracked.md']);

      const logOutput2 = execFileSync('git', ['log', '-1', '--name-only', '--format='], { cwd: dir, encoding: 'utf8' });
      const loggedFiles2 = logOutput2.trim().split('\n').map((f) => f.trim());
      expect(loggedFiles2).toEqual(['tracked.md']);

      const statusOutput2 = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
      const statusLines2 = statusOutput2.split('\n').filter(Boolean);
      expect(statusLines2.some((l) => l.includes('tracked.md'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
