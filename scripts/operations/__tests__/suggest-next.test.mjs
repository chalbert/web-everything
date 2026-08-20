/**
 * @file suggest-next.test.mjs — the `suggest-next` declaration (#3036).
 *
 * THE PROPERTY THIS FILE EXISTS FOR: **the operation re-declares the ranking and does not re-implement it.**
 * Every ordering assertion below is written against `computeSelection` (`we:scripts/readiness/engine.mjs`)
 * called directly on the same fixture — so if this declaration ever grew a prioritisation heuristic of its
 * own, the two would diverge and these tests would fail. Nothing here asserts a hand-written expected order.
 *
 * Plus the two properties that make it the right first HTTP operation: it is `compute`-only — so it cannot
 * suspend and declares no effects, which is what buys it a GET-only surface — and declaring it cost the
 * command line four lines in `run.mjs` and nothing else. `compute`-only is NOT the same as "cannot write";
 * see `http-adapter.test.mjs`, which asserts both the narrower guarantee and the hole it leaves.
 *
 * NOTHING HERE TOUCHES THE LOADER, A LEASE OR `gh`: the board is a fixture array and the exclusions are stubs.
 */

import { describe, it, expect } from 'vitest';

import { computeSelection } from '../../readiness/engine.mjs';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning, runStatus } from '../engine.mjs';
import { buildCliSpec, parseOperationArgv } from '../cli-adapter.mjs';
import { isReadOnlyDeclaration } from '../http-adapter.mjs';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SUGGEST_NEXT_OP,
  SUGGEST_TIERS,
  clampLimit,
  explainRank,
  rankShortlist,
  shapeBoardFinding,
  suggestNextOperation,
  applyScope,
  describeScope,
  SCOPE_FIELDS,
} from '../suggest-next.mjs';

/**
 * One loader-shaped item. The fields named here are exactly the ones `computeSelection` projects — the
 * fixture asserts nothing about them, it only supplies them.
 */
function item(num, over = {}) {
  return {
    num: String(num).padStart(3, '0'),
    id: `${String(num).padStart(3, '0')}-item-${num}`,
    title: `item ${num}`,
    kind: 'story',
    size: 3,
    status: 'open',
    tier: 'A',
    batchable: true,
    batchCost: 3,
    locus: 'webeverything',
    leverageScore: 0,
    directUnblocks: 0,
    transitiveUnblocks: 0,
    unblocksToReady: 0,
    ...over,
  };
}

/** A board with a deliberately NON-id ordering, so "did it re-sort?" is decidable. */
const BOARD = [
  item(101, { leverageScore: 0, size: 8 }),
  item(102, { leverageScore: 12, size: 5, unblocksToReady: 3, transitiveUnblocks: 7 }),
  item(103, { leverageScore: 12, size: 1, unblocksToReady: 3, transitiveUnblocks: 7 }),
  item(104, { kind: 'task', size: undefined, batchCost: 2 }),
  item(105, { kind: 'epic', size: 13, batchable: false, batchCost: 13, epicState: 'unsliced' }),
  item(106, { priority: 'low' }),
  item(107, { status: 'active', kind: 'task', size: undefined }),
  item(201, { tier: 'B', kind: 'decision', size: undefined, batchable: false, leverageScore: 4 }),
  item(202, { tier: 'B', kind: 'decision', size: undefined, batchable: false, leverageScore: 1, preparedDate: '2026-08-01' }),
];

const stubBoard = (items = BOARD) => () => ({ items });
const stubExclusions = (nums = [], sources = null) => () => ({
  nums,
  sources: sources ?? [{ id: 'prepare-hold', nums }, { id: 'open-pr', nums: [] }],
});

/** Build + register the declaration, and run it to completion. Read-only, so no store/sinks/judge exist. */
function runSuggest(input = {}, { items, exclusions } = {}) {
  const declaration = suggestNextOperation({
    loadBoard: stubBoard(items),
    loadExclusions: exclusions ?? stubExclusions(),
  });
  const registry = createRegistry();
  registry.register(declaration);
  const settled = advanceWhileRunning(
    startRun({ op: SUGGEST_NEXT_OP, id: 'run-suggest-test', input, registry }),
    { registry },
  );
  return { declaration, registry, run: settled };
}

