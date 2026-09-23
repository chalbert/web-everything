/**
 * @file scripts/lib/__tests__/for-each-repo.test.mjs
 * @description Executable proof for `forEachRepo` (multi-repo slice 2, #x1rr9rh) — the shared per-repo loop
 *   extracted from we:skills-src/conveyor/review-daemon.mjs's own `runReviewTickAllRepos`. Isolation is the
 *   whole point: one repo throwing must never stop the rest, and the result shape must distinguish success
 *   from failure without ever rethrowing.
 */
import { describe, it, expect, vi } from 'vitest';

import { forEachRepo } from '../for-each-repo.mjs';

describe('forEachRepo', () => {
  it('calls fn once per repo and records each result under {repo, result}', () => {
    const fn = vi.fn((repo) => `did-${repo}`);
    const out = forEachRepo(['a', 'b', 'c'], fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
    expect(fn).toHaveBeenNthCalledWith(3, 'c');
    expect(out).toEqual([
      { repo: 'a', result: 'did-a' },
      { repo: 'b', result: 'did-b' },
      { repo: 'c', result: 'did-c' },
    ]);
  });

  it('one repo throwing is isolated to {repo, error} — the rest still run and are recorded', () => {
    const fn = vi.fn((repo) => { if (repo === 'bad') throw new Error('gh: rate limited'); return `ok-${repo}`; });
    const out = forEachRepo(['good1', 'bad', 'good2'], fn);
    expect(fn).toHaveBeenCalledTimes(3); // bad's throw never stopped good2 from being attempted
    expect(out).toEqual([
      { repo: 'good1', result: 'ok-good1' },
      { repo: 'bad', error: 'gh: rate limited' },
      { repo: 'good2', result: 'ok-good2' },
    ]);
  });

  it('a thrown non-Error value is stringified, not rethrown', () => {
    const out = forEachRepo(['x'], () => { throw 'plain string failure'; });
    expect(out).toEqual([{ repo: 'x', error: 'plain string failure' }]);
  });

  it('only the first line of a multi-line error message is kept', () => {
    const out = forEachRepo(['x'], () => { throw new Error('line one\nline two\nline three'); });
    expect(out).toEqual([{ repo: 'x', error: 'line one' }]);
  });

  it('an empty repo list calls fn zero times and returns an empty array', () => {
    const fn = vi.fn();
    expect(forEachRepo([], fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
