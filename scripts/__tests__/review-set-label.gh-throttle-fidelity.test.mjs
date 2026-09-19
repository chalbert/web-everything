/**
 * @file review-set-label.gh-throttle-fidelity.test.mjs
 * @description REAL, side-by-side pass-through fidelity proof for the #3631 slice that migrated
 *   `we:scripts/review-set-label.mjs`'s last bare `execFileSync` — the `computeNetDiffText` exec closure at its
 *   #x169fqe net-diff read — onto `we:scripts/lib/gh-throttle.mjs#execFileSyncThrottled`. Mirrors the discipline
 *   `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs` already established for the wrapper itself: a real
 *   side-by-side comparison against the ACTUAL binaries, never a mock — the exact class of "mocked green, real
 *   red" gap a `--session-id` bug elsewhere in this codebase fell into.
 *
 * TWO THINGS PROVEN FOR REAL, because `execFileSyncThrottled` is a single dispatcher over two different
 * binaries and both paths matter here:
 *
 *   1. `cmd==='git'` — what this file's OWN call site actually sends today (a fetch/diff/merge-base against
 *      `origin`, never a `gh` call). `execFileSyncThrottled` falls straight through to a real
 *      `execFileSync('git', args, opts)` for any non-`'gh'` file, so this proves that fallthrough is
 *      byte-for-byte identical to the bare call this migration replaced.
 *   2. `cmd==='gh'` — proving the SAME imported function is ALSO faithful for `gh`, because it is the identical
 *      function object `we:scripts/conveyor/ci-queue-watch.mjs#defaultListRuns` already defaults to (not a
 *      re-implementation) and this file now shares that seam. A read-only, already-completed, real `gh pr view`
 *      against an already-merged PR — never a mutating call.
 *
 * SKIPS CLEANLY (never fails red) when `gh`/`git` are unavailable/unauthenticated — proves fidelity when the
 * real tools are available; the PURE `decideSetLabel` suite in `review-set-label.test.mjs` needs neither.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { execFileSyncThrottled } from '../lib/gh-throttle.mjs';

function ghAvailable() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const available = ghAvailable();
const d = available ? describe : describe.skip;

d('review-set-label.mjs #3631 slice — real side-by-side fidelity for execFileSyncThrottled', () => {
  describe('cmd==="git" — the shape this file\'s own computeNetDiffText exec closure actually sends', () => {
    it('byte-identical stdout on a real, immutable read (HEAD of a fixed, already-resolved commit)', () => {
      // `git rev-parse` of an already-resolved SHA is as immutable as a real command gets: no working-tree
      // state, no clock, nothing that can legitimately differ between two calls microseconds apart.
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const args = ['rev-parse', '--verify', head];
      const raw = execFileSync('git', args, { encoding: 'utf8' });
      const throttled = execFileSyncThrottled('git', args, { encoding: 'utf8' });
      expect(throttled).toBe(raw);
    });

    it('byte-identical stdout on the actual shape this call site uses (git diff --numstat between two fixed refs)', () => {
      // Mirrors `resolveNetDiffBasis`'s own probe shape (`git diff --numstat --end-of-options <base> <candidate>`)
      // against two commits that can never move: `HEAD` and its own parent.
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const parent = execFileSync('git', ['rev-parse', `${head}~1`], { encoding: 'utf8' }).trim();
      const args = ['diff', '--numstat', '--end-of-options', parent, head];
      const raw = execFileSync('git', args, { encoding: 'utf8' });
      const throttled = execFileSyncThrottled('git', args, { encoding: 'utf8' });
      expect(throttled).toBe(raw);
    });

    it('a real git failure throws the SAME shape (status, stderr) as a raw execFileSync throw', () => {
      const args = ['rev-parse', '--verify', 'this-ref-does-not-exist-3631'];
      let rawErr = null, throttledErr = null;
      try { execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { rawErr = e; }
      try { execFileSyncThrottled('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { throttledErr = e; }
      expect(rawErr).not.toBeNull();
      expect(throttledErr).not.toBeNull();
      expect(throttledErr.status).toBe(rawErr.status);
      expect(String(throttledErr.stderr)).toBe(String(rawErr.stderr));
    });
  });

  describe('cmd==="gh" — the same imported dispatcher is also faithful for gh (the wrapper\'s other branch)', () => {
    let repoSlug;
    let realPrNum;

    beforeAll(() => {
      repoSlug = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim();
      // A real, already-merged PR on this repo — safe, read-only, and stable (won't change again).
      const merged = JSON.parse(execFileSync('gh', ['pr', 'list', '--repo', repoSlug, '--state', 'merged', '--limit', '1', '--json', 'number'], { encoding: 'utf8' }));
      realPrNum = merged[0].number;
    });

    it('byte-identical stdout on a real, already-merged PR (immutable fields, read-only)', () => {
      const args = ['pr', 'view', String(realPrNum), '--repo', repoSlug, '--json', 'number,state,title'];
      const raw = execFileSync('gh', args, { encoding: 'utf8' });
      const throttled = execFileSyncThrottled('gh', args, { encoding: 'utf8' });
      expect(throttled).toBe(raw); // an already-merged PR's number/state/title cannot change between the two calls
    });

    it('a real gh failure (unknown PR number) throws the SAME shape as a raw execFileSync throw', () => {
      const args = ['pr', 'view', '999999999', '--repo', repoSlug, '--json', 'number'];
      let rawErr = null, throttledErr = null;
      try { execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { rawErr = e; }
      try { execFileSyncThrottled('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { throttledErr = e; }
      expect(rawErr).not.toBeNull();
      expect(throttledErr).not.toBeNull();
      expect(throttledErr.status).toBe(rawErr.status);
      expect(String(throttledErr.stderr)).toBe(String(rawErr.stderr));
    });
  });
});