describe('suggest-next — it wraps the existing ranking and never re-ranks', () => {
  it('returns `computeSelection`\'s Tier-A order, unchanged', () => {
    const expected = computeSelection(BOARD).tierA.map((it) => it.num);
    const { run } = runSuggest({ limit: MAX_LIMIT });
    expect(run.verdict.suggested.map((s) => s.num)).toEqual(expected);
  });

  it('returns `computeSelection`\'s Tier-B order — prepared-first — unchanged', () => {
    const expected = computeSelection(BOARD).tierB.map((it) => it.num);
    // #202 has the LOWER leverage but carries a preparedDate, so `computeSelection` puts it first. This
    // assertion is meaningful only because the fixture is built that way round.
    expect(expected[0]).toBe('202');
    const { run } = runSuggest({ tier: 'B', limit: MAX_LIMIT });
    expect(run.verdict.suggested.map((s) => s.num)).toEqual(expected);
  });

  it('`batchableOnly` narrows to `computeSelection`\'s batch pool, in the same order', () => {
    const expected = computeSelection(BOARD).batchable.map((it) => it.num);
    const { run } = runSuggest({ batchableOnly: true, limit: MAX_LIMIT });
    expect(run.verdict.suggested.map((s) => s.num)).toEqual(expected);
    // The unsliceable epic and the `priority: low` filler are in tierA but not in the pool.
    expect(expected).not.toContain('105');
    expect(expected).not.toContain('106');
  });

  it('`why` restates the ranking key and invents nothing', () => {
    const top = computeSelection(BOARD).tierA[0];
    expect(explainRank(top)).toContain(`leverage ${top.leverageScore}`);
    expect(explainRank(top)).toContain(`frees ${top.unblocksToReady}`);
  });
});

describe('suggest-next — the shortlist projection', () => {
  it('defaults to Tier A, 5 suggestions, and names the top pick as `next`', () => {
    const { run } = runSuggest({});
    expect(run.verdict.tier).toBe('A');
    expect(run.verdict.limit).toBe(DEFAULT_LIMIT);
    expect(run.verdict.suggested.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
    expect(run.verdict.next).toEqual(run.verdict.suggested[0]);
    expect(run.verdict.next.rank).toBe(1);
  });

  it('clamps the limit rather than refusing it, and reports both numbers', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(999)).toBe(MAX_LIMIT);
    expect(clampLimit(2.7)).toBe(2);
    const { run } = runSuggest({ limit: 999 });
    expect(run.verdict.requestedLimit).toBe(999);
    expect(run.verdict.limit).toBe(MAX_LIMIT);
  });

  it('drops excluded items — a prepare-held or open-PR number never reaches the shortlist', () => {
    const all = computeSelection(BOARD).tierA.map((it) => it.num);
    const victim = all[0];
    const { run } = runSuggest({ limit: MAX_LIMIT }, { exclusions: stubExclusions([victim]) });
    expect(run.verdict.suggested.map((s) => s.num)).not.toContain(victim);
    expect(run.verdict.suggested.map((s) => s.num)).toEqual(all.filter((n) => n !== victim));
  });

  it('reports an exclusion source that could NOT run, so a weaker answer is never silent', () => {
    const exclusions = () => ({
      nums: [],
      sources: [
        { id: 'prepare-hold', nums: [] },
        { id: 'open-pr', nums: [], unavailable: true, reason: 'gh unavailable' },
      ],
    });
    const { run } = runSuggest({}, { exclusions });
    const openPr = run.verdict.exclusionSources.find((s) => s.id === 'open-pr');
    expect(openPr).toEqual({ id: 'open-pr', applied: false, count: 0, reason: 'gh unavailable' });
  });

  it('distinguishes a DRAINED pool from an empty one (#083)', () => {
    const drained = [item(107, { status: 'active', kind: 'task', size: undefined })];
    const { run } = runSuggest({}, { items: drained });
    expect(run.verdict.suggested).toEqual([]);
    expect(run.verdict.next).toBeNull();
    expect(run.verdict.empty.inFlight).toBe(1);
    expect(run.verdict.empty.note).toContain('DRAINED');

    const { run: bare } = runSuggest({}, { items: [] });
    expect(bare.verdict.empty.note).toContain('genuinely empty');
  });

  it('does not reorder what it is handed — `rankShortlist` is a filter and a slice', () => {
    const board = shapeBoardFinding({ items: BOARD, exclusions: { nums: [], sources: [] } });
    const out = rankShortlist({ board, tier: 'A', limit: MAX_LIMIT, batchableOnly: false });
    expect(out.suggested.map((s) => s.num)).toEqual(board.tierA.map((it) => it.num));
  });
});

