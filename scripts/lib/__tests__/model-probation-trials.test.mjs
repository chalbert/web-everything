/**
 * #4290 — a probation launch becomes a judged trial once its PR's review verdict lands, through the real path:
 * the launcher's own launch row, the shared scorecard store, and the graduation report that reads it.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  graduationProgress, judgePendingTrials, judgedTrialRow, pendingProbationLaunches, runJudge, trialOutcomeFromPr,
} from '../model-probation.mjs';
import { launchScorecardRow } from '../probation-launcher.mjs';
import { appendScorecard, appendScorecardUnlessJudged, readStore } from '../../conveyor/run-scorecard-store.mjs';
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
      judgedTrialRow(launch({ handle: 'h-done' }), { outcome: 'landed', isCriticalMiss }),
    ];
    expect(pendingProbationLaunches(rows).map((r) => r.handle)).toEqual(['heal-101']);
    expect(pendingProbationLaunches(null)).toEqual([]);
  });
});

describe('judgedTrialRow', () => {
  it('refuses an outcome outside landed|reworked|rejected', () => {
    expect(() => judgedTrialRow(launch(), { outcome: 'healed', isCriticalMiss })).toThrow(/landed\|reworked\|rejected/);
  });

  it('never infers informative, and stamps the critical-miss answer on the PR\'s real scope', () => {
    const safe = judgedTrialRow(launch(), { outcome: 'reworked', changedFiles: ['docs/a.md'], reviewed: true, isCriticalMiss });
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
    prs[102] = { state: 'OPEN', labels: [{ name: 'review:changes' }], reviewLabelAt: '2026-09-28T00:00:00Z', files: [{ path: 'scripts/review-set-label.mjs' }] };
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
    expect(r).toMatchObject({ judged: [], pending: [], failed: [{ pr: 101 }] });
    expect(readStore(io).records).toHaveLength(1);
  });
});

describe('guard 1 — the verdict label must postdate the launch', () => {
  const pr = (reviewLabelAt) => ({ state: 'OPEN', labels: [{ name: 'review:changes' }], ...(reviewLabelAt ? { reviewLabelAt } : {}) });
  const l = launch(); // scoredAt 2026-09-27T00:00:00Z
  it('stale, equal or missing label time stays pending; a later one judges reworked', () => {
    const o = (p) => trialOutcomeFromPr(p, { launchScoredAt: l.scoredAt });
    expect(o(pr('2026-09-26T00:00:00Z'))).toBeNull();
    expect(o(pr('2026-09-27T00:00:00Z'))).toBeNull();
    expect(o(pr())).toBeNull();
    expect(o(pr('2026-09-28T00:00:00Z'))).toBe('reworked');
  });
  it('through the sweep', () => {
    const run = (p) => judgePendingTrials([l], { lookupPr: () => p, isCriticalMiss });
    expect(run(pr('2026-09-26T00:00:00Z'))).toMatchObject({ judged: [], pending: [{ pr: 101 }] });
    expect(run(pr('2026-09-28T00:00:00Z')).judged.map((r) => r.outcome)).toEqual(['reworked']);
  });
});

describe('guard 2 — runJudge', () => {
  let dir;
  let io;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'probation-judge-')); io = { path: join(dir, 'run-scorecards.json') }; });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const merged = { state: 'MERGED', labels: [{ name: 'review:accepted' }], files: [{ path: 'docs/a.md' }] };

  it('dry run writes nothing; a real run appends once; lookup errors are failed, not pending', () => {
    appendScorecard(launch(), io);
    appendScorecard(launch({ handle: 'heal-102', pr: 102 }), io);
    appendScorecard(launch({ handle: 'heal-103', pr: 103 }), io);
    const lookupPr = (l) => {
      if (l.pr === 102) throw new Error('gh down');
      return l.pr === 101 ? merged : { state: 'OPEN', labels: [] };
    };
    const lines = [];
    expect(runJudge({ lookupPr, io, dryRun: true, log: (x) => lines.push(x) })).toMatchObject({ judged: 1, pending: 1, failed: 1 });
    expect(readStore(io).records).toHaveLength(3);
    expect(lines.at(-1)).toBe('1 judged, 1 awaiting a verdict, 1 lookups failed');
    runJudge({ lookupPr, io, log: () => {} });
    runJudge({ lookupPr, io, log: () => {} });
    expect(readStore(io).records.filter((r) => r.dispatchKind === 'probation-trial')).toHaveLength(1);
  });

  it('a null lookup counts as failed', () => {
    appendScorecard(launch(), io);
    expect(runJudge({ lookupPr: () => null, io, log: () => {} })).toMatchObject({ judged: 0, pending: 0, failed: 1 });
  });

  it('a sweep racing another that already judged the launch does not double-count', () => {
    appendScorecard(launch(), io);
    const stale = readStore(io).records; // the sweep's early read
    appendScorecard(judgedTrialRow(launch(), { outcome: 'landed', reviewed: true, isCriticalMiss }), io); // the other sweep wins
    const r = judgePendingTrials(stale, { lookupPr: () => merged, isCriticalMiss, append: (row) => appendScorecardUnlessJudged(row, io) });
    expect(r).toMatchObject({ judged: [], skipped: [{ pr: 101 }] });
    expect(readStore(io).records.filter((x) => x.dispatchKind === 'probation-trial')).toHaveLength(1);
  });
});

describe('guard 3 — a truncated file list is unknown scope', () => {
  const files = (n) => Array.from({ length: n }, (_, i) => ({ path: `docs/f${i}.md` }));
  it.each([
    ['100 files listed', { files: files(100) }],
    ['changedFiles count mismatches the list', { files: files(40), changedFiles: 130 }],
  ])('%s → no filesTouched, critical miss', (_n, extra) => {
    const r = judgePendingTrials([launch()], {
      lookupPr: () => ({ state: 'CLOSED', labels: [], ...extra }), isCriticalMiss,
    }).judged[0];
    expect(r).not.toHaveProperty('filesTouched');
    expect(r.criticalMiss).toBe(true);
  });
  it('a complete list is kept', () => {
    const r = judgePendingTrials([launch()], {
      lookupPr: () => ({ state: 'MERGED', labels: ['review:accepted'], files: files(3), changedFiles: 3 }), isCriticalMiss,
    }).judged[0];
    expect(r.filesTouched).toHaveLength(3);
  });
});

describe('guard 4 — verified only with a review verdict', () => {
  it('the sweep leaves an unreviewed merge pending, then judges it once the label lands', () => {
    const prs = { state: 'MERGED', labels: [], files: [{ path: 'docs/a.md' }] };
    const run = () => judgePendingTrials([launch()], { lookupPr: () => prs, isCriticalMiss });
    expect(run()).toMatchObject({ judged: [], pending: [{ pr: 101 }] });
    prs.labels = [{ name: 'review:accepted' }];
    expect(run().judged[0]).toMatchObject({ outcome: 'landed', verifiedBy: 'independent-claude' });
  });
  it('a direct judgedTrialRow without `reviewed` is not counted as verified', () => {
    const row = judgedTrialRow(launch(), { outcome: 'landed', changedFiles: ['docs/a.md'], isCriticalMiss });
    expect(row.verifiedBy).toBe('unreviewed-merge');
    const t = graduationProgress([launch(), row], { criticalMissesFor }).triples[0];
    expect(t).toMatchObject({ judged: 1, verified: 0 });
  });
});

describe('guard 5 — no fail-open evaluator', () => {
  it('judgedTrialRow throws without one', () => {
    expect(() => judgedTrialRow(launch(), { outcome: 'rejected' })).toThrow(TypeError);
  });
  it('the sweep defaults to the real classifier: scope-less rejected and reworked are critical misses', () => {
    const at = '2026-09-28T00:00:00Z';
    const r = judgePendingTrials([launch(), launch({ handle: 'heal-102', pr: 102 })], {
      lookupPr: (l) => (l.pr === 101 ? { state: 'CLOSED', labels: [] } : { state: 'OPEN', labels: ['review:changes'], reviewLabelAt: at }),
    });
    expect(r.judged.map((x) => [x.outcome, x.criticalMiss])).toEqual([['rejected', true], ['reworked', true]]);
  });
});
