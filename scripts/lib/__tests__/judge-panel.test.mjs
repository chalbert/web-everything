/**
 * @file judge-panel.test.mjs — the fan-out's four refusals and its one product property (#3050).
 *
 * NOTHING HERE SPAWNS A PROCESS. Every test drives `judgePanel` over an injected `spawnFn`, the same seam
 * `judge-spawn.test.mjs` uses — which matters more for a panel than for a single spawn, because a panel bills
 * N metered calls, not one. The opt-in live test lives in `judge-panel.integration.test.mjs`.
 *
 * WHAT THE LOAD-BEARING TESTS ARE, AND WHY EACH ONE EXISTS:
 *
 *  • PAIRWISE-DISTINCT SIBLINGS is the product. It is pinned three ways that fail independently: on the
 *    values the panel RETURNS, on the `--session-id` tokens that actually REACHED each child's argv (so a
 *    return value alone cannot fake it), and on the pure `panelSeats` / `deriveSessionId` seam with no
 *    spawning at all. The case that would otherwise slip is TWO SEATS ON ONE LENS — the `jurorsPerLens: 2`
 *    roster `panelRigorForCareLevel('high')` produces — because seeding on the lens alone collapses them onto
 *    one id, i.e. one actor.
 *
 *  • EVERY REFUSAL IS ASSERTED WITH A SPAWN COUNTER, not just a `rejects.toThrow`. "Refused" and "refused
 *    before it cost anything" are different claims and only the counter proves the second.
 *
 *  • THE UNKNOWN-DEPTH REFUSAL HAS ITS OWN TESTS, separate from the over-cap one. An over-cap refusal passing
 *    says nothing about whether an absent depth silently defaults to admitted, which is the actual fail-open.
 *
 *  • ONE REJECTING JUROR is exercised through a mixed roster where the failing seat is deliberately the
 *    FASTEST to settle: if the panel short-circuited on the first rejection, the slower siblings would be
 *    orphaned and the test would see their spawns unfinished.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  judgePanel,
  panelSeats,
  assertPanelDepth,
  assertPanelBudget,
} from '../judge-panel.mjs';
import { deriveSessionId, sessionSeed, buildJudgeArgv, DEFAULT_BUDGET_USD } from '../judge-spawn.mjs';
import { PANEL_LENSES, panelRigorForCareLevel } from '../jury-core.mjs';
import { CARE_LEVELS } from '../review-escalation.mjs';

const SHAPE = {
  type: 'object',
  properties: { verdict: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['verdict', 'findings'],
  additionalProperties: false,
};

/** The panel-wide arguments every happy-path test shares, so each test states only what it is about. */
const BASE = {
  runId: 'run-3050',
  mandate: 'You are a juror. Answer only through the schema.',
  input: 'THE-DIFF-SENTINEL',
  shape: SHAPE,
  depth: 0,
  maxDepth: 2,
  maxTotalBudgetUsd: 10,
};

/** A juror result the CLI would emit, echoing back the `--session-id` it was handed (as 2.1.220 does). */
function okJson(sessionId, { verdict = 'accept', costUsd = 0.02 } = {}) {
  return JSON.stringify({
    is_error: false,
    stop_reason: 'tool_use',
    session_id: sessionId,
    total_cost_usd: costUsd,
    duration_ms: 1900,
    num_turns: 1,
    usage: { input_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 900 },
    structured_output: { verdict, findings: [] },
  });
}

/**
 * A fake `child_process.spawn` for a whole PANEL — it is called once per seat and records every child.
 *
 * `plan(sessionId, index)` returns `{ stdout, code, stderr, delayMs }` for that seat, so a test can make one
 * seat fail, or make seats settle in a chosen order. `log` records `close:<index>` as each child settles, and
 * the test appends `panel` after awaiting — which is how "the panel resolved only after every child" is an
 * assertion rather than a hope.
 */
