import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectRefreshIds, refreshAlreadyDone, readLocalDoneFacts, localDoneVerdict } from '../already-done-refresh.mjs';

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
  it('does not invent negative evidence from shallow, missing or other-base history', () => {
    for (const facts of [null, { shallow: true }, { otherBases: true }, { ambiguous: true }]) {
      expect(localDoneVerdict('9000', null, facts)).toBeNull();
    }
  });
});
