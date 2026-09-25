/**
 * @file scripts/lib/__tests__/pr-limit.test.mjs
 * @description Unit proof of the open-PR backpressure limit's PURE core (we:xniq7xs, parent #4075): the
 *   five behaviours the operator's brief names — over-limit refuses, an infra-only changeset is exempt,
 *   global off allows, a per-branch allow-list entry allows, and under-limit allows — plus the smaller
 *   pure helpers (limit resolution, exemption matching, AI/label counting, override-state parse/expiry).
 */
import { describe, it, expect } from 'vitest';
import {
  PR_LIMIT_DEFAULTS, PR_LIMIT_ENV, resolvePrLimit,
  EXEMPT_PATH_PREFIXES, isExemptPath, isExemptChangeset,
  countBackpressurePrs, decideOpenPr,
  emptyLimitState, parseLimitState, serializeLimitState, parseDurationMs,
  setGlobalOff, clearGlobalOff, allowBranch, normalizeBranchName,
  isGlobalOffNow, isBranchAllowedNow,
  fetchOpenPrs, fetchPrCommits, countOpenPrsForRepo,
} from '../pr-limit.mjs';

describe('resolvePrLimit', () => {
  it('defaults to the operator-set per-repo caps', () => {
    expect(resolvePrLimit('we')).toBe(15);
    expect(resolvePrLimit('frontierui')).toBe(5);
    expect(resolvePrLimit('plateau-app')).toBe(5);
    expect(PR_LIMIT_DEFAULTS).toEqual({ we: 15, frontierui: 5, 'plateau-app': 5 });
  });

  it('an env override wins, per repo, independently', () => {
    expect(resolvePrLimit('we', { [PR_LIMIT_ENV.we]: '3' })).toBe(3);
    expect(resolvePrLimit('frontierui', { [PR_LIMIT_ENV.we]: '3' })).toBe(5); // unaffected by WE's override
  });

  it('ignores a non-numeric or negative override', () => {
    expect(resolvePrLimit('we', { [PR_LIMIT_ENV.we]: 'nope' })).toBe(15);
    expect(resolvePrLimit('we', { [PR_LIMIT_ENV.we]: '-1' })).toBe(15);
  });

  it('an unknown repo key has no cap (Infinity — nothing principled to enforce)', () => {
    expect(resolvePrLimit('unknown-repo', {})).toBe(Infinity);
  });
});

describe('isExemptPath / isExemptChangeset', () => {
  it('matches every listed prefix, both a bare file and a directory', () => {
    expect(isExemptPath('scripts/pr-land.mjs')).toBe(true);
    expect(isExemptPath('scripts/conveyor/tick-core.mjs')).toBe(true);
    expect(isExemptPath('skills-src/conveyor/runner.mjs')).toBe(true);
    expect(isExemptPath('scripts/lib/pr-limit.mjs')).toBe(true);
  });

  it('does not match an ordinary feature file', () => {
    expect(isExemptPath('src/components/widget.ts')).toBe(false);
    expect(isExemptPath('scripts/lib/some-unrelated-lib.mjs')).toBe(false);
  });

  it('a changeset entirely within exempt paths is exempt', () => {
    expect(isExemptChangeset(['scripts/conveyor/tick-core.mjs', 'scripts/pr-land.mjs'])).toBe(true);
  });

  it('one non-exempt file in the mix disqualifies the whole changeset', () => {
    expect(isExemptChangeset(['scripts/conveyor/tick-core.mjs', 'src/components/widget.ts'])).toBe(false);
  });

  it('an empty changeset is never exempt', () => {
    expect(isExemptChangeset([])).toBe(false);
    expect(isExemptChangeset(undefined)).toBe(false);
  });
});

describe('countBackpressurePrs', () => {
  const aiCommit = { authors: [{ name: 'Claude', email: 'noreply@anthropic.com' }], messageBody: '' };
  const humanCommit = { authors: [{ name: 'A Human', email: 'human@example.com' }], messageBody: '' };

  it('counts an AI-generated, not-yet-accepted PR', () => {
    const prs = [{ number: 1, commits: [aiCommit], labels: [] }];
    expect(countBackpressurePrs(prs).map((p) => p.number)).toEqual([1]);
  });

  it('excludes a PR already labelled review:accepted', () => {
    const prs = [{ number: 1, commits: [aiCommit], labels: [{ name: 'review:accepted' }] }];
    expect(countBackpressurePrs(prs)).toEqual([]);
  });

  it('excludes a human-authored PR', () => {
    const prs = [{ number: 1, commits: [humanCommit], labels: [] }];
    expect(countBackpressurePrs(prs)).toEqual([]);
  });
});

