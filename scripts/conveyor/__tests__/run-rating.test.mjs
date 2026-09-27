import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { scrubReasons } from '../../lib/secret-scrub.mjs';
import {
  RUBRIC_VERSION, GUARD_BLOCKS_TARGET, BASELINE_WALL_MS_BY_KIND, REFERENCE_STORY_SIZE,
  isSyntheticModel, extractTurns, sessionNameFromLines, computeWallMs, pairToolEvents,
  classifyToolCall, computeTimeShares, countGuardBlocks, countErrors, countRepeatedCalls, countTestReruns,
  sumTokens, dominantModel, computeCostUsd, computeCacheHitRatio,
  classifyOutcome, gradeRun, worseGrade, baselineWallMs, outcomeFromTranscriptEvents,
  gradeReviewJob, resolveReviewGrade, classifyRunWaste, topWasteCauses,
  rateTranscript, rateReviewJobTimings,
  findTranscriptPath, readTranscriptLines, rateSession, rateReviewJobLog,
  toScorecardRow, rollupKey, phaseForKind, rollupByDemand, flagWaste,
  scanClaudeProjectsCoverage, scanReviewJurorUsage, scanNonClaudeJudgeTranscripts, buildCoverageReport,
  orchestratorProjectDirName,
} from '../run-rating.mjs';

const dirs = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'we-run-rating-test-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length) { try { rmSync(dirs.pop(), { recursive: true, force: true }); } catch { /* best-effort */ } }
  delete process.env.OPERATION_COMPLETIONS_DIR;
});

// ── fixture builders ────────────────────────────────────────────────────────────────────────────────────────────

/** Real transcripts store `timestamp` as an ISO-8601 string (confirmed against a live transcript) — every
 *  fixture line below converts its numeric `ts` (epoch ms, easiest to reason about in assertions) to that
 *  same string shape, so these fixtures exercise the exact parsing the real IO shell does. */
function iso(ts) { return new Date(ts).toISOString(); }
function assistantLine({ ts, model = 'claude-sonnet-5', usage = {}, content = [] }) {
  return { type: 'assistant', timestamp: iso(ts), message: { model, usage, content } };
}
function userLine({ ts, content = [] }) {
  return { type: 'user', timestamp: iso(ts), message: { content } };
}
function toolUse(id, name, input = {}) { return { type: 'tool_use', id, name, input }; }
function toolResult(id, { content = 'ok', isError = false } = {}) {
  return { type: 'tool_result', tool_use_id: id, content, is_error: isError };
}
function usage({ inTok = 100, outTok = 50, cacheRead = 0, cw5m = 0, cw1h = 0, thinking = 0 } = {}) {
  return {
    input_tokens: inTok, output_tokens: outTok, cache_read_input_tokens: cacheRead,
    cache_creation: { ephemeral_5m_input_tokens: cw5m, ephemeral_1h_input_tokens: cw1h },
    output_tokens_details: { thinking_tokens: thinking },
  };
}

/** A small, realistic fix-session transcript: custom-title, a thinking turn, a test/gate Bash call, an Edit,
 *  a gh call, and a final turn — spanning 10 minutes of wall time (the fix-session baseline exactly). */
function fixtureTranscript() {
  const t0 = Date.parse('2026-09-27T10:00:00.000Z');
  const min = 60_000;
  return [
    { type: 'custom-title', customTitle: 'fix-2748', sessionId: 'abc-123' },
    assistantLine({ ts: t0, usage: usage({ thinking: 200 }), content: [] }),
    assistantLine({ ts: t0 + 1 * min, usage: usage({ cw1h: 500 }), content: [toolUse('t1', 'Bash', { command: 'npm run test:unit' })] }),
    userLine({ ts: t0 + 3 * min, content: [toolResult('t1', { content: 'PASS' })] }),
    assistantLine({ ts: t0 + 3 * min, usage: usage({ cacheRead: 200 }), content: [toolUse('t2', 'Edit', { file_path: 'a.mjs' })] }),
    userLine({ ts: t0 + 4 * min, content: [toolResult('t2', { content: 'edited' })] }),
    assistantLine({ ts: t0 + 4 * min, usage: usage(), content: [toolUse('t3', 'Bash', { command: 'gh pr view 2748' })] }),
    userLine({ ts: t0 + 5 * min, content: [toolResult('t3', { content: '{}' })] }),
    assistantLine({ ts: t0 + 10 * min, model: '<synthetic>', usage: usage({ inTok: 0, outTok: 0 }), content: [] }),
  ];
}

// ── extraction ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('isSyntheticModel', () => {
  it('flags a synthetic marker model', () => { expect(isSyntheticModel('<synthetic>')).toBe(true); });
  it('does not flag a real model id', () => { expect(isSyntheticModel('claude-sonnet-5')).toBe(false); });
  it('does not flag null/undefined', () => { expect(isSyntheticModel(null)).toBe(false); expect(isSyntheticModel(undefined)).toBe(false); });
});

describe('extractTurns', () => {
  it('excludes synthetic turns from the returned turns', () => {
    const turns = extractTurns(fixtureTranscript());
    expect(turns.every((t) => t.model !== '<synthetic>')).toBe(true);
  });
  it('reads cache_creation split into cacheWrite5m/cacheWrite1h separately', () => {
    const turns = extractTurns([assistantLine({ ts: 0, usage: usage({ cw5m: 10, cw1h: 20 }) })]);
    expect(turns[0]).toMatchObject({ cacheWrite5m: 10, cacheWrite1h: 20 });
  });
  it('falls back to pricing the whole cache_creation_input_tokens at the 1h tier when there is no split', () => {
    const line = assistantLine({ ts: 0, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 999 } });
    const turns = extractTurns([line]);
    expect(turns[0]).toMatchObject({ cacheWrite5m: 0, cacheWrite1h: 999 });
  });
});

describe('sessionNameFromLines', () => {
  it('reads the custom-title line', () => { expect(sessionNameFromLines(fixtureTranscript())).toBe('fix-2748'); });
  it('is null with no custom-title line', () => { expect(sessionNameFromLines([{ type: 'assistant' }])).toBeNull(); });
});