describe('suggest-next — refusals', () => {
  it('refuses a tier outside the declared set BEFORE a run record exists', () => {
    const declaration = suggestNextOperation({ loadBoard: stubBoard() });
    const registry = createRegistry();
    registry.register(declaration);
    expect(() => startRun({ op: SUGGEST_NEXT_OP, id: 'run-x', input: { tier: 'C' }, registry }))
      .toThrow(/must be one of A\|B, got "C"/);
  });

  it('refuses a board that is not the loader\'s array rather than ranking nothing', () => {
    expect(() => shapeBoardFinding({ items: 'not an array' }))
      .toThrow(/must return `\{ items \}`/);
    expect(() => shapeBoardFinding(null)).toThrow(/not a board object/);
  });

  it('refuses to build without an injected board reader', () => {
    expect(() => suggestNextOperation({})).toThrow(/needs a `loadBoard\(\)` reader/);
  });
});

describe('suggest-next — what makes it the right first HTTP operation', () => {
  it('is `compute`-only, so it cannot suspend and declares no effects', () => {
    const declaration = suggestNextOperation({ loadBoard: stubBoard() });
    expect(declaration.steps.map((s) => s.step.kind)).toEqual(['compute', 'compute']);
    expect(isReadOnlyDeclaration(declaration)).toBe(true);
  });

  it('completes in one sweep — it never suspends, so there is nothing to resume', () => {
    const { run, registry } = runSuggest({});
    expect(runStatus(run, { registry })).toBe('complete');
    expect(run.pending).toBeNull();
    expect(run.effects).toEqual([]);
    expect(run.telemetry).toEqual([]);
  });

  it('buys its command line from the declaration alone — the closed set prints in --help', () => {
    const declaration = suggestNextOperation({ loadBoard: stubBoard() });
    const usage = buildCliSpec(declaration).usage;
    expect(usage).toContain(`--tier=${SUGGEST_TIERS.join('|')}, default A`);
    expect(usage).toContain('--limit=<number>, default 5');
    expect(usage).toContain('steps: board(compute) → shortlist(compute)');
    // …and the same derived parser refuses an unknown value with no per-operation code anywhere.
    expect(parseOperationArgv(declaration, ['--tier=C']).errors)
      .toEqual([expect.stringContaining('must be one of A|B')]);
  });
});

