/**
 * @file we:scripts/operations/__tests__/graduation-progress-report.test.mjs
 * @description Regression proofs for graduation progress (#3690, #xd9xwtn): real trials,
 * trust boundaries, calibration resets, and a registered compute-only engine run.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { withRealRepo } from './helpers/real-repo.mjs';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning, runStatus } from '../engine.mjs';
import { isReadOnlyDeclaration } from '../http-adapter.mjs';
import { importGraph } from './import-graph.mjs';
import { OPERATIONS } from '../run.mjs';
import { createScorecardReader } from '../graduation-progress-report-io.mjs';
import {
  GRADUATION_PROGRESS_REPORT_OP, aggregateGraduationProgress,
  buildGraduationProgressReport, graduationProgressReportOperation,
} from '../graduation-progress-report.mjs';

const AS_OF = '2026-09-15T06:00:00.000Z';
const REAL_TRIALS = [
  {"scoredAt":"2026-09-15T01:00:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"bugfix","verifiedBy":"claude-subagent","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T01:30:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"conflict-resolution","verifiedBy":"claude-subagent","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T02:00:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"self-fix","verifiedBy":"claude-subagent","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T02:30:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"bugfix","verifiedBy":"claude-subagent","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T03:00:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"doc-fix","verifiedBy":"claude-subagent","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T03:40:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"bugfix","verifiedBy":"independent-claude","findings":"round 1 finding","outcome":"reworked"},
  {"scoredAt":"2026-09-15T04:20:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"bugfix","verifiedBy":"independent-claude","findings":"round 2 finding","outcome":"reworked"},
  {"scoredAt":"2026-09-15T05:00:00.000Z","provider":"codex","model":"gpt-6-astra","dispatchKind":"session-delegation","taskType":"bugfix","verifiedBy":"independent-claude","findings":null,"outcome":"landed"},
  {"scoredAt":"2026-09-15T05:30:00.000Z","provider":"antigravity","model":"gemini-3.1-pro","dispatchKind":"session-delegation","taskType":"other","verifiedBy":"other","findings":"smoke test note","outcome":"landed"}
];

function trial(minute, overrides = {}) {
  return { ...REAL_TRIALS[0], scoredAt: `2026-09-16T00:${String(minute).padStart(2, '0')}:00.000Z`, ...overrides };
}
const cleanTrials = (n) => Array.from({ length: n }, (_, i) => trial(i + 1));
const informative = () => trial(0, { findings: 'caught and subsequently fixed', verifiedBy: 'independent-claude', outcome: 'reworked' });

function runReport(store) {
  const readScorecards = createScorecardReader({ exists: () => true, read: () => JSON.stringify(store), now: () => AS_OF });
  const declaration = graduationProgressReportOperation({ readScorecards });
  const registry = createRegistry();
  registry.register(declaration);
  const run = advanceWhileRunning(startRun({ op: GRADUATION_PROGRESS_REPORT_OP, id: 'graduation-test', input: {}, registry }), { registry });
  expect(runStatus(run, { registry })).toBe('complete');
  return run;
}

describe('graduation progress registration and engine', () => {
  it('reads a real scorecard file without modifying it and handles a missing store', async () => {
    await withRealRepo(({ root }) => {
      const path = resolve(root, 'scorecards.json');
      const reader = createScorecardReader({ path });
      expect(reader().records).toEqual([]);
      const contents = JSON.stringify({ version: 1, records: REAL_TRIALS });
      writeFileSync(path, contents);
      const before = new Date().toISOString();
      const snapshot = reader();
      const after = new Date().toISOString();
      expect(snapshot.records).toEqual(REAL_TRIALS);
      expect(snapshot.asOfIso >= before && snapshot.asOfIso <= after).toBe(true);
      expect(readFileSync(path, 'utf8')).toBe(contents);
    });
  });

  it('is reachable through the CLI table with no sinks and only compute steps', () => {
    expect(Object.keys(OPERATIONS)).toContain(GRADUATION_PROGRESS_REPORT_OP);
    const { declaration, sinks } = OPERATIONS[GRADUATION_PROGRESS_REPORT_OP]();
    expect(declaration.name).toBe(GRADUATION_PROGRESS_REPORT_OP);
    expect(sinks).toEqual({});
    expect(isReadOnlyDeclaration(declaration)).toBe(true);
  });

  it('keeps IO imports out of the declaration graph', () => {
    expect(importGraph(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'graduation-progress-report.mjs')).external).toEqual([]);
  });

  it('runs the full declaration with the store reader and injected clock', () => {
    const run = runReport({ version: 1, records: REAL_TRIALS });
    expect(run.verdict).toEqual(buildGraduationProgressReport({ records: REAL_TRIALS, asOfIso: AS_OF }));
    expect(run.verdict).toMatchObject({ thresholdN: 5, asOf: AS_OF, totalTriples: 5, qualifiedCount: 0 });
  });

  it('reports an empty store cleanly', () => {
    expect(runReport({ version: 1, records: [] }).verdict).toEqual({
      thresholdN: 5, asOf: AS_OF, totalTriples: 0, qualifiedCount: 0, triples: [],
    });
  });
});

describe('graduation arithmetic', () => {
  it('matches the nine real trials, including reset evidence and recency', () => {
    const report = aggregateGraduationProgress(REAL_TRIALS);
    const expected = [
      ['antigravity', 'gemini-3.1-pro', 'other', 1, 0, 0, false, '2026-09-15T05:30:00.000Z'],
      ['codex', 'gpt-6-astra', 'bugfix', 5, 5, 1, true, '2026-09-15T05:00:00.000Z'],
      ['codex', 'gpt-6-astra', 'conflict-resolution', 1, 1, 1, false, '2026-09-15T01:30:00.000Z'],
      ['codex', 'gpt-6-astra', 'doc-fix', 1, 1, 1, false, '2026-09-15T03:00:00.000Z'],
      ['codex', 'gpt-6-astra', 'self-fix', 1, 1, 1, false, '2026-09-15T02:00:00.000Z'],
    ].map(([provider, model, taskType, trials, countedTrials, trailingCleanStreak, everInformative, lastTrialAt]) => ({
      provider, model, taskType, trials, countedTrials, trailingCleanStreak, everInformative, lastTrialAt,
      qualifies: false, verificationTier: 'full',
      resets: taskType === 'bugfix' ? [
        { scoredAt: '2026-09-15T03:40:00.000Z', findings: 'round 1 finding' },
        { scoredAt: '2026-09-15T04:20:00.000Z', findings: 'round 2 finding' },
      ] : [],
    }));
    expect(report).toEqual(expected);
    const reversed = Object.freeze([...REAL_TRIALS].reverse().map((row) => Object.freeze({ ...row })));
    expect(aggregateGraduationProgress(reversed)).toEqual(expected);
  });

  it.each([5, 6])('qualifies after a prior finding and %i counted clean trials', (n) => {
    const report = buildGraduationProgressReport({ records: [informative(), ...cleanTrials(n)], asOfIso: AS_OF });
    expect(report.qualifiedCount).toBe(1);
    expect(report.triples[0]).toMatchObject({ trailingCleanStreak: n, everInformative: true, qualifies: true, verificationTier: 'spot-check' });
  });

  it('keeps four clean trials below the uniform floor', () => {
    expect(aggregateGraduationProgress([informative(), ...cleanTrials(4)])[0]).toMatchObject({ qualifies: false, verificationTier: 'full' });
  });

  it('requires informative counted evidence even with six clean trials', () => {
    const rows = [trial(0, { verifiedBy: 'other', findings: 'smoke note' }), ...cleanTrials(6)];
    expect(aggregateGraduationProgress(rows)[0]).toMatchObject({ trailingCleanStreak: 6, everInformative: false, qualifies: false, verificationTier: 'full', resets: [] });
  });

  it('skips other verification within and after a streak without incrementing or resetting it', () => {
    const rows = [informative(), ...cleanTrials(5),
      trial(2, { verifiedBy: 'other', findings: 'smoke finding' }),
      trial(6, { verifiedBy: 'other', findings: null }),
      trial(7, { verifiedBy: 'other', findings: 'latest smoke finding' })];
    expect(aggregateGraduationProgress(rows)[0]).toMatchObject({ trials: 9, countedTrials: 6, trailingCleanStreak: 5, qualifies: true, lastTrialAt: rows.at(-1).scoredAt, resets: [{ scoredAt: informative().scoredAt, findings: informative().findings }] });
  });

  it('immediately revokes qualification on a new counted finding, even if landed', () => {
    const miss = trial(8, { findings: 'new miss', outcome: 'landed' });
    expect(aggregateGraduationProgress([informative(), ...cleanTrials(7), miss])[0]).toMatchObject({ trailingCleanStreak: 0, everInformative: true, qualifies: false, verificationTier: 'full', resets: [
      { scoredAt: informative().scoredAt, findings: informative().findings },
      { scoredAt: miss.scoredAt, findings: miss.findings },
    ] });
  });

  it('never transfers trust across any component of a triple', () => {
    const rows = [informative(), ...cleanTrials(5), trial(6, { provider: 'different' }), trial(7, { model: 'different' }), trial(8, { taskType: 'different' })];
    const triples = aggregateGraduationProgress(rows);
    expect(triples).toHaveLength(4);
    expect(triples.filter((t) => t.qualifies)).toHaveLength(1);
    expect(triples.filter((t) => !t.qualifies).every((t) => t.trials === 1 && !t.everInformative)).toBe(true);
  });

  it('excludes unrelated dispatch kinds from counts, resets, recency and triple creation', () => {
    const unrelated = ['fix', 'advisory-review', 'build'].flatMap((dispatchKind) => [
      trial(9, { dispatchKind, findings: 'unrelated finding' }),
      trial(9, { dispatchKind, provider: 'unrelated' }),
    ]);
    expect(aggregateGraduationProgress([...REAL_TRIALS, ...unrelated])).toEqual(aggregateGraduationProgress(REAL_TRIALS));
    expect(aggregateGraduationProgress(unrelated)).toEqual([]);
  });
});