function panelSpawn(plan = () => ({})) {
  const calls = [];
  const log = [];
  let spawnedWhenFirstClosed = null;
  const fn = (cli, argv, opts) => {
    const index = calls.length;
    const sessionId = argv[argv.indexOf('--session-id') + 1];
    const rec = { cli, argv, opts, sessionId, stdin: '', closed: false };
    calls.push(rec);
    const { stdout = okJson(sessionId), stderr = '', code = 0, delayMs = 0 } = plan(sessionId, index) ?? {};
    const h = {};
    const child = {
      stdout: { on: (e, cb) => { if (e === 'data') h.out = cb; } },
      stderr: { on: (e, cb) => { if (e === 'data') h.err = cb; } },
      stdin: { on: () => {}, end: (d) => { rec.stdin = d; } },
      on: (e, cb) => { h[e] = cb; },
      kill: () => {},
    };
    setTimeout(() => {
      if (spawnedWhenFirstClosed === null) spawnedWhenFirstClosed = calls.length;
      if (stdout) h.out?.(stdout);
      if (stderr) h.err?.(stderr);
      rec.closed = true;
      log.push(`close:${index}`);
      h.close?.(code);
    }, delayMs);
    return child;
  };
  return {
    fn,
    calls,
    log,
    get count() { return calls.length; },
    get spawnedWhenFirstClosed() { return spawnedWhenFirstClosed; },
    sessionIdsFromArgv: () => calls.map((c) => c.argv[c.argv.indexOf('--session-id') + 1]),
  };
}

/** A `spawnFn` that must never be reached — every refusal test uses one. */
function forbiddenSpawn() {
  const seen = { count: 0 };
  return { seen, fn: () => { seen.count += 1; throw new Error('a refusal test spawned a child'); } };
}