describe('decideOpenPr — the five required behaviours', () => {
  const base = { repoKey: 'plateau-app', limit: 5 };

  it('OVER THE LIMIT refuses', () => {
    const d = decideOpenPr({ ...base, openCount: 5 });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/backpressure limit reached for plateau-app: 5\/5/);
  });

  it('an EXEMPT (infra-only) changeset is allowed even over the limit', () => {
    const d = decideOpenPr({ ...base, openCount: 9, changedFiles: ['scripts/conveyor/tick-core.mjs'] });
    expect(d.allowed).toBe(true);
    expect(d.exempt).toBe(true);
  });

  it('GLOBAL OFF allows even over the limit', () => {
    const d = decideOpenPr({ ...base, openCount: 9, globalOff: true });
    expect(d.allowed).toBe(true);
    expect(d.overridden).toBe(true);
  });

  it('a PER-BRANCH allow-list entry allows even over the limit', () => {
    const d = decideOpenPr({ ...base, openCount: 9, branch: 'lane/4080-x', branchAllowed: true });
    expect(d.allowed).toBe(true);
    expect(d.overridden).toBe(true);
  });

  it('UNDER THE LIMIT allows', () => {
    const d = decideOpenPr({ ...base, openCount: 4 });
    expect(d.allowed).toBe(true);
    expect(d.reason).toMatch(/under limit \(4\/5\)/);
  });

  it('--force-open with a reason allows even over the limit', () => {
    const d = decideOpenPr({ ...base, openCount: 9, forceOpen: true, forceReason: 'operator asked in chat' });
    expect(d.allowed).toBe(true);
    expect(d.overridden).toBe(true);
    expect(d.reason).toContain('operator asked in chat');
  });

  it('an unavailable live count (gh read failed) fails OPEN, never blocks', () => {
    const d = decideOpenPr({ ...base, openCount: null });
    expect(d.allowed).toBe(true);
  });

  it('exemption is checked before overrides and before the limit', () => {
    const d = decideOpenPr({ ...base, openCount: 5, changedFiles: ['scripts/pr-land.mjs'], globalOff: false });
    expect(d.exempt).toBe(true);
    expect(d.allowed).toBe(true);
  });
});

describe('fetchOpenPrs / fetchPrCommits / countOpenPrsForRepo — the IO shell', () => {
  const aiCommit = { authors: [{ name: 'Claude', email: 'noreply@anthropic.com' }], messageBody: '' };
  const humanCommit = { authors: [{ name: 'A Human', email: 'human@example.com' }], messageBody: '' };

  it('fetchOpenPrs asks for number,labels,headRefName — deliberately NOT commits (the GraphQL node-limit footgun)', () => {
    const exec = (args) => { expect(args).toEqual(expect.arrayContaining(['--json', 'number,labels,headRefName'])); expect(args).not.toContain('commits'); return '[]'; };
    expect(fetchOpenPrs('o/n', { exec })).toEqual([]);
  });

  it('fetchOpenPrs degrades to null (never throws) on a gh failure or unparsable output', () => {
    expect(fetchOpenPrs('o/n', { exec: () => { throw new Error('gh: not found'); } })).toBeNull();
    expect(fetchOpenPrs('o/n', { exec: () => 'not json' })).toBeNull();
  });

  it('fetchPrCommits fetches ONE PR at a time via `gh pr view <n> --json commits`', () => {
    const exec = (args) => { expect(args).toEqual(['pr', 'view', '42', '--repo', 'o/n', '--json', 'commits']); return JSON.stringify({ commits: [aiCommit] }); };
    expect(fetchPrCommits('o/n', 42, { exec })).toEqual([aiCommit]);
  });

  it('fetchPrCommits degrades to null (never []) on failure — unknown authorship is never assumed empty', () => {
    expect(fetchPrCommits('o/n', 42, { exec: () => { throw new Error('boom'); } })).toBeNull();
    expect(fetchPrCommits('o/n', 42, { exec: () => '{}' })).toBeNull();
  });

  it('countOpenPrsForRepo: one list call + one commits call per not-yet-accepted PR, then applies the AI/label rubric', () => {
    const calls = [];
    const exec = (args) => {
      calls.push(args);
      if (args[1] === 'list') return JSON.stringify([{ number: 1, labels: [] }, { number: 2, labels: [{ name: 'review:accepted' }] }, { number: 3, labels: [] }]);
      if (args[0] === 'pr' && args[1] === 'view') {
        const num = args[2];
        if (num === '1') return JSON.stringify({ commits: [aiCommit] });
        if (num === '3') return JSON.stringify({ commits: [humanCommit] });
      }
      throw new Error(`unexpected call: ${JSON.stringify(args)}`);
    };
    const result = countOpenPrsForRepo('we', { exec, env: {} });
    expect(result).toEqual({ repoKey: 'we', slug: 'chalbert/web-everything', count: 1, prNumbers: [1], limit: 15, unavailable: false });
    // Exactly one list call + one commits call per NOT-accepted PR (#2 is skipped — already accepted).
    expect(calls.filter((a) => a[1] === 'list')).toHaveLength(1);
    expect(calls.filter((a) => a[0] === 'pr' && a[1] === 'view')).toHaveLength(2);
  });

  it('countOpenPrsForRepo is unavailable when the list call fails, and unknown for an unrecognized repo key', () => {
    expect(countOpenPrsForRepo('we', { exec: () => { throw new Error('boom'); }, env: {} }).unavailable).toBe(true);
    expect(countOpenPrsForRepo('not-a-repo', { env: {} })).toEqual({ repoKey: 'not-a-repo', slug: null, count: null, prNumbers: [], limit: Infinity, unavailable: true });
  });
});

