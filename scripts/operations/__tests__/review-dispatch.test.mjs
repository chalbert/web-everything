/**
 * @file review-dispatch.test.mjs — `#3279`: dispatch an independent review to a fresh session.
 *
 * NOTHING HERE SPAWNS A REAL PROCESS: `spawnAgent` is a recorder, `readBrief` is a stub template, and
 * `mintSessionId` is deterministic — so every assertion is about the ARGV and the FILLED PROMPT this operation
 * would actually send, not about `claude` itself (which `dispatch-lane-io.mjs`'s own live-spawn test already
 * covers for the shared `buildAgentArgv`/`defaultSpawnAgent` machinery this file reuses verbatim).
 */

import { describe, it, expect } from 'vitest';

import {
  assertMainNotStale, canonicalReviewPlaceholder, dispatchReview, fillReviewBrief, planReviewDispatch,
  reviewSessionSlug, REVIEW_BRIEF_PLACEHOLDERS,
} from '../review-dispatch.mjs';

// A `checkStaleness` stub that never touches git — every `dispatchReview` test below injects one, so none of
// them depend on real subprocess/network fail-soft behavior for a nonexistent `root`.
const FRESH = () => ({ fresh: true, behind: 0 });

const REAL_TEMPLATE_STUB = [
  '# brief for {{PR}} in {{REPO}}',
  'acquire: node scripts/lane-pool.mjs acquire --session={{SESSION_SLUG}}',
  'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
].join('\n');

describe('planReviewDispatch', () => {
  it('derives a distinct, review-only session slug', () => {
    expect(planReviewDispatch({ pr: 1234, repo: 'chalbert/web-everything' })).toEqual({
      pr: 1234, repo: 'chalbert/web-everything', sessionSlug: 'review-1234',
    });
  });

  it('refuses a non-positive-integer PR', () => {
    expect(() => planReviewDispatch({ pr: 0, repo: 'o/r' })).toThrow(/positive integer/);
    expect(() => planReviewDispatch({ pr: 'abc', repo: 'o/r' })).toThrow(/positive integer/);
    expect(() => planReviewDispatch({ pr: -5, repo: 'o/r' })).toThrow(/positive integer/);
  });

  it('refuses a repo that is not an owner/repo slug', () => {
    expect(() => planReviewDispatch({ pr: 1, repo: 'not-a-slug' })).toThrow(/owner\/repo/);
    expect(() => planReviewDispatch({ pr: 1, repo: '' })).toThrow(/owner\/repo/);
  });
});

describe('reviewSessionSlug', () => {
  it('is its own namespace, distinct from dispatch-lane\'s conveyor-<num>/prepare-<num>', () => {
    expect(reviewSessionSlug(42)).toBe('review-42');
  });

  it('refuses an empty PR', () => {
    expect(() => reviewSessionSlug('')).toThrow(/needs a PR number/);
  });
});

describe('fillReviewBrief', () => {
  const values = { PR: 1234, REPO: 'chalbert/web-everything', SESSION_SLUG: 'review-1234' };

  it('substitutes all three placeholders and reports (never refuses) an unrelated bracketed token', () => {
    const { prompt, unknownTokens } = fillReviewBrief(REAL_TEMPLATE_STUB, values);
    expect(prompt).toContain('# brief for 1234 in chalbert/web-everything');
    expect(prompt).toContain('--session=review-1234');
    expect(unknownTokens).toEqual(['{{LIKE_THIS}}']);
  });

  it('refuses an empty template', () => {
    expect(() => fillReviewBrief('', values)).toThrow(/template is empty/);
  });

  it('refuses a missing value', () => {
    expect(() => fillReviewBrief('{{PR}} {{REPO}} {{SESSION_SLUG}}', { PR: 1, REPO: 'o/r' }))
      .toThrow(/no value for the brief placeholder \{\{SESSION_SLUG\}\}/);
  });

  it('refuses a value carrying shell-unsafe characters', () => {
    expect(() => fillReviewBrief('{{PR}} {{REPO}} {{SESSION_SLUG}}', { ...values, REPO: 'o/r; rm -rf /' }))
      .toThrow(/characters the brief cannot carry safely/);
  });

  it('refuses a MISSPELLED placeholder rather than shipping it unfilled', () => {
    expect(() => fillReviewBrief('{{ PR }} {{REPO}} {{SESSION_SLUG}}', values))
      .toThrow(/MISSPELLED placeholder/);
  });

  it('canonicalizes separator/case variants of the three real names', () => {
    expect(canonicalReviewPlaceholder('session_slug')).toBe('SESSION_SLUG');
    expect(canonicalReviewPlaceholder('Session-Slug')).toBe('SESSION_SLUG');
    expect(canonicalReviewPlaceholder('bogus')).toBeNull();
  });

  it('the placeholder roster is exactly PR, REPO, SESSION_SLUG', () => {
    expect(REVIEW_BRIEF_PLACEHOLDERS).toEqual(['PR', 'REPO', 'SESSION_SLUG']);
  });
});

