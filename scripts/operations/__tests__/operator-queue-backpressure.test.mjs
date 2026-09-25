/**
 * @file scripts/operations/__tests__/operator-queue-backpressure.test.mjs
 * @description Proof of we:xniq7xs's BACKPRESSURE feed on `operator-queue.mjs`: `prLimitCounts` shells out to
 *   `node scripts/lib/pr-limit.mjs status` (mirrors `laneReclaimQueue`'s own subprocess pattern — see that
 *   test's own header), degrading to `[]` on any failure; `backpressureRows` is the pure filter down to
 *   repos actually AT/OVER their cap. `--with-backpressure` gates the live call OFF by default (mirrors
 *   `--with-lanes`) so the many existing `main()` tests that replace the whole `node:child_process` module
 *   keep their exact gh-call sequencing untouched.
 */
import { describe, it, expect } from 'vitest';
import { prLimitCounts, backpressureRows } from '../operator-queue.mjs';

describe('prLimitCounts', () => {
  it('shells `node .../pr-limit.mjs status` and returns its counts array', () => {
    const fakeStatus = { counts: [{ repoKey: 'we', count: 16, limit: 15, unavailable: false, prNumbers: [1, 2] }] };
    const exec = (file, args) => {
      expect(file).toBe('node');
      expect(args[0]).toMatch(/pr-limit\.mjs$/);
      expect(args[1]).toBe('status');
      return JSON.stringify(fakeStatus);
    };
    expect(prLimitCounts({ exec })).toEqual(fakeStatus.counts);
  });

  it('degrades to [] — never throws — when the subprocess fails', () => {
    const exec = () => { throw new Error('spawn node ENOENT'); };
    expect(prLimitCounts({ exec })).toEqual([]);
  });

  it('degrades to [] on unparsable output, or a status shape with no counts array', () => {
    expect(prLimitCounts({ exec: () => 'not json' })).toEqual([]);
    expect(prLimitCounts({ exec: () => '{}' })).toEqual([]);
  });
});

describe('backpressureRows', () => {
  it('surfaces only repos AT/OVER their cap', () => {
    const counts = [
      { repoKey: 'we', count: 16, limit: 15, unavailable: false, prNumbers: [1, 2] },
      { repoKey: 'frontierui', count: 3, limit: 5, unavailable: false, prNumbers: [] },
      { repoKey: 'plateau-app', count: 5, limit: 5, unavailable: false, prNumbers: [9] },
    ];
    expect(backpressureRows(counts)).toEqual([
      { repo: 'we', count: 16, limit: 15, prNumbers: [1, 2] },
      { repo: 'plateau-app', count: 5, limit: 5, prNumbers: [9] },
    ]);
  });

  it('skips an unavailable (gh read failed) repo — never a false alarm from an unknown count', () => {
    const counts = [{ repoKey: 'we', count: null, limit: 15, unavailable: true, prNumbers: [] }];
    expect(backpressureRows(counts)).toEqual([]);
  });

  it('tolerates a non-array / empty input', () => {
    expect(backpressureRows(undefined)).toEqual([]);
    expect(backpressureRows([])).toEqual([]);
  });
});
