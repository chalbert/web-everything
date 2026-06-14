/**
 * Platform-default VCS convention vocabulary (#579) — the config-extends-platform-default resolve seam and
 * the conformance validators the gate enforces / the bot self-checks against.
 */
import { describe, it, expect } from 'vitest';
import {
  platformDefaultVcsConventions,
  resolveVcsConventions,
  checkBranchName,
  checkCommitMessage,
  checkPullRequest,
} from '../conventions/vcs';

describe('resolveVcsConventions (config-extends-platform-default)', () => {
  it('returns the platform default when no override is given', () => {
    expect(resolveVcsConventions()).toEqual(platformDefaultVcsConventions);
  });

  it('overrides only the authored deltas, per sub-vocabulary (nearest wins)', () => {
    const resolved = resolveVcsConventions({
      branch: { base: 'develop' },
      commit: { coAuthoredBy: null, requireTraceRef: false },
    });
    expect(resolved.branch.base).toBe('develop');
    expect(resolved.branch.types).toEqual(platformDefaultVcsConventions.branch.types); // untouched
    expect(resolved.commit.coAuthoredBy).toBeNull();
    expect(resolved.commit.requireTraceRef).toBe(false);
    expect(resolved.commit.format).toBe('conventional'); // untouched default preserved
    expect(resolved.pullRequest).toEqual(platformDefaultVcsConventions.pullRequest); // whole layer untouched
  });

  it('does not mutate the platform default', () => {
    resolveVcsConventions({ branch: { base: 'release' } });
    expect(platformDefaultVcsConventions.branch.base).toBe('main');
  });
});

describe('checkBranchName', () => {
  const conv = resolveVcsConventions();
  it('accepts a well-formed {type}/{slug} branch', () => {
    expect(checkBranchName('fix/null-guard', conv).ok).toBe(true);
  });
  it('rejects a missing type slot, an unknown type, and an empty slug', () => {
    expect(checkBranchName('no-slash', conv).ok).toBe(false);
    expect(checkBranchName('frobnicate/x', conv).violations[0]).toMatch(/not one of/);
    expect(checkBranchName('fix/', conv).ok).toBe(false);
  });
  it('falls back to presence for a custom pattern', () => {
    const custom = resolveVcsConventions({ branch: { pattern: 'wip-{slug}' } });
    expect(checkBranchName('wip-anything', custom).ok).toBe(true);
    expect(checkBranchName('', custom).ok).toBe(false);
  });
});

describe('checkCommitMessage', () => {
  const conv = resolveVcsConventions();
  const trailer = platformDefaultVcsConventions.commit.coAuthoredBy!;

  it('accepts a conformant conventional commit with trailer + trace ref', () => {
    const msg = `fix(gate): guard null verdict (#579)\n\nAddresses the failing check.\n\n${trailer}`;
    expect(checkCommitMessage(msg, conv)).toEqual({ ok: true, violations: [] });
  });

  it('flags a non-conventional subject', () => {
    const msg = `made some changes (#1)\n\n${trailer}`;
    expect(checkCommitMessage(msg, conv).violations.some((v) => /Conventional Commits/.test(v))).toBe(true);
  });

  it('flags an unknown type, a missing trailer, and a missing trace ref', () => {
    const noTrailer = checkCommitMessage('feat: add thing referencing #5', conv);
    expect(noTrailer.violations.some((v) => /Co-Authored-By/.test(v))).toBe(true);

    const noTrace = checkCommitMessage(`feat: add thing\n\n${trailer}`, conv);
    expect(noTrace.violations.some((v) => /trace\/failure back-reference/.test(v))).toBe(true);

    const badType = checkCommitMessage(`frob: do it (#1)\n\n${trailer}`, conv);
    expect(badType.violations.some((v) => /not one of/.test(v))).toBe(true);
  });

  it('flags an over-length subject', () => {
    const long = `fix: ${'x'.repeat(80)} (#1)\n\n${trailer}`;
    expect(checkCommitMessage(long, conv).violations.some((v) => /max 72/.test(v))).toBe(true);
  });

  it('honours a project override that drops the trailer + trace requirement', () => {
    const relaxed = resolveVcsConventions({ commit: { coAuthoredBy: null, requireTraceRef: false } });
    expect(checkCommitMessage('fix: small tidy', relaxed)).toEqual({ ok: true, violations: [] });
  });
});

describe('checkPullRequest', () => {
  const conv = resolveVcsConventions();
  it('accepts a conventional title with a back-reference in the body', () => {
    expect(checkPullRequest({ title: 'fix: guard null', body: 'Fixes #579.' }, conv).ok).toBe(true);
  });
  it('flags a non-conventional title and a missing back-reference', () => {
    const r = checkPullRequest({ title: 'My PR', body: 'no link here' }, conv);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(2);
  });
});