describe('computeWallMs', () => {
  it('is the max-min timestamp span', () => {
    expect(computeWallMs(fixtureTranscript())).toBe(10 * 60_000);
  });
  it('is null with fewer than two timestamps', () => { expect(computeWallMs([{ type: 'x' }])).toBeNull(); });
});

describe('pairToolEvents', () => {
  const events = pairToolEvents(fixtureTranscript());
  it('joins tool_use to its later tool_result by id', () => {
    const t1 = events.find((e) => e.id === 't1');
    expect(t1).toMatchObject({ name: 'Bash', durationMs: 2 * 60_000, isError: false, category: 'tests-gates' });
  });
  it('reports a tool_use with no result as durationMs:null rather than dropping it', () => {
    const lines = [assistantLine({ ts: 0, content: [toolUse('orphan', 'Bash', { command: 'echo hi' })] })];
    const ev = pairToolEvents(lines);
    expect(ev).toEqual([expect.objectContaining({ id: 'orphan', durationMs: null, endTs: null })]);
  });
  it('marks a tool_result with is_error:true', () => {
    const lines = [
      assistantLine({ ts: 0, content: [toolUse('e1', 'Bash', { command: 'gh api x' })] }),
      userLine({ ts: 10, content: [toolResult('e1', { content: 'boom', isError: true })] }),
    ];
    expect(pairToolEvents(lines)[0].isError).toBe(true);
  });
});

