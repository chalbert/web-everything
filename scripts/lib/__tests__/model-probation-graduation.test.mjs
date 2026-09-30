/**
 * agy-launcher-probation — the operator's graduation numbers (2026-09-27, #model-probation-graduation-criteria)
 * and the progress report against them.
 */
import { describe, expect, it } from 'vitest';
import { GRADUATION_NUMBERS, graduationProgress, renderGraduationProgress } from '../model-probation.mjs';
import { criticalMissesFor } from '../critical-work.mjs';

const trial = (o) => ({ subjectClass: 'work-agent', provider: 'codex', model: 'gpt-6-astra', taskType: 'doc-fix', outcome: 'landed', verifiedBy: 'independent-claude', scoredAt: '2026-09-20T00:00:00Z', filesTouched: ['docs/a.md'], ...o });
const many = (n, o) => Array.from({ length: n }, (_, i) => trial({ scoredAt: `2026-09-2${i % 10}T0${i % 10}:00:00Z`, ...o }));

describe('GRADUATION_NUMBERS', () => {
  it('are the operator\'s numbers, and promotion stays human', () => {
    expect(GRADUATION_NUMBERS).toMatchObject({ minTrials: 20, minInformative: 1, maxCriticalMisses: 0, runRatingNoWorseThanClaude: true, decidedOn: '2026-09-27', promotion: 'explicit human decision' });
    expect(Object.isFrozen(GRADUATION_NUMBERS)).toBe(true);
  });
});

describe('graduationProgress', () => {
  it('counts verified work trials per exact triple, skipping review seats, red-team misses and Claude rows', () => {
    const rows = [
      ...many(3, {}),
      trial({ taskType: 'review-lens:correctness' }),
      trial({ taskType: 'red-team-miss:builder' }),
      trial({ dispatchKind: 'review-seat' }),
      trial({ provider: 'anthropic', model: 'claude-opus-5-5' }),
      trial({ verifiedBy: 'other' }),
    ];
    const r = graduationProgress(rows);
    expect(r.triples).toHaveLength(1);
    expect(r.triples[0]).toMatchObject({ provider: 'codex', taskType: 'doc-fix', recorded: 4, verified: 3 });
    expect(r.triples[0].criteria.trials).toEqual({ have: 3, need: 20, met: false });
  });

  it('a launch row awaiting review is "launched", never a verified trial', () => {
    const r = graduationProgress([trial({ taskType: 'ci-heal', outcome: null, verifiedBy: null, dispatchKind: 'probation-launch' })]);
    expect(r.triples[0]).toMatchObject({ launched: 1, verified: 0 });
  });

  it('eligible only when all four hold — and the run rating must be measured on both sides', () => {
    const rows = [...many(19, {}), trial({ outcome: 'reworked', informative: true, filesTouched: ['docs/b.md'], scoredAt: '2026-09-01T00:00:00Z' })];
    const ratings = [
      { provider: 'codex', model: 'gpt-6-astra', grade: 'B', score: 80, taskType: 'doc-fix' },
      { provider: 'anthropic', model: 'claude', grade: 'B', score: 80, taskType: 'doc-fix' },
    ];
    const withRatings = graduationProgress([...rows, ...ratings], { criticalMissesFor });
    const t = withRatings.triples[0];
    expect(t.criteria.trials.met).toBe(true);
    expect(t.criteria.informative.met).toBe(true);
    expect(t.criteria.criticalMisses).toMatchObject({ have: 0, met: true });
    expect(t.criteria.runRating).toMatchObject({ own: 80, claude: 80, status: 'met' });
    expect(t.eligibleForPromotionReview).toBe(true);
    expect(t.next).toMatch(/explicit human decision/);
    const noRatings = graduationProgress(rows, { criticalMissesFor }).triples[0];
    expect(noRatings.criteria.runRating.status).toBe('not-measured');
    expect(noRatings.eligibleForPromotionReview).toBe(false);
  });

  it('a critical miss is a veto, and a miss with no recorded scope counts (fail closed)', () => {
    const rows = [...many(20, {}), trial({ outcome: 'reworked', informative: true, filesTouched: undefined, scoredAt: '2026-09-01T00:00:00Z' })];
    const t = graduationProgress(rows, { criticalMissesFor }).triples[0];
    expect(t.criteria.criticalMisses).toMatchObject({ have: 1, met: false });
    expect(t.eligibleForPromotionReview).toBe(false);
  });

  it('the rendering names the per-provider evidence and an opened task type with no trials', () => {
    const r = graduationProgress([...many(2, {}), trial({ provider: 'antigravity', model: 'gemini-3.8-flash-low', taskType: 'conflict-resolution' })]);
    const text = renderGraduationProgress(r, { openedTaskTypes: ['doc-fix', 'ci-heal'] });
    expect(text).toContain('codex: 2 — doc-fix 2 (2 landed)');
    expect(text).toContain('antigravity: 1 — conflict-resolution 1 (1 landed)');
    expect(text).toContain('(ci-heal, opened on probation: 0 trials by any provider)');
    expect(text).toContain('trials 2/20');
  });

  it('called with NO critical-miss reader it fails closed: qualifying evidence plus a real miss is never graduatable', () => {
    const rows = [...many(20, {}), trial({ outcome: 'reworked', informative: true, filesTouched: undefined, scoredAt: '2026-09-01T00:00:00Z' })];
    const t = graduationProgress(rows).triples[0];
    expect(t.criteria.trials.met).toBe(true);
    expect(t.criteria.informative.met).toBe(true);
    expect(t.criteria.criticalMisses).toMatchObject({ have: null, met: false });
    expect(t.eligibleForPromotionReview).toBe(false);
    expect(t.next).toMatch(/critical-miss reader/);
    expect(t.next).not.toMatch(/null/);
    const text = renderGraduationProgress(graduationProgress(rows));
    expect(text).toContain('critical-miss reader not supplied');
    expect(text).not.toMatch(/null/);
    // with the real reader the same evidence counts the miss.
    expect(graduationProgress(rows, { criticalMissesFor }).triples[0].criteria.criticalMisses).toMatchObject({ have: 1, met: false });
  });
});