const FOUR_SEATS = [
  { lens: 'correctness' },
  { lens: 'security' },
  { lens: 'simplicity' },
  { lens: 'standards-conformance' },
];

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('judgePanel — one spawn per seat, all awaited, results returned together (#3050)', () => {
  it('spawns exactly one child per juror and resolves to one result per juror, in roster order', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(spy.count).toBe(4);
    expect(panel.jurors).toHaveLength(4);
    expect(panel.jurors.map((j) => j.lens)).toEqual(
      ['correctness', 'security', 'simplicity', 'standards-conformance'],
    );
    expect(panel.ok).toBe(true);
    expect(panel.failedCount).toBe(0);
  });

  it('carries at minimum lens, sessionId, value, costUsd, wallMs and loadedContextTokens per juror', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    for (const j of panel.jurors) {
      expect(typeof j.lens).toBe('string');
      expect(j.sessionId).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
      expect(j.value).toEqual({ verdict: 'accept', findings: [] });
      expect(j.costUsd).toBe(0.02);
      expect(typeof j.wallMs).toBe('number');
      expect(j.loadedContextTokens).toBe(1005); // 5 + 100 + 900, straight from the CLI's own usage block
    }
    expect(panel.totalCostUsd).toBeCloseTo(0.08, 10);
  });

  it('starts every child BEFORE any of them settles — the fan-out is concurrent, not a serial loop', async () => {
    const spy = panelSpawn(() => ({ delayMs: 5 }));
    await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(spy.spawnedWhenFirstClosed).toBe(4);
  });

  it('writes the judged material to each child\'s STDIN and keeps it out of every argv', async () => {
    const spy = panelSpawn();
    await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    for (const c of spy.calls) {
      expect(c.stdin).toBe('THE-DIFF-SENTINEL');
      expect(c.argv.join('')).not.toContain('THE-DIFF-SENTINEL');
    }
  });

  it('reimplements no argv recipe — each child\'s argv is exactly buildJudgeArgv\'s output for that seat', async () => {
    const spy = panelSpawn();
    await judgePanel({
      ...BASE,
      jurors: [{ lens: 'correctness', model: 'opus', effort: 'high', budget: 0.75 }],
      spawnFn: spy.fn,
    });
    expect(spy.calls[0].argv).toEqual(buildJudgeArgv({
      mandate: BASE.mandate,
      shape: SHAPE,
      model: 'opus',
      effort: 'high',
      budget: 0.75,
      sessionId: deriveSessionId(sessionSeed(['run-3050', 'correctness#1'])),
    }));
  });

  it('lets a seat override the panel-wide dial without a second code path', async () => {
    const spy = panelSpawn();
    await judgePanel({
      ...BASE,
      model: 'haiku',
      effort: 'low',
      jurors: [{ lens: 'correctness' }, { lens: 'security', model: 'opus', effort: 'max' }],
      spawnFn: spy.fn,
    });
    const dialOf = (c) => [c.argv[c.argv.indexOf('--model') + 1], c.argv[c.argv.indexOf('--effort') + 1]];
    expect(dialOf(spy.calls[0])).toEqual(['haiku', 'low']);
    expect(dialOf(spy.calls[1])).toEqual(['opus', 'max']);
  });

  it('records the id it ASKED for and the id the child ECHOED separately, so a divergence is visible', async () => {
    const spy = panelSpawn((sid, i) => (i === 1 ? { stdout: okJson('ffffffff-ffff-8fff-9fff-ffffffffffff') } : { stdout: okJson(sid) }));
    const panel = await judgePanel({ ...BASE, jurors: [{ lens: 'correctness' }, { lens: 'security' }], spawnFn: spy.fn });
    expect(panel.jurors[0].reportedSessionId).toBe(panel.jurors[0].sessionId);
    expect(panel.jurors[1].reportedSessionId).toBe('ffffffff-ffff-8fff-9fff-ffffffffffff');
    expect(panel.jurors[1].sessionId).not.toBe(panel.jurors[1].reportedSessionId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('PAIRWISE-DISTINCT SIBLINGS — the one property a subagent panel cannot have (#3050 constraint 4)', () => {
  it('returns pairwise-distinct sessionIds across a roster of N ≥ 3 seats', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    const ids = panel.jurors.map((j) => j.sessionId);
    expect(new Set(ids).size).toBe(4);
  });

  it('puts those distinct ids in the CHILDREN\'S OWN ARGV — a return value alone could not prove it', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    const fromArgv = spy.sessionIdsFromArgv();
    expect(new Set(fromArgv).size).toBe(4);
    expect(fromArgv).toEqual(panel.jurors.map((j) => j.sessionId));
  });

  it('separates TWO SEATS ON THE SAME LENS — the case that seeding on the lens alone collapses', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({
      ...BASE,
      jurors: [{ lens: 'correctness' }, { lens: 'correctness' }, { lens: 'security' }],
      spawnFn: spy.fn,
    });
    expect(panel.jurors.map((j) => j.id)).toEqual(['correctness#1', 'correctness#2', 'security#1']);
    expect(new Set(panel.jurors.map((j) => j.sessionId)).size).toBe(3);
    expect(panel.jurors[0].sessionId).not.toBe(panel.jurors[1].sessionId);
    expect(new Set(spy.sessionIdsFromArgv()).size).toBe(3);
  });

  it('holds over the WHOLE `jurorsPerLens: 2` roster care `high` actually produces (jury-core, unmodified)', async () => {
    const rigor = panelRigorForCareLevel(CARE_LEVELS.HIGH);
    expect(rigor.jurorsPerLens).toBe(2); // the premise — if jury-core re-dials, this test says so out loud
    const jurors = rigor.lenses.flatMap((lens) => [{ lens }, { lens }]);
    expect(jurors).toHaveLength(PANEL_LENSES.length * 2);
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, maxTotalBudgetUsd: 99, jurors, spawnFn: spy.fn });
    expect(new Set(panel.jurors.map((j) => j.sessionId)).size).toBe(jurors.length);
    expect(new Set(spy.sessionIdsFromArgv()).size).toBe(jurors.length);
  });

  it('refuses a roster whose seats would share an id, rather than seating one actor twice', () => {
    expect(() => panelSeats({
      runId: 'run-3050',
      jurors: [{ lens: 'correctness', id: 'dup' }, { lens: 'security', id: 'dup' }],
    })).toThrow(/share an id/);
  });
});