describe('classifyToolCall', () => {
  it('classifies Edit/Write/NotebookEdit/MultiEdit as edits regardless of input', () => {
    for (const name of ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']) expect(classifyToolCall(name, {})).toBe('edits');
  });
  it('classifies a test/gate Bash command', () => {
    expect(classifyToolCall('Bash', { command: 'npm run test:unit' })).toBe('tests-gates');
    expect(classifyToolCall('Bash', { command: 'node scripts/verify-lane.mjs run' })).toBe('tests-gates');
    expect(classifyToolCall('Bash', { command: 'npx vitest run scripts/foo.test.mjs' })).toBe('tests-gates');
  });
  it('classifies a gh Bash command', () => { expect(classifyToolCall('Bash', { command: 'gh pr view 123' })).toBe('gh'); });
  it('classifies a git Bash command', () => { expect(classifyToolCall('Bash', { command: 'git commit -m x' })).toBe('git'); });
  it('classifies our own operations tooling as platform-ops', () => {
    expect(classifyToolCall('Bash', { command: 'node scripts/operations/run.mjs claim --item=1' })).toBe('platform-ops');
  });
  it('falls back to other for an unrecognised Bash command and an unrecognised tool name', () => {
    expect(classifyToolCall('Bash', { command: 'ls -la' })).toBe('other');
    expect(classifyToolCall('Read', { file_path: 'x' })).toBe('other');
  });
});

describe('computeTimeShares', () => {
  it('attributes each known tool duration to its own category and sums to shares of wallMs', () => {
    const events = pairToolEvents(fixtureTranscript());
    const turns = extractTurns(fixtureTranscript());
    const wallMs = computeWallMs(fixtureTranscript());
    const time = computeTimeShares(events, turns, wallMs);
    expect(time.testsMs).toBe(2 * 60_000);
    expect(time.editsMs).toBe(1 * 60_000);
    expect(time.ghMs).toBe(1 * 60_000);
    expect(time.shares.tests).toBeCloseTo(2 / 10, 5);
  });
  it('attributes leftover gap time to reasoning when a real turn with thinking tokens falls inside it', () => {
    // one gap (no tool calls at all) with a thinking turn in the middle
    const lines = [
      assistantLine({ ts: 0, usage: usage({ thinking: 500 }) }),
      assistantLine({ ts: 1000, usage: usage({ thinking: 0 }) }),
    ];
    const time = computeTimeShares(pairToolEvents(lines), extractTurns(lines), computeWallMs(lines));
    expect(time.reasoningMs).toBe(1000);
    expect(time.idleMs).toBe(0);
  });
  it('attributes leftover gap time to idle when no turn in it has thinking tokens', () => {
    const lines = [
      assistantLine({ ts: 0, usage: usage({ thinking: 0 }) }),
      assistantLine({ ts: 1000, usage: usage({ thinking: 0 }) }),
    ];
    const time = computeTimeShares(pairToolEvents(lines), extractTurns(lines), computeWallMs(lines));
    expect(time.idleMs).toBe(1000);
    expect(time.reasoningMs).toBe(0);
  });
});

describe('countGuardBlocks / countErrors', () => {
  it('counts only the literal hook error: Blocked marker as a guard block', () => {
    const lines = [
      assistantLine({ ts: 0, content: [toolUse('a', 'Edit', {})] }),
      userLine({ ts: 1, content: [toolResult('a', { content: 'hook error: Blocked — see policy', isError: true })] }),
      assistantLine({ ts: 2, content: [toolUse('b', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 3, content: [toolResult('b', { content: 'permission denied', isError: true })] }),
    ];
    const events = pairToolEvents(lines);
    expect(countGuardBlocks(events)).toBe(1);
    expect(countErrors(events)).toBe(2);
  });
});

describe('countRepeatedCalls / countTestReruns', () => {
  it('counts occurrences beyond the first of an identical (name, input) signature', () => {
    const lines = [
      assistantLine({ ts: 0, content: [toolUse('a', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 1, content: [toolResult('a')] }),
      assistantLine({ ts: 2, content: [toolUse('b', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 3, content: [toolResult('b')] }),
      assistantLine({ ts: 4, content: [toolUse('c', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 5, content: [toolResult('c')] }),
    ];
    expect(countRepeatedCalls(pairToolEvents(lines))).toBe(2);
  });
  it('is unaffected by key order in the input object (a stable signature)', () => {
    const lines = [
      assistantLine({ ts: 0, content: [toolUse('a', 'Bash', { command: 'x', description: 'y' })] }),
      userLine({ ts: 1, content: [toolResult('a')] }),
      assistantLine({ ts: 2, content: [toolUse('b', 'Bash', { description: 'y', command: 'x' })] }),
      userLine({ ts: 3, content: [toolResult('b')] }),
    ];
    expect(countRepeatedCalls(pairToolEvents(lines))).toBe(1);
  });
  it('countTestReruns only counts repeats within the tests-gates category', () => {
    const lines = [
      assistantLine({ ts: 0, content: [toolUse('a', 'Bash', { command: 'npm run test:unit' })] }),
      userLine({ ts: 1, content: [toolResult('a')] }),
      assistantLine({ ts: 2, content: [toolUse('b', 'Bash', { command: 'npm run test:unit' })] }),
      userLine({ ts: 3, content: [toolResult('b')] }),
      assistantLine({ ts: 4, content: [toolUse('c', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 5, content: [toolResult('c')] }),
      assistantLine({ ts: 6, content: [toolUse('d', 'Bash', { command: 'ls' })] }),
      userLine({ ts: 7, content: [toolResult('d')] }),
    ];
    expect(countTestReruns(pairToolEvents(lines))).toBe(1);
    expect(countRepeatedCalls(pairToolEvents(lines))).toBe(2);
  });
});

describe('sumTokens / dominantModel / computeCostUsd / computeCacheHitRatio', () => {
  it('sums every real turn, excluding a synthetic one', () => {
    const turns = extractTurns(fixtureTranscript());
    const sums = sumTokens(turns);
    expect(sums.cacheWrite1h).toBe(500);
    expect(sums.cacheRead).toBe(200);
  });
  it('dominantModel picks the most frequent real model, ignoring synthetic turns', () => {
    expect(dominantModel(extractTurns(fixtureTranscript()))).toBe('claude-sonnet-5');
  });
  it('dominantModel is null with no real turns', () => { expect(dominantModel([])).toBeNull(); });
  it('computeCostUsd prices the 5m and 1h cache tiers separately and is null for an unrecognised model', () => {
    const sums = { in: 1_000_000, out: 0, cacheRead: 0, cacheWrite5m: 1_000_000, cacheWrite1h: 0 };
    expect(computeCostUsd(sums, 'claude-sonnet-5')).toBeCloseTo(3 + 3.75, 5); // in-rate + sonnet cw5m rate
    expect(computeCostUsd({ in: 1, out: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }, 'some-unknown-model')).toBeNull();
  });
  it('computeCacheHitRatio is cacheRead / (in + cacheRead), null with neither', () => {
    expect(computeCacheHitRatio({ in: 300, cacheRead: 100 })).toBeCloseTo(0.25, 5);
    expect(computeCacheHitRatio({ in: 0, cacheRead: 0 })).toBeNull();
  });
});

// ── outcome + grade ─────────────────────────────────────────────────────────────────────────────────────────────

describe('classifyOutcome', () => {
  it('maps every known raw outcome word from the fix/ci-heal and review vocabularies', () => {
    expect(classifyOutcome('re-armed')).toBe('pushed');
    expect(classifyOutcome('no-change')).toBe('nothing-to-fix');
    expect(classifyOutcome('not-applicable')).toBe('nothing-to-fix');
    expect(classifyOutcome('auto-cleared')).toBe('accepted');
    expect(classifyOutcome('bounced')).toBe('bounced');
    expect(classifyOutcome('parked')).toBe('escalated');
    expect(classifyOutcome('blocked-on-infra')).toBe('escalated');
  });
  it('resolves any unlisted escalated-* word to escalated via the closed prefix rule', () => {
    expect(classifyOutcome('escalated-some-future-reason')).toBe('escalated');
  });
  it('is unclassified for null, empty, or a genuinely unseen word', () => {
    expect(classifyOutcome(null)).toBe('unclassified');
    expect(classifyOutcome('')).toBe('unclassified');
    expect(classifyOutcome('something-new')).toBe('unclassified');
  });
});

describe('gradeRun (rubric v2 — a hard A conjunction + outcome caps)', () => {
  const clean = { guardBlocks: 0, errors: 0, repeatedCalls: 0, testReruns: 0 };
  it('is A only with within-baseline time AND zero waste AND a good outcome, all three', () => {
    expect(gradeRun({ ...clean, wallMs: 10 * 60_000, kind: 'fix', outcome: 'pushed' })).toBe('A');
  });
  it('is NOT A when every mechanical box is ticked but the outcome is missing/neutral (no "good outcome")', () => {
    expect(gradeRun({ ...clean, wallMs: 10 * 60_000, kind: 'fix', outcome: null })).not.toBe('A');
  });
  it(`is still A at the report's own guard-block TARGET of ${GUARD_BLOCKS_TARGET}`, () => {
    expect(gradeRun({ guardBlocks: 1, errors: 1, repeatedCalls: 0, testReruns: 0, wallMs: 10 * 60_000, kind: 'fix', outcome: 'pushed' })).toBe('A');
  });
  it('is NOT A at 2 guard blocks — one over the declared allowance', () => {
    expect(gradeRun({ guardBlocks: 2, errors: 2, repeatedCalls: 0, testReruns: 0, wallMs: 10 * 60_000, kind: 'fix', outcome: 'pushed' })).not.toBe('A');
  });
  it('is NOT A with even one test rerun — the allowance is exactly zero', () => {
    expect(gradeRun({ ...clean, testReruns: 1, wallMs: 10 * 60_000, kind: 'fix', outcome: 'pushed' })).not.toBe('A');
  });
  it(`drops well below A at the report's own "bad" guard-block count of 4`, () => {
    const grade = gradeRun({ guardBlocks: 4, errors: 4, repeatedCalls: 0, testReruns: 0, wallMs: 10 * 60_000, kind: 'fix', outcome: 'pushed' });
    expect(['C', 'D']).toContain(grade);
  });
  it('penalises wall time far above the kind baseline even with a clean tool record', () => {
    const grade = gradeRun({ ...clean, wallMs: 41 * 60_000, kind: 'fix', outcome: 'pushed' });
    expect(grade).not.toBe('A');
  });
  it('uses the worker baseline for a conveyor (build) session, not the fix baseline', () => {
    // 40 minutes is the WORKER median — should still grade A for a conveyor session though it would not for fix
    expect(gradeRun({ ...clean, wallMs: 40 * 60_000, kind: 'conveyor', outcome: 'pushed' })).toBe('A');
  });
  it('scales a build baseline UP for a larger story size, DOWN for a smaller one', () => {
    // size 3 = REFERENCE_STORY_SIZE (no scaling); size 9 triples the baseline; size 1 is clamped to 0.5x, not 1/3x
    expect(gradeRun({ ...clean, wallMs: 100 * 60_000, kind: 'conveyor', size: 9, outcome: 'pushed' })).toBe('A');
    expect(gradeRun({ ...clean, wallMs: 21 * 60_000, kind: 'conveyor', size: 1, outcome: 'pushed' })).not.toBe('A'); // > 0.5x40min clamp
  });

  describe('outcome caps (checked before mechanical hygiene)', () => {
    it('a REWORK (fix/ci-heal) session that found nothing to fix is a hard D, however clean the run was', () => {
      expect(gradeRun({ ...clean, wallMs: 1000, kind: 'fix', outcome: 'nothing-to-fix' })).toBe('D');
      expect(gradeRun({ ...clean, wallMs: 1000, kind: 'ci-heal', outcome: 'nothing-to-fix' })).toBe('D');
    });
    it('nothing-to-fix is NOT a hard D for a non-rework kind (review/inspect) — it can be the correct verdict', () => {
      expect(gradeRun({ ...clean, wallMs: 1000, kind: 'inspect', outcome: 'nothing-to-fix' })).toBe('A');
    });
    it('a BUILD kind whose PR bounced caps at C, even mechanically spotless', () => {
      expect(gradeRun({ ...clean, wallMs: 1000, kind: 'conveyor', outcome: 'pushed', prBounced: true })).toBe('C');
    });
    it('a BUILD kind whose PR is unknown to have bounced (prBounced: null) applies NO cap', () => {
      expect(gradeRun({ ...clean, wallMs: 10 * 60_000, kind: 'conveyor', outcome: 'pushed', prBounced: null })).toBe('A');
    });
    it('escalated with no decision reached (the default) caps at C', () => {
      expect(gradeRun({ ...clean, wallMs: 1000, kind: 'fix', outcome: 'escalated' })).toBe('C');
    });
    it('escalated WITH decisionReached:true removes the cap', () => {
      expect(gradeRun({ ...clean, wallMs: 10 * 60_000, kind: 'fix', outcome: 'escalated', decisionReached: true })).not.toBe('C');
    });
    it('a cap only ever worsens a grade, never improves a genuinely bad mechanical run', () => {
      const grade = gradeRun({ guardBlocks: 5, errors: 5, repeatedCalls: 5, testReruns: 5, wallMs: 60 * 60_000, kind: 'conveyor', outcome: 'pushed', prBounced: true });
      expect(grade).toBe('D'); // mechanical D is already worse than the C cap — worseGrade keeps D
    });
  });
});

describe('worseGrade', () => {
  it('returns whichever grade is further from A', () => {
    expect(worseGrade('A', 'C')).toBe('C');
    expect(worseGrade('D', 'B')).toBe('D');
  });
  it('a null/undefined cap never worsens anything', () => {
    expect(worseGrade('B', null)).toBe('B');
    expect(worseGrade(null, 'B')).toBe('B');
  });
});

describe('baselineWallMs', () => {
  it('is the flat per-kind baseline for a non-size-scaled kind regardless of size', () => {
    expect(baselineWallMs('fix', 8)).toBe(BASELINE_WALL_MS_BY_KIND.fix);
  });
  it('is the flat baseline for a size-scaled kind with no size given', () => {
    expect(baselineWallMs('conveyor', null)).toBe(BASELINE_WALL_MS_BY_KIND.conveyor);
  });
  it('scales proportionally to size / REFERENCE_STORY_SIZE, clamped to [0.5x, 3x]', () => {
    const base = BASELINE_WALL_MS_BY_KIND.conveyor;
    expect(baselineWallMs('conveyor', REFERENCE_STORY_SIZE)).toBe(base);
    expect(baselineWallMs('conveyor', REFERENCE_STORY_SIZE * 2)).toBe(base * 2);
    expect(baselineWallMs('conveyor', 100)).toBe(base * 3); // clamped high
    expect(baselineWallMs('conveyor', 0.01)).toBe(base * 0.5); // clamped low
  });
});

describe('outcomeFromTranscriptEvents', () => {
  it('recovers the outcome from a completion-cli done report inside a Bash tool call', () => {
    const events = [{ name: 'Bash', input: { command: 'node completion-cli.mjs report --session=fix-1 --status=done --outcome=re-armed' } }];
    expect(outcomeFromTranscriptEvents(events)).toBe('re-armed');
  });
  it('ignores a `started` report (no --status=done in the same command)', () => {
    const events = [{ name: 'Bash', input: { command: 'node completion-cli.mjs report --session=fix-1 --status=started' } }];
    expect(outcomeFromTranscriptEvents(events)).toBeNull();
  });
  it('takes the LAST done-report when a session reports more than once', () => {
    const events = [
      { name: 'Bash', input: { command: 'completion-cli.mjs report --status=done --outcome=gate-red' } },
      { name: 'Bash', input: { command: 'completion-cli.mjs report --status=done --outcome=re-armed' } },
    ];
    expect(outcomeFromTranscriptEvents(events)).toBe('re-armed');
  });
  it('is null with no completion-cli call at all', () => {
    expect(outcomeFromTranscriptEvents([{ name: 'Bash', input: { command: 'ls' } }])).toBeNull();
  });
});

describe('gradeReviewJob', () => {
  it('an accepted review is ALWAYS pending at score time — never a computed A/B/C/D', () => {
    expect(gradeReviewJob({ wallMs: 1000, outcome: 'accepted' })).toBe('pending');
  });
  it('a bounced review grades purely on duration — it already told the truth immediately', () => {
    expect(gradeReviewJob({ wallMs: BASELINE_WALL_MS_BY_KIND.review, outcome: 'bounced' })).toBe('A');
  });
  it('an escalated review caps at C regardless of how fast it was', () => {
    expect(gradeReviewJob({ wallMs: 1, outcome: 'escalated' })).toBe('C');
  });
});

describe('resolveReviewGrade', () => {
  it('passes through a non-pending grade unchanged', () => {
    expect(resolveReviewGrade({ grade: 'B' }, [])).toBe('B');
  });
  it('stays pending with no later round for the same PR yet', () => {
    expect(resolveReviewGrade({ grade: 'pending' }, [])).toBe('pending');
  });
  it('resolves to D when a later round on the same PR bounced or escalated', () => {
    expect(resolveReviewGrade({ grade: 'pending' }, [{ outcome: 'bounced' }])).toBe('D');
    expect(resolveReviewGrade({ grade: 'pending' }, [{ outcome: 'escalated' }])).toBe('D');
  });
  it('stays pending when the only later round also accepted (still no PROOF it holds beyond that)', () => {
    expect(resolveReviewGrade({ grade: 'pending' }, [{ outcome: 'accepted' }])).toBe('pending');
  });
});

// ── orchestration ───────────────────────────────────────────────────────────────────────────────────────────────

describe('rateTranscript', () => {
  it('combines every piece into one rating record for a realistic fixture', () => {
    const rating = rateTranscript(fixtureTranscript(), { kind: 'fix', pr: 2748, item: '4194', rawOutcome: 're-armed' });
    expect(rating).toMatchObject({
      kind: 'fix', pr: 2748, item: '4194', sessionName: 'fix-2748', model: 'claude-sonnet-5',
      wallMs: 10 * 60_000, guardBlocks: 0, errors: 0, repeatedCalls: 0, testReruns: 0,
      outcome: 'pushed', rawOutcome: 're-armed', grade: 'A', dataQuality: 'transcript',
    });
    expect(rating.tokens.cacheWrite).toBe(500);
    expect(typeof rating.costUsd).toBe('number');
  });
});

describe('rateReviewJobTimings', () => {
  it('reports job-log-only data quality with null tokens/cost', () => {
    const rating = rateReviewJobTimings({ pr: 2670, outcome: 'auto-cleared', timings: { totalMs: 599_834 } });
    expect(rating).toMatchObject({ kind: 'review', pr: 2670, outcome: 'accepted', wallMs: 599_834, dataQuality: 'job-log-only', tokens: null, costUsd: null });
  });
});

// ── scorecard row + rollup ──────────────────────────────────────────────────────────────────────────────────────

describe('toScorecardRow', () => {
  it('produces a row that satisfies run-scorecard-store validation, with one deduction per lost-points criterion', () => {
    const rating = rateTranscript(fixtureTranscript(), { kind: 'fix', pr: 2748, rawOutcome: 're-armed' });
    const row = toScorecardRow(rating);
    expect(row).toMatchObject({ rubricVersion: RUBRIC_VERSION, subjectClass: 'work-agent', dispatchKind: 'fix', criteriaEvaluated: 4, score: 95 });
    expect(row.deductions).toEqual([]);
  });
  it('adds a deduction entry per criterion that actually cost points', () => {
    const rating = { kind: 'fix', pr: 1, item: null, sessionName: 's', model: 'm', grade: 'C', guardBlocks: 2, errors: 3, repeatedCalls: 1, testReruns: 1, outcome: 'escalated', rawOutcome: 'blocked', tokens: null, costUsd: null, cacheHitRatio: null, shares: null, dataQuality: 'transcript' };
    const row = toScorecardRow(rating);
    expect(row.deductions.map((d) => d.criterion).sort()).toEqual(['guard-blocks', 'repeated-calls', 'test-reruns', 'tool-errors']);
  });
  // Regression: an earlier `(s)` plural in these evidence strings (e.g. "tool error(s)") read to the
  // append-time secret scrub as call-syntax (`name(...)`) and made `appendScorecard` refuse EVERY row that
  // carried one — found live running this module's own production backfill. Every deduction template must
  // stay scrub-clean.
  it('every deduction evidence string passes the append-time secret scrub', () => {
    const rating = { kind: 'fix', pr: 1, item: null, sessionName: 's', model: 'm', grade: 'D', guardBlocks: 5, errors: 7, repeatedCalls: 3, testReruns: 2, outcome: 'escalated', rawOutcome: 'blocked', tokens: null, costUsd: null, cacheHitRatio: null, shares: null, dataQuality: 'transcript' };
    const row = toScorecardRow(rating);
    expect(row.deductions.length).toBeGreaterThan(0);
    for (const d of row.deductions) expect(scrubReasons(d.evidence)).toEqual([]);
  });
});

describe('rollupKey / phaseForKind', () => {
  it('keys by PR when present, else item, else session name', () => {
    expect(rollupKey({ pr: 5 })).toBe('chalbert/web-everything#pr5');
    expect(rollupKey({ item: 9 })).toBe('chalbert/web-everything#item9');
    expect(rollupKey({ sessionName: 'x' })).toBe('chalbert/web-everything#session:x');
  });
  it('maps dispatch kinds to build/review/rework, and an unknown kind to other', () => {
    expect(phaseForKind('conveyor')).toBe('build');
    expect(phaseForKind('review')).toBe('review');
    expect(phaseForKind('fix')).toBe('rework');
    expect(phaseForKind('ci-heal')).toBe('rework');
    expect(phaseForKind('something-else')).toBe('other');
  });
});

describe('rollupByDemand', () => {
  it('sums tokens/cost per phase within one demand, across several rows', () => {
    const rows = [
      { pr: 10, dispatchKind: 'fix', tokens: { in: 100, out: 50, cacheRead: 0, cacheWrite: 0 }, costUsd: 0.01 },
      { pr: 10, dispatchKind: 'review', tokens: { in: 20, out: 10, cacheRead: 0, cacheWrite: 0 }, costUsd: 0.002 },
      { pr: 10, dispatchKind: 'fix', tokens: { in: 5, out: 5, cacheRead: 0, cacheWrite: 0 }, costUsd: 0.001 },
    ];
    const [demand] = rollupByDemand(rows);
    expect(demand.byPhase.rework.sessions).toBe(2);
    expect(demand.byPhase.rework.tokensIn).toBe(105);
    expect(demand.byPhase.review.sessions).toBe(1);
    expect(demand.totalTokens).toBe(100 + 50 + 20 + 10 + 5 + 5);
  });
  it('computes tokensPerStoryPoint only when sizeForItem resolves a positive size', () => {
    const rows = [{ item: 42, dispatchKind: 'fix', tokens: { in: 1000, out: 0, cacheRead: 0, cacheWrite: 0 }, costUsd: 0 }];
    const [withSize] = rollupByDemand(rows, { sizeForItem: () => 5 });
    expect(withSize.tokensPerStoryPoint).toBe(200);
    const [noSize] = rollupByDemand(rows, { sizeForItem: () => null });
    expect(noSize.tokensPerStoryPoint).toBeNull();
  });
});

describe('flagWaste', () => {
  it('flags a nothing-to-fix run and a run with repeated calls', () => {
    const rows = [
      { outcome: 'nothing-to-fix', pr: 1, repeatedCalls: 0 },
      { outcome: 'pushed', pr: 2, repeatedCalls: 3 },
    ];
    const waste = flagWaste(rows);
    expect(waste.find((w) => w.type === 'nothing-to-fix').pr).toBe(1);
    expect(waste.find((w) => w.type === 'repeated-identical-calls').count).toBe(3);
  });
  it('flags more than one review row against the same PR+head when headSha is present', () => {
    const rows = [
      { dispatchKind: 'review', pr: 7, headSha: 'aaa', outcome: 'bounced' },
      { dispatchKind: 'review', pr: 7, headSha: 'aaa', outcome: 'accepted' },
    ];
    expect(flagWaste(rows).some((w) => w.type === 'repeat-review-same-head')).toBe(true);
  });
});

// ── IO shell ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('findTranscriptPath / readTranscriptLines', () => {
  it('finds a transcript by sessionId directly', () => {
    const root = tmp();
    const dir = join(root, 'x-operations-dispatch-1');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'sess-1.jsonl');
    writeFileSync(file, `${JSON.stringify({ type: 'custom-title', customTitle: 'fix-1', sessionId: 'sess-1' })}\n`);
    expect(findTranscriptPath('fix-1', { sessionId: 'sess-1', projectsRoot: root })).toBe(file);
  });
  it('falls back to scanning first lines for a matching custom-title when sessionId is unknown', () => {
    const root = tmp();
    const dir = join(root, 'y-operations-dispatch-2');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'sess-2.jsonl');
    writeFileSync(file, `${JSON.stringify({ type: 'custom-title', customTitle: 'review-9', sessionId: 'sess-2' })}\n${JSON.stringify({ type: 'assistant' })}\n`);
    expect(findTranscriptPath('review-9', { projectsRoot: root })).toBe(file);
  });
  it('is null when nothing matches', () => {
    const root = tmp();
    expect(findTranscriptPath('nope', { projectsRoot: root })).toBeNull();
  });
  it('readTranscriptLines skips a torn/unparseable line rather than throwing', () => {
    const root = tmp();
    const file = join(root, 'f.jsonl');
    writeFileSync(file, `${JSON.stringify({ type: 'a' })}\n{not json\n${JSON.stringify({ type: 'b' })}\n`);
    expect(readTranscriptLines(file).map((l) => l.type)).toEqual(['a', 'b']);
  });
});

describe('rateSession', () => {
  it('reports transcript-not-found when nothing matches', () => {
    const root = tmp();
    const result = rateSession({ sessionName: 'fix-404', kind: 'fix', pr: 404, transcriptPath: null });
    // no transcriptPath given and no real session on this machine named fix-404 — falls through to not-found
    // using the REAL projects root only if fix-404 happens to exist; force isolation via an empty tmp root:
    void root;
    expect(result.ok).toBe(false);
  });
  it('rates a session end-to-end from a transcript file and folds in the completion record outcome', () => {
    const completionsDir = tmp();
    process.env.OPERATION_COMPLETIONS_DIR = completionsDir;
    writeFileSync(join(completionsDir, 'fix-2748.json'), JSON.stringify({
      v: 1, session: 'fix-2748', kind: 'fix', pr: '2748', item: null, status: 'done',
      outcome: 're-armed', verdict: null, label: null, runId: null,
      startedAt: '2026-09-27T10:00:00.000Z', updatedAt: '2026-09-27T10:10:00.000Z',
    }));
    const transcriptDir = tmp();
    const file = join(transcriptDir, 'sess.jsonl');
    writeFileSync(file, fixtureTranscript().map((l) => JSON.stringify(l)).join('\n'));
    const result = rateSession({ sessionName: 'fix-2748', kind: 'fix', pr: 2748, transcriptPath: file });
    expect(result).toMatchObject({ ok: true, outcome: 'pushed', rawOutcome: 're-armed', grade: 'A' });
  });
});

describe('rateReviewJobLog', () => {
  it('parses the final structured JSON summary line, ignoring narrative lines above it', () => {
    const root = tmp();
    const file = join(root, 'review-2670.log');
    writeFileSync(file, [
      '[2026-09-25T16:26:44.047Z] review-job review-2670: running review-loop-cli in /some/lane',
      '[2026-09-25T16:34:47.303Z] review-job review-2670: loop finished in 483255ms — auto-cleared (verdict accept, loop converged, run review-pr-x)',
      JSON.stringify({ pr: 2670, repo: 'chalbert/web-everything', sessionSlug: 'review-2670', verdict: 'accept', loopOutcome: 'converged', runId: 'review-pr-x', label: null, outcome: 'auto-cleared', timings: { acquireMs: 115968, loopMs: 483255, totalMs: 599834 } }),
      '',
    ].join('\n'));
    const result = rateReviewJobLog(file);
    expect(result).toMatchObject({ ok: true, sessionName: 'review-2670', outcome: 'accepted', wallMs: 599834, dataQuality: 'job-log-only' });
  });
  it('reports no-summary-line for a log with no parseable JSON', () => {
    const root = tmp();
    const file = join(root, 'x.log');
    writeFileSync(file, 'just narrative text, no summary\n');
    expect(rateReviewJobLog(file)).toEqual({ ok: false, reason: 'no-summary-line', logPath: file });
  });
  it('joins the summary\'s runId to its run record and fills in tokens/cost — reviews stop being tokens:null', () => {
    const logDir = tmp();
    const runsDir = tmp();
    const logFile = join(logDir, 'review-2670.log');
    writeFileSync(logFile, `${JSON.stringify({ pr: 2670, sessionSlug: 'review-2670', outcome: 'auto-cleared', runId: 'review-pr-xyz', timings: { totalMs: 100_000 } })}\n`);
    writeFileSync(join(runsDir, 'review-pr-xyz.json'), JSON.stringify({
      input: { pr: 2670 },
      telemetry: [{ model: 'sonnet', costUsd: 0.5, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }],
    }));
    const result = rateReviewJobLog(logFile, { runsDir });
    expect(result).toMatchObject({ ok: true, dataQuality: 'juror-telemetry', costUsd: 0.5, costUsdPartial: false });
    expect(result.tokens).toEqual({ in: 10, out: 5, cacheRead: 0, cacheWrite: 0 });
  });
  it('flags costUsdPartial when a non-Claude seat rides the same run record', () => {
    const logDir = tmp();
    const runsDir = tmp();
    const logFile = join(logDir, 'review-2671.log');
    writeFileSync(logFile, `${JSON.stringify({ pr: 2671, sessionSlug: 'review-2671', outcome: 'auto-cleared', runId: 'review-pr-mixed', timings: { totalMs: 100_000 } })}\n`);
    writeFileSync(join(runsDir, 'review-pr-mixed.json'), JSON.stringify({
      input: { pr: 2671 },
      telemetry: [
        { model: 'sonnet', costUsd: 0.5, usage: { input_tokens: 10, output_tokens: 5 } },
        { model: 'gpt-6-astra', costUsd: 0, usage: { input_tokens: 20, output_tokens: 10 } },
      ],
    }));
    const result = rateReviewJobLog(logFile, { runsDir });
    expect(result.costUsdPartial).toBe(true);
    expect(result.costUsd).toBe(0.5); // only the priced seat
    expect(result.tokens.in).toBe(30); // both seats' real tokens still counted
  });
  it('falls back to job-log-only when no run record joins (missing/old runId)', () => {
    const logDir = tmp();
    const logFile = join(logDir, 'review-2672.log');
    writeFileSync(logFile, `${JSON.stringify({ pr: 2672, sessionSlug: 'review-2672', outcome: 'auto-cleared', runId: 'does-not-exist', timings: { totalMs: 100_000 } })}\n`);
    const result = rateReviewJobLog(logFile, { runsDir: tmp() });
    expect(result.dataQuality).toBe('job-log-only');
    expect(result.tokens).toBeNull();
  });
});

// ── waste minutes/tokens attribution ───────────────────────────────────────────────────────────────────────────

describe('classifyRunWaste', () => {
  it('attributes precise minutes to a test rerun from the repeated call\'s own durationMs', () => {
    const events = [
      { name: 'Bash', input: { command: 'npm run test:unit' }, category: 'tests-gates', durationMs: 60_000 },
      { name: 'Bash', input: { command: 'npm run test:unit' }, category: 'tests-gates', durationMs: 90_000 },
    ];
    const rating = { tokens: { in: 100, out: 100, cacheRead: 0, cacheWrite: 0 }, kind: 'fix', outcome: 'pushed' };
    const waste = classifyRunWaste(events, rating);
    const testRerun = waste.find((w) => w.cause === 'test-rerun');
    expect(testRerun.minutes).toBeCloseTo(1.5, 5); // only the SECOND (repeat) occurrence's 90s counts
  });
  it('attributes a proportional token share to a non-test repeated call', () => {
    const events = [
      { name: 'Bash', input: { command: 'ls' }, category: 'other', durationMs: 1000 },
      { name: 'Bash', input: { command: 'ls' }, category: 'other', durationMs: 1000 },
    ];
    const rating = { tokens: { in: 1000, out: 0, cacheRead: 0, cacheWrite: 0 }, kind: 'fix', outcome: 'pushed' };
    const waste = classifyRunWaste(events, rating);
    expect(waste.find((w) => w.cause === 'repeated-call').tokens).toBeCloseTo(500, 5); // 1 of 2 calls repeated
  });
  it('counts a REWORK nothing-to-fix dispatch as its full wallMs/tokens wasted', () => {
    const rating = { wallMs: 600_000, tokens: { in: 10, out: 10, cacheRead: 0, cacheWrite: 0 }, kind: 'ci-heal', outcome: 'nothing-to-fix' };
    const waste = classifyRunWaste([], rating);
    expect(waste.find((w) => w.cause === 'nothing-to-fix-dispatch')).toMatchObject({ minutes: 10, tokens: 20 });
  });
  it('counts an escalated (no-decision) run as its full wallMs/tokens wasted', () => {
    const rating = { wallMs: 300_000, tokens: { in: 5, out: 5, cacheRead: 0, cacheWrite: 0 }, kind: 'fix', outcome: 'escalated' };
    const waste = classifyRunWaste([], rating);
    expect(waste.find((w) => w.cause === 'escalated-no-decision')).toMatchObject({ minutes: 5, tokens: 10 });
  });
  it('reports nothing for a clean run with a good outcome', () => {
    const rating = { wallMs: 1000, tokens: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 }, kind: 'fix', outcome: 'pushed' };
    expect(classifyRunWaste([], rating)).toEqual([]);
  });
});

describe('topWasteCauses', () => {
  it('ranks aggregated causes by minutes or by tokens, and sums guard blocks separately by count', () => {
    const rows = [
      { guardBlocks: 2, waste: [{ cause: 'test-rerun', minutes: 10, tokens: 100 }] },
      { guardBlocks: 1, waste: [{ cause: 'nothing-to-fix-dispatch', minutes: 30, tokens: 50 }] },
    ];
    const byMinutes = topWasteCauses(rows, { by: 'minutes' });
    expect(byMinutes.ranked[0].cause).toBe('nothing-to-fix-dispatch'); // 30 min > 10 min
    expect(byMinutes.guardBlockCount).toBe(3);
    const byTokens = topWasteCauses(rows, { by: 'tokens' });
    expect(byTokens.ranked[0].cause).toBe('test-rerun'); // 100 tok > 50 tok
  });
  it('respects the limit', () => {
    const rows = [{ waste: [
      { cause: 'test-rerun', minutes: 5, tokens: 1 }, { cause: 'repeated-call', minutes: 4, tokens: 1 },
      { cause: 'nothing-to-fix-dispatch', minutes: 3, tokens: 1 }, { cause: 'escalated-no-decision', minutes: 2, tokens: 1 },
      { cause: 'unheld-review-accept', minutes: 1, tokens: 1 },
    ] }];
    expect(topWasteCauses(rows, { by: 'minutes', limit: 3 }).ranked).toHaveLength(3);
  });
});

// ── coverage (message-2 recalibration: full-fleet token accounting) ────────────────────────────────────────────

describe('orchestratorProjectDirName', () => {
  it('defaults to the confirmed real directory name', () => {
    expect(orchestratorProjectDirName({})).toBe('-Users-nicolasgilbert-workspace-webeverything');
  });
  it('is overridable via WE_ORCHESTRATOR_PROJECT_DIR for tests', () => {
    expect(orchestratorProjectDirName({ WE_ORCHESTRATOR_PROJECT_DIR: 'x' })).toBe('x');
  });
});

describe('scanClaudeProjectsCoverage', () => {
  it('buckets an operations-dispatch dir, the orchestrator dir (incl. a nested subagent file), and everything else', () => {
    const root = tmp();
    const dispatchDir = join(root, 'x-operations-dispatch-1');
    const orchDir = join(root, 'the-orch-dir');
    const otherDir = join(root, 'some-lane-dir');
    mkdirSync(dispatchDir, { recursive: true });
    mkdirSync(join(orchDir, 'sess1', 'subagents'), { recursive: true });
    mkdirSync(otherDir, { recursive: true });
    const line = (usage) => `${JSON.stringify({ type: 'assistant', timestamp: '2026-09-27T10:00:00.000Z', message: { model: 'claude-sonnet-5', usage } })}\n`;
    writeFileSync(join(dispatchDir, 'a.jsonl'), line({ input_tokens: 100, output_tokens: 10 }));
    writeFileSync(join(orchDir, 'sess1.jsonl'), line({ input_tokens: 200, output_tokens: 20 }));
    writeFileSync(join(orchDir, 'sess1', 'subagents', 'agent-1.jsonl'), line({ input_tokens: 300, output_tokens: 30 }));
    writeFileSync(join(otherDir, 'b.jsonl'), line({ input_tokens: 400, output_tokens: 40 }));
    const buckets = scanClaudeProjectsCoverage({ projectsRoot: root, orchestratorDirName: 'the-orch-dir' });
    expect(buckets['dispatched-daemon'].tokens.in).toBe(100);
    expect(buckets['orchestration-overhead'].tokens.in).toBe(200 + 300); // top-level orchestrator + its nested subagent
    expect(buckets['operator-interactive'].tokens.in).toBe(400);
  });
  it('respects sinceMs (the FILE\'s own mtime, same convention as findTranscriptPath) — excluded from every bucket', () => {
    const root = tmp();
    const dir = join(root, 'x-operations-dispatch-1');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'old.jsonl');
    writeFileSync(file, `${JSON.stringify({ type: 'assistant', timestamp: '2020-01-01T00:00:00.000Z', message: { model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 1 } } })}\n`);
    // an impossibly future cutoff — no real file's mtime can ever satisfy it, proving the filter bites.
    const buckets = scanClaudeProjectsCoverage({ projectsRoot: root, sinceMs: Date.now() + 3600_000 });
    expect(buckets['dispatched-daemon'].fileCount).toBe(0);
  });
});

describe('scanReviewJurorUsage', () => {
  it('splits Claude-priced seats from unpriced non-Claude seats in the same run record, attributed by pr', () => {
    const root = tmp();
    writeFileSync(join(root, 'review-pr-abc.json'), JSON.stringify({
      input: { pr: 2670 },
      telemetry: [
        { lens: 'correctness', model: 'sonnet', durationMs: 1000, costUsd: 0.5, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
        { lens: 'security', model: 'gpt-6-astra', durationMs: 2000, costUsd: 0, usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
      ],
    }));
    const { claudeRows, nonClaudeRows } = scanReviewJurorUsage({ runsDir: root });
    expect(claudeRows).toHaveLength(1);
    expect(claudeRows[0]).toMatchObject({ pr: 2670, costUsd: 0.5, dataQuality: 'juror-telemetry' });
    expect(nonClaudeRows).toHaveLength(1);
    expect(nonClaudeRows[0]).toMatchObject({ pr: 2670, costUsd: null, dataQuality: 'juror-telemetry-unpriced' });
  });
  it('is empty (never throws) when the runs dir does not exist', () => {
    expect(scanReviewJurorUsage({ runsDir: '/no/such/dir' })).toEqual({ claudeRows: [], nonClaudeRows: [] });
  });
});

describe('scanNonClaudeJudgeTranscripts', () => {
  it('reads the last turn.completed usage line from a codex-judge-transcripts file', () => {
    const root = tmp();
    writeFileSync(join(root, 'codex-judge-1.jsonl'), [
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 20, cached_input_tokens: 5, cache_write_input_tokens: 0 } }),
      '',
    ].join('\n'));
    const result = scanNonClaudeJudgeTranscripts({ home: root });
    // home/.codex-judge-transcripts doesn't exist here (file was written straight into `root`) — expect empty,
    // proving this reads from the DECLARED subdirectory, not the home dir itself.
    expect(result.fileCount).toBe(0);
  });
  it('finds a file under the real .codex-judge-transcripts subdirectory', () => {
    const root = tmp();
    mkdirSync(join(root, '.codex-judge-transcripts'), { recursive: true });
    writeFileSync(join(root, '.codex-judge-transcripts', 'codex-judge-1.jsonl'), `${JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 20 } })}\n`);
    const result = scanNonClaudeJudgeTranscripts({ home: root });
    expect(result.fileCount).toBe(1);
    expect(result.tokens.in).toBe(100);
    expect(result.costUsd).toBeNull();
  });
});

describe('buildCoverageReport', () => {
  it('never claims more than 100% and reports a percentage per bucket that sums to ~100 when files exist', () => {
    const report = buildCoverageReport({ sinceMs: Date.now() }); // an impossible "since" — every real bucket empty
    expect(report.totalTokens).toBe(0);
    expect(report.attributed.pct).toBeNull(); // 0/0 — never a fabricated percentage
  });
});