describe('override-state parse/serialize', () => {
  it('parses a corrupt/empty store as the empty (enforced) state — fails OPEN to enforcement', () => {
    expect(parseLimitState('')).toEqual(emptyLimitState());
    expect(parseLimitState('not json')).toEqual(emptyLimitState());
    expect(parseLimitState('[1,2,3]')).toEqual(emptyLimitState());
  });

  it('round-trips through serialize/parse', () => {
    const s = setGlobalOff(emptyLimitState(), { reason: 'review system down', by: 'nic' }, 0);
    const round = parseLimitState(serializeLimitState(s));
    expect(round.global.off).toBe(true);
    expect(round.global.reason).toBe('review system down');
    expect(round.global.by).toBe('nic');
  });

  it('every override is logged with actor + reason in history', () => {
    let s = emptyLimitState();
    s = setGlobalOff(s, { reason: 'r1', by: 'nic' }, 0);
    s = allowBranch(s, 'lane/4080-x', { reason: 'r2', by: 'nic' }, 0);
    expect(s.history).toHaveLength(2);
    expect(s.history[0]).toMatchObject({ action: 'off', actor: 'nic', reason: 'r1' });
    expect(s.history[1]).toMatchObject({ action: 'allow-branch', actor: 'nic', reason: 'r2', target: 'lane/4080-x' });
  });
});

describe('parseDurationMs', () => {
  it('parses minutes/hours/days', () => {
    expect(parseDurationMs('30m')).toBe(30 * 60_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationMs('1d')).toBe(86_400_000);
  });
  it('returns null for garbage / absent input', () => {
    expect(parseDurationMs('nope')).toBeNull();
    expect(parseDurationMs(undefined)).toBeNull();
  });
});

describe('global off expiry (--for=<duration>)', () => {
  it('is in effect before expiry and auto-clears after', () => {
    const untilMs = parseDurationMs('2h');
    const s = setGlobalOff(emptyLimitState(), { reason: 'x', untilMs }, 1_000_000);
    expect(isGlobalOffNow(s, 1_000_000 + 60_000)).toBe(true); // 1 min later — still off
    expect(isGlobalOffNow(s, 1_000_000 + untilMs + 1)).toBe(false); // past expiry — auto re-armed
  });

  it('with no --for, stays off until explicitly cleared', () => {
    const s = setGlobalOff(emptyLimitState(), { reason: 'x' }, 0);
    expect(isGlobalOffNow(s, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isGlobalOffNow(clearGlobalOff(s))).toBe(false);
  });
});

describe('branch allow-list matching', () => {
  it('matches with or without the lane/ prefix', () => {
    const s = allowBranch(emptyLimitState(), '4080-foo', { reason: 'x' }, 0);
    expect(isBranchAllowedNow(s, '4080-foo')).toBe(true);
    expect(isBranchAllowedNow(s, 'lane/4080-foo')).toBe(true);
    expect(isBranchAllowedNow(s, 'lane/9999-bar')).toBe(false);
  });

  it('normalizeBranchName strips a leading lane/', () => {
    expect(normalizeBranchName('lane/123-x')).toBe('123-x');
    expect(normalizeBranchName('123-x')).toBe('123-x');
  });

  it('an expired per-branch allow no longer applies', () => {
    const s = allowBranch(emptyLimitState(), '4080-foo', { reason: 'x', untilMs: 1000 }, 0);
    expect(isBranchAllowedNow(s, '4080-foo', 500)).toBe(true);
    expect(isBranchAllowedNow(s, '4080-foo', 1001)).toBe(false);
  });
});