describe('dispatchReview — the composition: plan → fill → mint → spawn', () => {
  it('spawns exactly once, with a freshly minted session id and the filled brief as the prompt', () => {
    const calls = [];
    const result = dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toEqual({ cwd: '/repo' });
    expect(calls[0].argv).toEqual([
      '--bg',
      '--session-id', '11111111-1111-4111-8111-111111111111',
      '-n', 'review-1234',
      '# brief for 1234 in chalbert/web-everything\n'
      + 'acquire: node scripts/lane-pool.mjs acquire --session=review-1234\n'
      + 'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
    ]);

    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.sessionSlug).toBe('review-1234');
    expect(result.pr).toBe(1234);
    expect(result.repo).toBe('chalbert/web-everything');
    expect(result.unknownTokens).toEqual(['{{LIKE_THIS}}']);
  });

  it('refuses to dispatch from inside a lane checkout, same guard dispatch-lane-io.mjs uses', () => {
    expect(() => dispatchReview({
      pr: 1, repo: 'o/r', root: '/some/path/.lanes/web-everything/lane-3',
      readBrief: () => REAL_TEMPLATE_STUB,
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: FRESH,
    })).toThrow(/lane/i);
  });

  it('never spawns when the plan itself refuses (bad PR/repo caught before any fs/spawn call)', () => {
    let readBriefCalls = 0;
    expect(() => dispatchReview({
      pr: -1, repo: 'o/r', root: '/repo',
      readBrief: () => { readBriefCalls += 1; return REAL_TEMPLATE_STUB; },
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: FRESH,
    })).toThrow(/positive integer/);
    expect(readBriefCalls).toBe(0);
  });

  // #xw3k2v9 — PR #1756 review finding: `extraArgs` was accepted and documented as forwarded, but the call to
  // `buildAgentArgv` never referenced it, so any caller-supplied flag (a `--permission-mode`, a `--model`
  // override) was silently dropped. This is the regression test for that fix.
  it('forwards extraArgs to buildAgentArgv, exactly like dispatch-lane-io.mjs does for its own dispatch', () => {
    const calls = [];
    dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      extraArgs: ['--permission-mode', 'plan'],
      checkStaleness: FRESH,
    });
    expect(calls[0].argv).toEqual([
      '--bg',
      '--session-id', '11111111-1111-4111-8111-111111111111',
      '-n', 'review-1234',
      '--permission-mode', 'plan',
      '# brief for 1234 in chalbert/web-everything\n'
      + 'acquire: node scripts/lane-pool.mjs acquire --session=review-1234\n'
      + 'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
    ]);
  });
});

// #3439 — a dispatched review spawns with its own `cwd`-relative import path, so a dispatching checkout N
// commits behind origin/main silently runs pre-fix code with no error. These prove the refusal is real.
describe('assertMainNotStale', () => {
  it('passes through a fresh checkout untouched', () => {
    expect(assertMainNotStale('/repo', FRESH)).toEqual({ fresh: true, behind: 0 });
  });

  it('refuses a checkout N commits behind origin/main, naming the count', () => {
    expect(() => assertMainNotStale('/repo', () => ({ action: 'warn', behind: 12, ahead: 0, dirty: false, warning: 'stub' })))
      .toThrow(/12 commit\(s\) behind origin\/main/);
  });

  it('refuses a DIVERGED checkout the same way — being behind at all is disqualifying, not just non-fast-forwardable', () => {
    expect(() => assertMainNotStale('/repo', () => ({ action: 'warn', behind: 3, ahead: 2, dirty: false, warning: 'stub' })))
      .toThrow(/3 commit\(s\) behind/);
  });

  it('does not refuse when the staleness check is offline (fail-soft, matching main-staleness.mjs itself)', () => {
    expect(assertMainNotStale('/repo', () => ({ offline: true }))).toEqual({ offline: true });
  });
});

describe('dispatchReview — refuses to spawn from a stale checkout (#3439)', () => {
  it('refuses before reading the brief or spawning, when behind origin/main', () => {
    let readBriefCalls = 0;
    expect(() => dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => { readBriefCalls += 1; return REAL_TEMPLATE_STUB; },
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: () => ({ action: 'warn', behind: 9, ahead: 0, dirty: false, warning: 'stub' }),
    })).toThrow(/9 commit\(s\) behind origin\/main/);
    expect(readBriefCalls).toBe(0);
  });

  it('proceeds to spawn when the checkout is fresh', () => {
    const calls = [];
    dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });
    expect(calls).toHaveLength(1);
  });
});
