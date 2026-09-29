/**
 * @file git-patch-equivalence.test.mjs — proof of the #4313 shared `git cherry`-output parse: extracted from
 *   `lease-reaper.mjs`'s `defaultGitIsAncestor` and `lane-pool.mjs`'s `cherryAllPatchEquivalent`, which each
 *   independently implemented the same "every line prefixed `-` (or no lines at all) means already
 *   patch-equivalent" check. Pure — no git spawning here; each call site's real-git regression coverage
 *   (`lease-reaper.test.mjs`'s `#4337 — defaultGitIsAncestor …` describes, and
 *   `lane-pool-acquire-explicit-lane-patch-equivalent.test.mjs` / `lane-pool-squash-merge-and-litter-acquirable.test.mjs`)
 *   proves the two call sites still behave identically now that the parse is delegated.
 */
import { describe, it, expect } from 'vitest';
import { isCherryOutputAllPatchEquivalent } from '../git-patch-equivalence.mjs';

describe('isCherryOutputAllPatchEquivalent', () => {
  it('empty output (already ancestor-contained, no ahead commits at all) → true', () => {
    expect(isCherryOutputAllPatchEquivalent('')).toBe(true);
  });

  it('a single `-` line (one ahead commit, patch-equivalent upstream) → true', () => {
    expect(isCherryOutputAllPatchEquivalent('-deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n')).toBe(true);
  });

  it('every line prefixed `-` (all ahead commits patch-equivalent) → true', () => {
    const out = '-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n';
    expect(isCherryOutputAllPatchEquivalent(out)).toBe(true);
  });

  it('a mix including one `+` line (a genuinely unmatched commit) → false', () => {
    const out = '-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n+bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n';
    expect(isCherryOutputAllPatchEquivalent(out)).toBe(false);
  });

  it('a lone `+` line → false', () => {
    expect(isCherryOutputAllPatchEquivalent('+cccccccccccccccccccccccccccccccccccccccc\n')).toBe(false);
  });

  it('blank/trailing-newline-only output → true — matches the `.filter(Boolean)` behavior both original call sites relied on', () => {
    expect(isCherryOutputAllPatchEquivalent('\n\n')).toBe(true);
  });

  it('null/undefined input → throws — #4313 round-1 convergence finding: neither original inline call site had a null-coalesce, so a non-string result (e.g. a mocked `exec` returning undefined) must still throw here, exactly as it did before extraction, rather than silently reading as "contained"', () => {
    expect(() => isCherryOutputAllPatchEquivalent(null)).toThrow();
    expect(() => isCherryOutputAllPatchEquivalent(undefined)).toThrow();
  });
});
