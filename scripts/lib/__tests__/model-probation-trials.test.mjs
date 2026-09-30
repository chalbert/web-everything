/**
 * #4290 — a probation launch becomes a judged trial once its PR's review verdict lands, through the real path:
 * the launcher's own launch row, the shared scorecard store, and the graduation report that reads it.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  graduationProgress, judgePendingTrials, judgedTrialRow, pendingProbationLaunches, trialOutcomeFromPr,
} from '../model-probation.mjs';
import { launchScorecardRow } from '../probation-launcher.mjs';
import { appendScorecard, readStore } from '../../conveyor/run-scorecard-store.mjs';
import { criticalMissesFor, isCriticalMiss } from '../critical-work.mjs';

const worker = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', taskType: 'ci-heal' };
const launch = (o = {}) => launchScorecardRow({ worker, pr: 101, repo: 'o/r', handle: 'heal-101', launchOutcome: 'healed', diff: { files: 1, loc: 4 }, scoredAt: '2026-09-27T00:00:00Z', ...o });

describe('trialOutcomeFromPr', () => {
  it.each([
    [{ state: 'MERGED', labels: [] }, 'landed'],
    [{ state: 'OPEN', mergedAt: '2026-09-28T00:00:00Z' }, 'landed'],
    [{ state: 'CLOSED', mergedAt: null, labels: [{ name: 'review:accepted' }] }, 'rejected'],
    [{ state: 'OPEN', labels: [{ name: 'review:changes' }] }, 'reworked'],
    [{ state: 'OPEN', labels: ['review:changes'] }, 'reworked'],
    [{ state: 'OPEN', labels: [{ name: 'review:accepted' }] }, null],
    [{ state: 'OPEN', labels: [{ name: 'review:pending' }] }, null],
    [{ state: 'OPEN', labels: [{ name: 'review:human' }] }, null],
    [{ state: 'OPEN' }, null],
    [null, null],
    ['MERGED', null],
  ])('%j → %s', (pr, want) => expect(trialOutcomeFromPr(pr)).toBe(want));
});

describe('pendingProbationLaunches', () => {
  it('only pushed heals with a PR and no trial yet', () => {
    const rows = [
      launch(),
      launch({ handle: 'h-gate-red', launchOutcome: 'gate-red' }),
      launch({ handle: 'h-no-pr', pr: null }),
      launch({ handle: 'h-done' }),
      judgedTrialRow(launch({ handle: 'h-done' }), { outcome: 'landed' }),
    ];
    expect(pendingProbationLaunches(rows).map((r) => r.handle)).toEqual(['heal-101']);
    expect(pendingProbationLaunches(null)).toEqual([]);
  });
});

describe('judgedTrialRow', () => {
  it('refuses an outcome outside landed|reworked|rejected', () => {
    expect(() => judgedTrialRow(launch(), { outcome: 'healed' })).toThrow(/landed\|reworked\|rejected/);
  });

  it('never infers informative, and stamps the critical-miss answer on the PR\'s real scope', () => {
    const safe = judgedTrialRow(launch(), { outcome: 'reworked', changedFiles: ['docs/a.md'], isCriticalMiss });
    expect(safe).toMatchObject({ outcome: 'reworked', informative: false, verifiedBy: 'independent-claude', filesTouched: ['docs/a.md'], criticalMiss: false });
    const unscoped = judgedTrialRow(launch(), { outcome: 'rejected', isCriticalMiss });
    expect(unscoped.criticalMiss).toBe(true); // no scope on record ⇒ fail closed
    expect(unscoped).not.toHaveProperty('filesTouched');
  });
});

describe('judgePendingTrials through the real scorecard store', () => {
  let dir;
  let io;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'probation-trials-')); io = { path: join(dir, 'run-scorecards.json') }; });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('converts a reviewed launch into a verified trial the report counts, once', () => {
    appendScorecard(launch(), io);
    appendScorecard(launch({ handle: 'heal-102', pr: 102 }), io);
    const prs = {
      101: { state: 'MERGED', labels: [{ name: 'review:accepted' }], files: [{ path: 'docs/a.md' }] },
      102: { state: 'OPEN', labels: [{ name: 'review:pending' }], files: [] },
    };
    const sweep = () => judgePendingTrials(readStore(io).records, {
      lookupPr: (l) => prs[l.pr], append: (row) => appendScorecard(row, io), isCriticalMiss, now: () => '2026-09-28T00:00:00Z',
    });

    const before = graduationProgress(readStore(io).records, { criticalMissesFor }).triples[0];
    expect(before).toMatchObject({ launched: 2, verified: 0 });

    const first = sweep();
    expect(first.judged.map((r) => [r.pr, r.outcome])).toEqual([[101, 'landed']]);
    expect(first.pending.map((r) => r.pr)).toEqual([102]);

    const after = graduationProgress(readStore(io).records, { criticalMissesFor }).triples[0];
    expect(after).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', taskType: 'ci-heal', launched: 1, verified: 1, outcomes: { landed: 1 } });

    // Idempotent: a second sweep adds nothing for 101; 102 is judged once its review sends it back.
    prs[102] = { state: 'OPEN', labels: [{ name: 'review:changes' }], files: [{ path: 'scripts/review-set-label.mjs' }] };
    const second = sweep();
    expect(second.judged.map((r) => [r.pr, r.outcome, r.criticalMiss])).toEqual([[102, 'reworked', true]]);
    expect(sweep().judged).toEqual([]);

    const final = graduationProgress(readStore(io).records, { criticalMissesFor }).triples[0];
    expect(final).toMatchObject({ launched: 0, verified: 2, outcomes: { landed: 1, reworked: 1 } });
    expect(final.criteria.criticalMisses).toMatchObject({ have: 1, met: false });
  });

  it('a failed PR lookup leaves the launch pending — never a guessed outcome', () => {
    appendScorecard(launch(), io);
    const r = judgePendingTrials(readStore(io).records, { lookupPr: () => { throw new Error('gh down'); }, append: (row) => appendScorecard(row, io) });
    expect(r).toMatchObject({ judged: [], pending: [{ pr: 101 }] });
    expect(readStore(io).records).toHaveLength(1);
  });
});
