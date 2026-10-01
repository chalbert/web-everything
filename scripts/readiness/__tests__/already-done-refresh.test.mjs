import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectRefreshIds, refreshAlreadyDone, readLocalDoneFacts, localDoneVerdict, startAlreadyDoneRefresh } from '../already-done-refresh.mjs';

describe('already-done tick budget', () => {
  it('bounds 444 and 10000 cold misses to two and rotates failures', async () => {
    for (const size of [444, 10000]) {
      const dir = mkdtempSync(join(tmpdir(), 'done-bound-'));
      try {
        const ids = Array.from({ length: size }, (_, i) => String(8000 + i));
        const check = vi.fn(async () => ({ checked: false }));
        const cachePath = join(dir, 'cache');
        await refreshAlreadyDone({ ids, cachePath, check, now: () => 10 });
        expect(check).toHaveBeenCalledTimes(2);
        const attempted = check.mock.calls.map(([id]) => id);
        const next = selectRefreshIds(ids, JSON.parse(readFileSync(`${cachePath}.attempts`, 'utf8')));
        expect(next).toHaveLength(2);
        expect(next.some(id => attempted.includes(id))).toBe(false);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });
  it('reads one local snapshot for any number of ids; candidates/aliases stay unknown', () => {
    const git = vi.fn((_, args) => {
      if (args[0] === 'rev-parse') return 'false';
      if (args[0] === 'for-each-ref') return 'refs/remotes/origin/main';
      return 'parent\0JIT-number xabc→#8000\0parent\0implement xabc\0';
    });
    const facts = readLocalDoneFacts({ git });
    for (let i = 0; i < 10000; i++) expect(localDoneVerdict('9000', null, facts)).toMatchObject({ checked: true, done: false });
    expect(localDoneVerdict('8000', null, facts)).toBeNull();
    expect(localDoneVerdict('8001', 'xabc', facts)).toBeNull();
    expect(git).toHaveBeenCalledTimes(3);
    expect(git.mock.calls.some(([, args]) => ['fetch', 'ls-remote'].includes(args[0]))).toBe(false);
  });
  it('matches commit-message ids case-insensitively (an uppercase alias is still a mention)', () => {
    const git = vi.fn((_, args) => {
      if (args[0] === 'rev-parse') return 'false';
      if (args[0] === 'for-each-ref') return 'refs/remotes/origin/main';
      return 'parent\0Fixes X1234\0';
    });
    expect(localDoneVerdict('8000', 'x1234', readLocalDoneFacts({ git }))).toBeNull();
  });
  it('expires a refresh lock by age even when its recorded pid is alive (a recycled pid must not wedge enrichment)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'done-lock-'));
    try {
      const cachePath = join(dir, 'cache'); const lock = `${cachePath}.refresh-lock`;
      // process.pid is alive by definition — stands in for an unrelated process that reused the dead worker's pid.
      writeFileSync(lock, JSON.stringify({ pid: process.pid, at: 0 }));
      const fresh = startAlreadyDoneRefresh(['8000'], cachePath, { cwd: dir, env: { ...process.env, PATH: '' } });
      expect(fresh).toEqual({ started: false, ids: [] }); // young lock + live pid: still respected
      const old = new Date(Date.now() - 120000); utimesSync(lock, old, old);
      const stale = startAlreadyDoneRefresh(['8000'], cachePath, { cwd: dir, env: { ...process.env } });
      expect(stale.started).toBe(true); // old lock + live-but-foreign pid: reclaimed
      expect(existsSync(lock)).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('readOnly refresh records no verdicts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'done-ro-'));
    try {
      const cachePath = join(dir, 'cache');
      await refreshAlreadyDone({ ids: ['8000'], cachePath, readOnly: true, check: async () => ({ checked: true, done: false, pr: null }) });
      expect(existsSync(cachePath)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('does not invent negative evidence from shallow, missing or other-base history', () => {
    for (const facts of [null, { shallow: true }, { otherBases: true }, { ambiguous: true }]) {
      expect(localDoneVerdict('9000', null, facts)).toBeNull();
    }
  });
});