describe('scope — a filter narrows the population, it never re-ranks and never widens', () => {
  /**
   * THE NUMBERS ARE DELIBERATELY OUT OF ASCENDING ORDER relative to rank. A first cut of this fixture had
   * rank order and num order coincide, which made the "never reorders" assertion below VACUOUS — a mutant
   * that sorted the survivors by `num` passed every test. Mutation testing caught it; the fixture now makes
   * the two orders disagree, so any re-sort is visible.
   */
  const ranked = [
    { num: '007', id: '007-a', title: 'a', kind: 'task', tier: 'A', parent: '2405', tags: ['gate', 'review'], locus: 'webeverything', leverageScore: 9 },
    { num: '002', id: '002-b', title: 'b', kind: 'task', tier: 'A', parent: '3029', tags: ['ops'], locus: 'frontierui', leverageScore: 5 },
    { num: '001', id: '001-c', title: 'c', kind: 'task', tier: 'A', parent: '2405', tags: ['Gate'], locus: 'webeverything', leverageScore: 1 },
    { num: '004', id: '004-d', title: 'd', kind: 'task', tier: 'A', tags: [], locus: 'webeverything', leverageScore: 0 },
  ];

  it('is a no-op when no scope field is set', () => {
    expect(applyScope(ranked, {})).toHaveLength(4);
    expect(applyScope(ranked)).toHaveLength(4);
  });

  it('narrows by parent, matching the padded number a caller naturally types', () => {
    expect(applyScope(ranked, { parent: '2405' }).map((i) => i.num)).toEqual(['007', '001']);
    // `2405` and `02405` are the same epic — the loader stores the frontmatter string, the caller types a number.
    expect(applyScope(ranked, { parent: 2405 }).map((i) => i.num)).toEqual(['007', '001']);
  });

  it('narrows by tag, case-insensitively, against the loader\'s own tags', () => {
    expect(applyScope(ranked, { tag: 'gate' }).map((i) => i.num)).toEqual(['007', '001']);
    expect(applyScope(ranked, { tag: 'GATE' }).map((i) => i.num)).toEqual(['007', '001']);
  });

  it('narrows by locus', () => {
    expect(applyScope(ranked, { locus: 'frontierui' }).map((i) => i.num)).toEqual(['002']);
  });

  it('ANDs the fields it was given', () => {
    expect(applyScope(ranked, { parent: '2405', tag: 'review' }).map((i) => i.num)).toEqual(['007']);
    expect(applyScope(ranked, { parent: '2405', locus: 'frontierui' })).toEqual([]);
  });

  /**
   * THE LOAD-BEARING PROPERTY. "Which items am I asking about" and "which of them matters most" are
   * different questions and the second already has exactly one owner (`computeSelection`). A scope that
   * reordered — surfacing an epic's blockers first, say — would be a second ranking living inside a
   * filter, and the two would drift. So the survivors must come out in the order they went in.
   */
  it('never reorders — the ranking is not this function\'s to make', () => {
    const out = applyScope(ranked, { locus: 'webeverything' });
    expect(out.map((i) => i.num)).toEqual(['007', '001', '004']);
    // …and each survivor is the SAME object, not a re-derived copy that could disagree with the board.
    expect(out[0]).toBe(ranked[0]);
  });

  it('echoes only the fields the caller actually set', () => {
    expect(describeScope({ parent: '2405' })).toEqual({ parent: '2405' });
    expect(describeScope({})).toEqual({});
    expect(SCOPE_FIELDS).toEqual(['parent', 'tag', 'locus']);
  });

  /**
   * A SCOPE THAT MATCHED NOTHING IS NOT AN EMPTY POOL, and must never be answered by widening back to the
   * unscoped list — that answers a question the caller did not ask, the same defect as reporting a check
   * that did not run as a pass.
   */
  it('reports an empty SCOPE distinctly from an empty pool, and suggests nothing', () => {
    const board = { tierA: ranked, tierB: [], batchable: [], filler: [], inFlight: [], excludedNums: [], counts: {} };
    const out = rankShortlist({ board, tier: 'A', limit: 5, batchableOnly: false, scope: { parent: '9999' } });
    expect(out.suggested).toEqual([]);
    expect(out.next).toBeNull();
    expect(out.scopedOut).toBe(4);
    expect(out.empty.note).toMatch(/your scope is/);
    expect(out.empty.note).toMatch(/NOT empty/);
  });

  it('reports a genuinely empty pool with the pool\'s own reason, not the scope\'s', () => {
    const board = { tierA: [], tierB: [], batchable: [], filler: [], inFlight: [], excludedNums: [], counts: {} };
    const out = rankShortlist({ board, tier: 'A', limit: 5, batchableOnly: false, scope: { parent: '2405' } });
    expect(out.empty.note).toMatch(/genuinely empty at this tier/);
    expect(out.empty.note).not.toMatch(/your scope is/);
  });

  it('carries parent and tags into the shortlist so a caller sees WHY an item matched', () => {
    const board = { tierA: ranked, tierB: [], batchable: [], filler: [], inFlight: [], excludedNums: [], counts: {} };
    const out = rankShortlist({ board, tier: 'A', limit: 5, batchableOnly: false, scope: { parent: '2405' } });
    expect(out.suggested[0]).toMatchObject({ num: '007', parent: '2405', tags: ['gate', 'review'] });
    // …and an item with neither carries neither, rather than a defaulted empty.
    const all = rankShortlist({ board, tier: 'A', limit: 5, batchableOnly: false, scope: {} });
    expect(all.suggested[3]).not.toHaveProperty('parent');
  });

  // `limit` must count items the caller could actually take, not items that survived the filter.
  it('applies the scope BEFORE the limit slice', () => {
    const board = { tierA: ranked, tierB: [], batchable: [], filler: [], inFlight: [], excludedNums: [], counts: {} };
    const out = rankShortlist({ board, tier: 'A', limit: 2, batchableOnly: false, scope: { parent: '2405' } });
    expect(out.suggested.map((i) => i.num)).toEqual(['007', '001']);
  });
});