describe('PAIRWISE-DISTINCT over the PURE seam — no spawning at all (#3050 acceptance 2, second half)', () => {
  it('deriveSessionId separates N distinct runId+lens seeds', () => {
    const seeds = [
      ['run-3050', 'correctness#1'],
      ['run-3050', 'security#1'],
      ['run-3050', 'simplicity#1'],
      ['run-3050', 'standards-conformance#1'],
      ['run-3051', 'correctness#1'],
    ].map((f) => sessionSeed(f));
    expect(new Set(seeds.map(deriveSessionId)).size).toBe(seeds.length);
  });

  it('deriveSessionId separates TWO SEATS ON THE SAME LENS, because the slot is in the seed', () => {
    expect(deriveSessionId(sessionSeed(['run-3050', 'correctness#1']))).not.toBe(deriveSessionId(sessionSeed(['run-3050', 'correctness#2'])));
  });

  it('panelSeats mints the same lens#slot ids jury-core\'s materializeRoster already uses', () => {
    const seats = panelSeats({
      runId: 'run-3050',
      jurors: [{ lens: 'correctness' }, { lens: 'correctness' }, { lens: 'security' }, { lens: 'security' }],
    });
    expect(seats.map((s) => s.id)).toEqual(['correctness#1', 'correctness#2', 'security#1', 'security#2']);
    expect(seats.map((s) => s.slot)).toEqual([1, 2, 1, 2]);
    expect(new Set(seats.map((s) => s.sessionId)).size).toBe(4);
  });

  it('panelSeats is deterministic and derives each id from runId + seat id', () => {
    const a = panelSeats({ runId: 'run-3050', jurors: [{ lens: 'correctness' }] });
    const b = panelSeats({ runId: 'run-3050', jurors: [{ lens: 'correctness' }] });
    expect(a[0].sessionId).toBe(b[0].sessionId);
    expect(a[0].sessionId).toBe(deriveSessionId(sessionSeed(['run-3050', 'correctness#1'])));
  });

  it('a different run yields a different actor for the same seat', () => {
    const [x] = panelSeats({ runId: 'run-A', jurors: [{ lens: 'correctness' }] });
    const [y] = panelSeats({ runId: 'run-B', jurors: [{ lens: 'correctness' }] });
    expect(x.sessionId).not.toBe(y.sessionId);
  });

  it('CROSS-RUN: two structurally different seats in two runs are never the same actor (#3058)', () => {
    // Reproduced on `main` before the fix: `(runId "a", id "b c#1")` and `(runId "a b", id "c#1")` both
    // derived 8f57af23-ca27-80e7-b1f3-c2510e0aa618 THROUGH `panelSeats`, not merely through the hash helper.
    const [x] = panelSeats({ runId: 'a', jurors: [{ lens: 'correctness', id: 'b c#1' }] });
    const [y] = panelSeats({ runId: 'a b', jurors: [{ lens: 'correctness', id: 'c#1' }] });
    expect(x.id).not.toBe(y.id);
    expect(x.sessionId).not.toBe(y.sessionId);
    expect(x.sessionId).toBe(deriveSessionId(sessionSeed(['a', 'b c#1'])));
    expect(y.sessionId).toBe(deriveSessionId(sessionSeed(['a b', 'c#1'])));
  });

  it('CROSS-RUN, as a table over run ids and seat ids that a space join would have merged (#3058)', () => {
    const runIds = ['a', 'a b', 'a b c', '', ' ', 'run#1'];
    const seatIds = ['b c#1', 'c#1', 'b#1 c', 'correctness#1', 'correctness#2', '#1'];
    const seen = new Map();
    for (const runId of runIds) {
      for (const seatId of seatIds) {
        // `panelSeats` refuses a blank runId, so the pure encoder carries the blank rows.
        const sid = runId.trim()
          ? panelSeats({ runId, jurors: [{ lens: 'correctness', id: seatId }] })[0].sessionId
          : deriveSessionId(sessionSeed([runId, seatId]));
        const key = `${JSON.stringify(runId)}|${JSON.stringify(seatId)}`;
        expect(seen.has(sid)).toBe(false);
        seen.set(sid, key);
      }
    }
    expect(seen.size).toBe(runIds.length * seatIds.length);
  });

  it('there is ONE seed encoding: panelSeats derives exactly what the shared encoder does (#3058)', () => {
    // If this module ever grows its own join, this fails — which is the whole point of the shared helper.
    const seats = panelSeats({
      runId: 'run 3050',
      jurors: [{ lens: 'correctness' }, { lens: 'correctness' }, { lens: 'security#odd name' }],
    });
    expect(seats.map((s) => s.sessionId)).toEqual(
      seats.map((s) => deriveSessionId(sessionSeed(['run 3050', s.id]))),
    );
  });

  it('refuses a roster it cannot name — no runId, no jurors, a lensless or malformed seat, a bad slot', () => {
    expect(() => panelSeats({ jurors: [{ lens: 'correctness' }] })).toThrow(/runId/);
    expect(() => panelSeats({ runId: 'r', jurors: [] })).toThrow(/non-empty array/);
    expect(() => panelSeats({ runId: 'r' })).toThrow(/non-empty array/);
    expect(() => panelSeats({ runId: 'r', jurors: [{}] })).toThrow(/lens/);
    expect(() => panelSeats({ runId: 'r', jurors: ['correctness'] })).toThrow(/must be an object/);
    expect(() => panelSeats({ runId: 'r', jurors: [{ lens: 'c', slot: 0 }] })).toThrow(/positive integer/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('REFUSAL 1 — depth fails closed, over the cap AND when the depth is unknown (#3050 constraint 1)', () => {
  it('refuses depth >= maxDepth, and spawns nothing', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({ ...BASE, depth: 2, maxDepth: 2, jurors: FOUR_SEATS, spawnFn: fn }))
      .rejects.toThrow(/depth 2 with maxDepth 2/);
    expect(seen.count).toBe(0);
  });

  it('refuses depth beyond the cap too', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({ ...BASE, depth: 5, maxDepth: 2, jurors: FOUR_SEATS, spawnFn: fn }))
      .rejects.toThrow(/nesting cap is closed/);
    expect(seen.count).toBe(0);
  });

  it('admits a panel strictly under the cap', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, depth: 1, maxDepth: 2, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(panel.depth).toBe(1);
    expect(panel.maxDepth).toBe(2);
    expect(spy.count).toBe(4);
  });

  // The unknown-depth case gets its OWN tests: an over-cap refusal says nothing about whether an ABSENT depth
  // quietly defaults to admitted, and that default is the actual fail-open (#3013 Fork 2: absent ⇒ not routine).
  it.each([
    ['an absent depth', { depth: undefined }, /`depth` must be a finite non-negative number/],
    ['a null depth', { depth: null }, /`depth` must be a finite non-negative number/],
    ['a numeric STRING depth', { depth: '0' }, /`depth` must be a finite non-negative number/],
    ['a NaN depth', { depth: Number.NaN }, /`depth` must be a finite non-negative number/],
    ['an Infinite depth', { depth: Number.POSITIVE_INFINITY }, /`depth` must be a finite non-negative number/],
    ['a negative depth', { depth: -1 }, /`depth` must be a finite non-negative number/],
    ['an absent maxDepth', { maxDepth: undefined }, /`maxDepth` must be a finite non-negative number/],
    ['a null maxDepth', { maxDepth: null }, /`maxDepth` must be a finite non-negative number/],
    ['a numeric STRING maxDepth', { maxDepth: '2' }, /`maxDepth` must be a finite non-negative number/],
    ['a NaN maxDepth', { maxDepth: Number.NaN }, /`maxDepth` must be a finite non-negative number/],
    ['an Infinite maxDepth', { maxDepth: Number.POSITIVE_INFINITY }, /`maxDepth` must be a finite non-negative number/],
    ['a maxDepth of 0, which admits nothing', { maxDepth: 0 }, /at least 1/],
  ])('refuses %s, and spawns nothing', async (_label, override, pattern) => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({ ...BASE, ...override, jurors: FOUR_SEATS, spawnFn: fn })).rejects.toThrow(pattern);
    expect(seen.count).toBe(0);
  });

  it('refuses a call with NO depth arguments at all — the plainest unknown-depth case', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({
      runId: 'run-3050', mandate: 'm', input: 'i', shape: SHAPE, maxTotalBudgetUsd: 10,
      jurors: FOUR_SEATS, spawnFn: fn,
    })).rejects.toThrow(/`depth` must be a finite non-negative number/);
    expect(seen.count).toBe(0);
  });

  it('assertPanelDepth is the pure guard behind all of that, and returns the validated pair', () => {
    expect(assertPanelDepth({ depth: 0, maxDepth: 1 })).toEqual({ depth: 0, maxDepth: 1 });
    expect(() => assertPanelDepth()).toThrow(/`depth`/);
    expect(() => assertPanelDepth({ depth: 0 })).toThrow(/`maxDepth`/);
    expect(() => assertPanelDepth({ depth: 1, maxDepth: 1 })).toThrow(/nesting cap is closed/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('REFUSAL 2 — the aggregate budget, checked BEFORE the first spawn (#3050 constraint 2)', () => {
  it('refuses when the roster\'s declared budgets exceed the ceiling, with ZERO spawns', async () => {
    const { fn, seen } = forbiddenSpawn();
    // Four seats at the judge-spawn default of $0.50 is $2.00 declared against a $1.00 ceiling.
    await expect(judgePanel({ ...BASE, maxTotalBudgetUsd: 1, jurors: FOUR_SEATS, spawnFn: fn }))
      .rejects.toThrow(/total \$2 against a maxTotalBudgetUsd of \$1/);
    expect(seen.count).toBe(0);
  });

  it('an ABSENT maxTotalBudgetUsd is itself a refusal — an unset ceiling is not an unlimited one', async () => {
    const { fn, seen } = forbiddenSpawn();
    const { maxTotalBudgetUsd, ...noCeiling } = BASE;
    expect(maxTotalBudgetUsd).toBe(10); // the destructure really did remove it
    await expect(judgePanel({ ...noCeiling, jurors: FOUR_SEATS, spawnFn: fn }))
      .rejects.toThrow(/`maxTotalBudgetUsd` must be a positive finite number/);
    expect(seen.count).toBe(0);
  });

  it.each([
    ['null', null],
    ['zero', 0],
    ['negative', -5],
    ['a numeric string', '10'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses a %s ceiling, and spawns nothing', async (_label, ceiling) => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({ ...BASE, maxTotalBudgetUsd: ceiling, jurors: FOUR_SEATS, spawnFn: fn }))
      .rejects.toThrow(/`maxTotalBudgetUsd` must be a positive finite number/);
    expect(seen.count).toBe(0);
  });

  it('sums the SEATS\' OWN budgets, not the default, so a per-lens dial is priced honestly', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({
      ...BASE,
      maxTotalBudgetUsd: 1.0,
      jurors: [{ lens: 'correctness', budget: 0.9 }, { lens: 'security', budget: 0.2 }],
      spawnFn: fn,
    })).rejects.toThrow(/total \$1\.1 against a maxTotalBudgetUsd of \$1/);
    expect(seen.count).toBe(0);
  });

  it('admits a roster exactly AT the ceiling — the refusal is `>`, not `>=`', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({
      ...BASE,
      maxTotalBudgetUsd: 2,
      jurors: FOUR_SEATS, // 4 × the $0.50 default
      spawnFn: spy.fn,
    });
    expect(panel.totalBudgetUsd).toBe(4 * DEFAULT_BUDGET_USD);
    expect(spy.count).toBe(4);
  });

  it('reports the declared total and the OBSERVED total separately — one is admission control, one is spend', async () => {
    const spy = panelSpawn((sid) => ({ stdout: okJson(sid, { costUsd: 0.11 }) }));
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(panel.totalBudgetUsd).toBe(2);
    expect(panel.maxTotalBudgetUsd).toBe(10);
    expect(panel.totalCostUsd).toBeCloseTo(0.44, 10);
  });

  it('assertPanelBudget is the pure guard behind all of that', () => {
    expect(assertPanelBudget({ budgets: [0.5, 0.5], maxTotalBudgetUsd: 1 }))
      .toEqual({ totalBudgetUsd: 1, maxTotalBudgetUsd: 1 });
    expect(() => assertPanelBudget({ budgets: [0.5] })).toThrow(/maxTotalBudgetUsd/);
    expect(() => assertPanelBudget({ budgets: [1, 1], maxTotalBudgetUsd: 1 })).toThrow(/Nothing was spawned/);
    expect(() => assertPanelBudget({ budgets: [0, 1], maxTotalBudgetUsd: 5 })).toThrow(/per-juror budget/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('REFUSAL 3 — synchronous by construction: no detach, no early resolve (#3050 constraint 3)', () => {
  it('resolves ONLY after every injected child has settled, including the slowest', async () => {
    const spy = panelSpawn((_sid, i) => ({ delayMs: [30, 1, 15, 5][i] }));
    await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    spy.log.push('panel');
    // Every child closed, and the panel's own settle is strictly last — an early resolve would interleave.
    expect(spy.log).toHaveLength(5);
    expect(spy.log[spy.log.length - 1]).toBe('panel');
    expect(spy.log.slice(0, 4).sort()).toEqual(['close:0', 'close:1', 'close:2', 'close:3']);
    expect(spy.calls.every((c) => c.closed)).toBe(true);
  });

  it('waits for a SLOW seat even when a fast seat has already failed', async () => {
    const spy = panelSpawn((sid, i) => (i === 0
      ? { stdout: JSON.stringify({ is_error: true, result: 'the fast juror died' }), code: 1, delayMs: 0 }
      : { stdout: okJson(sid), delayMs: 25 }));
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(spy.calls.every((c) => c.closed)).toBe(true);
    expect(panel.jurors).toHaveLength(4);
  });

  it('the module\'s own source contains no detach primitive — the escape hatch does not exist to be used', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'judge-panel.mjs'), 'utf8');
    expect(src.length).toBeGreaterThan(0); // the scan read the real module, not an empty string
    expect(src).not.toMatch(/\.unref\s*\(/);
    expect(src).not.toMatch(/detached\s*:/);
    expect(src).not.toMatch(/\bsetImmediate\s*\(/);
  });

  it('exports exactly the four names — none of them hands back a pollable handle', async () => {
    const mod = await import('../judge-panel.mjs');
    expect(Object.keys(mod).sort()).toEqual(['assertPanelBudget', 'assertPanelDepth', 'judgePanel', 'panelSeats']);
  });
});

describe('PARTIAL FAILURE — a rejecting juror is a reported seat, never an orphaning (#3050 acceptance 5)', () => {
  it('reports the failed seat and STILL returns the rest, with the juror\'s own error text', async () => {
    const spy = panelSpawn((sid, i) => (i === 1
      ? { stdout: JSON.stringify({ is_error: true, result: 'Not logged in · Please run /login' }), code: 1, delayMs: 0 }
      : { stdout: okJson(sid), delayMs: 10 }));
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });

    expect(panel.jurors).toHaveLength(4);
    expect(panel.ok).toBe(false);
    expect(panel.failedCount).toBe(1);

    const failed = panel.jurors[1];
    expect(failed.ok).toBe(false);
    expect(failed.lens).toBe('security');
    expect(failed.value).toBeNull();
    expect(failed.error).toContain('Not logged in · Please run /login');
    // Still a NAMED seat: which juror failed is recorded, not merely that one did.
    expect(failed.sessionId).toBe(deriveSessionId(sessionSeed(['run-3050', 'security#1'])));

    for (const ok of [panel.jurors[0], panel.jurors[2], panel.jurors[3]]) {
      expect(ok.ok).toBe(true);
      expect(ok.error).toBeNull();
      expect(ok.value).toEqual({ verdict: 'accept', findings: [] });
    }
  });

  it('does not throw even when EVERY seat fails — reducing a dead panel is the caller\'s call, not this module\'s', async () => {
    const spy = panelSpawn(() => ({ stdout: 'not json at all', code: 1 }));
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(panel.failedCount).toBe(4);
    expect(panel.ok).toBe(false);
    expect(panel.jurors.every((j) => j.error?.includes('parseable JSON'))).toBe(true);
  });

  it('a seat whose binary will not start fails alone', async () => {
    let n = 0;
    const spy = panelSpawn();
    const fn = (cli, argv, opts) => {
      n += 1;
      if (n === 2) throw new Error('ENOENT');
      return spy.fn(cli, argv, opts);
    };
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: fn });
    expect(panel.failedCount).toBe(1);
    expect(panel.jurors[1].error).toMatch(/could not start `claude`/);
    expect(panel.jurors.filter((j) => j.ok)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('REFUSAL 4 — the argv denylist, per seat, before any child starts (#3050 acceptance 6)', () => {
  it('refuses a `--bare` juror inside a panel exactly as it is alone — and spawns NOTHING', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({
      ...BASE,
      jurors: [{ lens: 'correctness' }, { lens: 'security', model: '--bare' }, { lens: 'simplicity' }],
      spawnFn: fn,
    })).rejects.toThrow(/refusing to spawn with --bare/);
    // The refusal is stronger inside a panel than outside it: the poisoned seat's SIBLINGS do not bill either.
    expect(seen.count).toBe(0);
  });

  it('surfaces any malformed seat before the first spawn, naming the seat', async () => {
    const { fn, seen } = forbiddenSpawn();
    await expect(judgePanel({
      ...BASE,
      jurors: [{ lens: 'correctness' }, { lens: 'security', effort: 'extreme' }],
      spawnFn: fn,
    })).rejects.toThrow(/seat `security#1` cannot be made well-formed.*effort/s);
    expect(seen.count).toBe(0);
  });

  it('refuses a seat with nothing to judge rather than spawning its siblings', async () => {
    const { fn, seen } = forbiddenSpawn();
    const { input, ...noInput } = BASE;
    expect(input).toBe('THE-DIFF-SENTINEL');
    await expect(judgePanel({
      ...noInput,
      jurors: [{ lens: 'correctness', input: 'a diff' }, { lens: 'security' }],
      spawnFn: fn,
    })).rejects.toThrow(/seat `security#1` has no `input`/);
    expect(seen.count).toBe(0);
  });
});

describe('NO NEW ROUTE FROM CALLER INPUT TO A CHILD\'S ARGV (#3056 is captured, not widened)', () => {
  it('funnels runId, lens, slot and id through deriveSessionId — none of that text reaches argv', async () => {
    const spy = panelSpawn();
    await judgePanel({
      ...BASE,
      runId: 'ARGV-SENTINEL-RUN --dangerously-skip-permissions',
      jurors: [
        { lens: 'ARGV-SENTINEL-LENS --add-dir /' },
        { lens: 'ok', id: 'ARGV-SENTINEL-ID --settings /etc/passwd' },
      ],
      spawnFn: spy.fn,
    });
    for (const c of spy.calls) {
      expect(c.argv.join(' ')).not.toContain('ARGV-SENTINEL');
      expect(c.argv).not.toContain('--dangerously-skip-permissions');
      expect(c.argv).not.toContain('--add-dir');
      expect(c.argv).not.toContain('--settings');
      // What DID land is a canonical UUID and nothing else derived from those strings.
      expect(c.argv[c.argv.indexOf('--session-id') + 1]).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    }
  });

  it('never puts depth, maxDepth or maxTotalBudgetUsd in argv in any form', async () => {
    const spy = panelSpawn();
    await judgePanel({
      ...BASE,
      depth: 3,
      maxDepth: 987654,
      maxTotalBudgetUsd: 123456,
      jurors: [{ lens: 'correctness' }],
      spawnFn: spy.fn,
    });
    const argv = spy.calls[0].argv.join(' ');
    expect(argv).not.toContain('987654');
    expect(argv).not.toContain('123456');
    expect(argv).not.toContain('--max-depth');
  });

  it('forwards cwd, env, cli and timeoutMs to every child as SPAWN options, not as flags', async () => {
    const spy = panelSpawn();
    await judgePanel({
      ...BASE,
      jurors: [{ lens: 'correctness' }, { lens: 'security' }],
      cwd: '/tmp/juror',
      env: { A: '1' },
      cli: 'claude',
      spawnFn: spy.fn,
    });
    for (const c of spy.calls) {
      expect(c.cli).toBe('claude');
      expect(c.opts.cwd).toBe('/tmp/juror');
      expect(c.opts.env).toEqual({ A: '1' });
      expect(c.argv).not.toContain('/tmp/juror');
    }
  });
});

describe('judgePanel does not re-derive what jury-core already owns (#3050 "Not in scope")', () => {
  it('returns the jurors\' results and NO panel verdict — the reduction stays in jury-core', async () => {
    const spy = panelSpawn();
    const panel = await judgePanel({ ...BASE, jurors: FOUR_SEATS, spawnFn: spy.fn });
    expect(panel).not.toHaveProperty('verdict');
    expect(panel).not.toHaveProperty('findings');
    expect(panel).not.toHaveProperty('aggregation');
    expect(Object.keys(panel).sort()).toEqual([
      'depth', 'failedCount', 'jurors', 'maxDepth', 'maxTotalBudgetUsd', 'ok', 'runId',
      'totalBudgetUsd', 'totalCostUsd', 'wallMs',
    ]);
  });
});
