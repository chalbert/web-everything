/**
 * @file scripts/readiness/__tests__/engine.test.mjs
 * @description Demo-first proof of the deterministic readiness engine (#250).
 *
 * Runs the pure {@link computeReadiness} / {@link spliceStaleEdges} against IN-MEMORY item fixtures
 * (the shape the shared loader in `src/_data/backlog.js` produces — `tier`/`blockers` already
 * derived per #248/#249), so we exercise the cascade + normalization + splice without touching the
 * live backlog. The three acceptance criteria map straight onto these tests:
 *   - cascade: resolving an item lists every dependent that became Tier A;
 *   - hygiene: only structured fields are touched, bodies and Tier C items are left alone;
 *   - determinism: same state → identical output every run.
 */
import { describe, it, expect } from 'vitest';
import { computeReadiness, computeSelection, computeBatchPack, buildReadinessReport, spliceStaleEdges } from '../engine.mjs';
import { toSarif, toJUnit } from '../../../blocks/adapters/report/exportReport';

/**
 * Build a loader-shaped item, resolving `blockedBy` into the lightweight `blockers` the real loader
 * attaches, and deriving the same `tier`. Lets a fixture say "this is blocked by these (status)".
 */
function makeItems(specs) {
  const byNum = new Map(specs.map((s) => [String(s.num), s]));
  return specs.map((s) => {
    const blockers = (s.blockedBy ?? []).map((n) => {
      const b = byNum.get(String(n));
      return { id: `${n}-x`, num: String(n), slug: 'x', title: `#${n}`, status: b ? b.status : 'open' };
    });
    const tier = s.status !== 'open' ? undefined
      : ((s.type === 'issue' || s.type === 'idea') && blockers.every((b) => b.status === 'resolved')) ? 'A'
      : s.type === 'decision' ? 'B' : 'C';
    // Mirror the loader's #254 derivations so computeSelection consumes the same fields it would in prod.
    const batchable = tier === 'A'
      && (s.workItem === 'task' || (s.workItem === 'story' && typeof s.size === 'number' && s.size <= 8));
    const batchCost = s.workItem === 'task' ? 2 : typeof s.size === 'number' ? s.size : undefined;
    return {
      id: `${s.num}-${s.slug ?? 'slug'}`, num: String(s.num), slug: s.slug ?? 'slug',
      title: s.title ?? `#${s.num}`,
      type: s.type, status: s.status, workItem: s.workItem, size: s.size,
      epicState: s.epicState,
      dateStarted: s.dateStarted, blockedBy: s.blockedBy, blockers, tier,
      batchable, batchCost, leverageScore: s.leverageScore ?? 0,
      directUnblocks: s.directUnblocks ?? 0, transitiveUnblocks: s.transitiveUnblocks ?? 0,
      unblocksToReady: s.unblocksToReady ?? 0,
      locus: s.locus, locusAuthored: s.locusAuthored,
    };
  });
}

describe('cascade re-evaluation (#250)', () => {
  it('lists every dependent that became Tier A once its prerequisites resolved', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'resolved' },
      { num: 2, type: 'idea', status: 'resolved' },
      { num: 10, type: 'idea', status: 'open', blockedBy: [1, 2] },   // both resolved → now ready
      { num: 11, type: 'issue', status: 'open', blockedBy: [1] },     // resolved → now ready
    ]);
    const { cascade } = computeReadiness(items);
    expect(cascade.nowReady.map((r) => r.num)).toEqual(['10', '11']);
    expect(cascade.nowReady[0].clearedBlockers).toEqual(['1', '2']);
    expect(cascade.stillBlocked).toEqual([]);
  });

  it('reports still-blocked items with their open blockers, and never as nowReady', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'resolved' },
      { num: 2, type: 'idea', status: 'open' },                        // NOT resolved
      { num: 10, type: 'idea', status: 'open', blockedBy: [1, 2] },    // one open → still blocked
    ]);
    const { cascade } = computeReadiness(items);
    expect(cascade.nowReady).toEqual([]);
    expect(cascade.stillBlocked).toHaveLength(1);
    expect(cascade.stillBlocked[0].openBlockers).toEqual([{ num: '2', status: 'open' }]);
  });

  it('excludes items that never had a prerequisite — a cascade is a freshly-cleared edge, not just Tier A', () => {
    const items = makeItems([{ num: 10, type: 'idea', status: 'open' }]); // tier A, but no blockers
    const { cascade } = computeReadiness(items);
    expect(cascade.nowReady).toEqual([]);
  });
});

describe('structural normalization (#250)', () => {
  it('flags stale (resolved) blockedBy edges as the one auto-applicable class', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'resolved' },
      { num: 10, type: 'idea', status: 'active', blockedBy: [1], dateStarted: '2026-06-09' },
    ]);
    const { normalization } = computeReadiness(items);
    const stale = normalization.find((n) => n.kind === 'stale-edge');
    expect(stale).toMatchObject({ id: '10-slug', applicable: true, staleBlockers: ['1'] });
  });

  it('flags an active item with no dateStarted (flag-only, never auto-filled)', () => {
    const items = makeItems([{ num: 10, type: 'idea', status: 'active' }]); // no dateStarted
    const f = computeReadiness(items).normalization.find((n) => n.kind === 'missing-date-started');
    expect(f).toMatchObject({ applicable: false });
  });

  it('flags a story with no size (flag-only), but not an unsized epic', () => {
    const items = makeItems([
      { num: 10, type: 'idea', status: 'open', workItem: 'story' },     // no size → flagged
      { num: 11, type: 'idea', status: 'open', workItem: 'epic' },      // epic, no size → NOT flagged
    ]);
    const sizes = computeReadiness(items).normalization.filter((n) => n.kind === 'missing-size');
    expect(sizes.map((n) => n.id)).toEqual(['10-slug']);
  });

  it('leaves Tier C decision/review items untouched (no cascade, no edge churn)', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'resolved' },
      { num: 10, type: 'decision', status: 'open', blockedBy: [1] },   // resolved edge, but a decision
      { num: 11, type: 'review', status: 'open' },
    ]);
    const { cascade, normalization } = computeReadiness(items);
    expect(cascade.nowReady).toEqual([]);          // decisions are never "agent-ready" via cascade
    expect(cascade.stillBlocked).toEqual([]);
    // A stale edge on a decision is still pure field hygiene (it is a structured field, not body prose),
    // so it is reported — but the decision is never promoted or its prose touched.
    expect(normalization.find((n) => n.id === '10-slug' && n.kind === 'stale-edge')).toBeTruthy();
  });
});

describe('selection view (#254 projection) — the skills consume this, never re-derive', () => {
  it('counts and lists open items by tier, with the batchable subset of Tier A', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'open', workItem: 'story', size: 3 },   // batchable Tier A
      { num: 2, type: 'issue', status: 'open', workItem: 'task' },            // batchable Tier A
      { num: 3, type: 'idea', status: 'open', workItem: 'story', size: 13 },  // Tier A, NOT batchable (>8)
      { num: 4, type: 'decision', status: 'open', workItem: 'story', size: 2 }, // Tier B
      { num: 5, type: 'review', status: 'open', workItem: 'story', size: 3 },  // Tier C
      { num: 6, type: 'idea', status: 'resolved', workItem: 'story', size: 1 },// dropped (not open)
    ]);
    const sel = computeSelection(items);
    expect(sel.counts).toEqual({ open: 5, tierA: 3, agentReady: 3, sliceable: 0, epicActionable: 0, tierB: 1, tierBPrepared: 0, tierC: 1, batchable: 2, inFlight: 0 });
    expect(sel.batchable.map((i) => i.num).sort()).toEqual(['1', '2']);
    expect(sel.tierA.every((i) => i.tier === 'A')).toBe(true);
    expect(sel.tierB.map((i) => i.num)).toEqual(['4']);
  });

  it('splits a Tier-A epic into the sliceable bucket — unblocked but not buildable, never agent-ready', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'open', workItem: 'story', size: 3 },   // batchable agent-ready
      { num: 2, type: 'idea', status: 'open', workItem: 'epic', size: 5 },    // Tier A but a container → sliceable
      { num: 3, type: 'idea', status: 'open', workItem: 'epic' },             // unsized epic → sliceable too
    ]);
    const sel = computeSelection(items);
    expect(sel.counts.tierA).toBe(3);          // all three clear prerequisites
    expect(sel.counts.agentReady).toBe(1);     // only the buildable story
    expect(sel.counts.sliceable).toBe(2);      // both epics
    expect(sel.sliceable.map((i) => i.num).sort()).toEqual(['2', '3']);
    expect(sel.batchable.some((i) => i.workItem === 'epic')).toBe(false);  // an epic is never batchable
  });

  it('counts only actionable epics (unsliced / all-children-done) — not tracking, and not parked', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'open', workItem: 'epic', epicState: 'unsliced' }, // → /slice
      { num: 2, type: 'idea', status: 'open', workItem: 'epic', epicState: 'done' },     // → resolve
      { num: 3, type: 'idea', status: 'open', workItem: 'epic', epicState: 'tracking' }, // open children, no action
      { num: 4, type: 'idea', status: 'open', workItem: 'epic', epicState: 'tracking' }, // open children, no action
      { num: 5, type: 'idea', status: 'open', workItem: 'epic', epicState: 'parked' },   // childlessReason gates it → no action
    ]);
    const sel = computeSelection(items);
    expect(sel.counts.sliceable).toBe(5);       // all five epics are Tier-A
    expect(sel.counts.epicActionable).toBe(2);  // only the unsliced + the all-done one — parked is NOT actionable
  });

  it('reports batch-shaped active items as in flight (#083 legible-stop), excluding non-batch-shaped', () => {
    const items = makeItems([
      { num: 1, type: 'idea', status: 'active', workItem: 'task', dateStarted: '2026-06-13' },        // in flight (task)
      { num: 2, type: 'idea', status: 'active', workItem: 'story', size: 5, dateStarted: '2026-06-13' }, // in flight (story·≤8)
      { num: 3, type: 'idea', status: 'active', workItem: 'story', size: 13, dateStarted: '2026-06-13' },// active but NOT batch-shaped (>8)
      { num: 4, type: 'idea', status: 'open', workItem: 'task' },                                       // open, not in flight
    ]);
    const sel = computeSelection(items);
    expect(sel.counts.inFlight).toBe(2);
    expect(sel.inFlight.map((i) => i.num).sort()).toEqual(['1', '2']);
  });

  it('ranks by leverage desc, then issue-before-idea, then smaller-first, then NNN', () => {
    const items = makeItems([
      { num: 10, type: 'idea', status: 'open', workItem: 'story', size: 3, leverageScore: 0 },
      { num: 11, type: 'idea', status: 'open', workItem: 'story', size: 3, leverageScore: 2000 }, // highest leverage → first
      { num: 12, type: 'issue', status: 'open', workItem: 'task', leverageScore: 0 },  // issue before idea at equal leverage
      { num: 13, type: 'idea', status: 'open', workItem: 'story', size: 1, leverageScore: 0 }, // smaller story before #10
    ]);
    const sel = computeSelection(items);
    expect(sel.tierA.map((i) => i.num)).toEqual(['11', '12', '13', '10']);
  });

  it('is a pure projection — every field comes from the loader, none recomputed', () => {
    const items = makeItems([{ num: 1, type: 'idea', status: 'open', workItem: 'story', size: 3, leverageScore: 1001, unblocksToReady: 1, transitiveUnblocks: 1 }]);
    const [it] = computeSelection(items).tierA;
    expect(it).toMatchObject({ num: '1', tier: 'A', batchable: true, leverageScore: 1001, unblocksToReady: 1, transitiveUnblocks: 1 });
  });
});

describe('computeBatchPack — points budget, not a count cap', () => {
  // size·5 joins when it fits; a task weighs 2 (no burndown points, but real context cost).
  const ranked = (extra = {}) => computeSelection(makeItems([
    { num: 1, type: 'issue', status: 'open', workItem: 'story', size: 3, leverageScore: 5000 },
    { num: 2, type: 'idea', status: 'open', workItem: 'story', size: 5, leverageScore: 4000 },
    { num: 3, type: 'idea', status: 'open', workItem: 'task', leverageScore: 3000 },
    { num: 4, type: 'idea', status: 'open', workItem: 'story', size: 2, leverageScore: 2000 },
    { num: 5, type: 'idea', status: 'open', workItem: 'story', size: 13, leverageScore: 1000 }, // ≥13 → never eligible
    ...(extra.items ?? []),
  ])).tierA;

  it('packs as many points as possible, including a size·5 when it fits the budget', () => {
    // budget 10: #1(3)→3, #2(size5)→8, #3 task(2)→10 fits exactly, #4(size2) would be 12 > 10, skip.
    const { picked, spent } = computeBatchPack(ranked(), 10);
    expect(picked.map((i) => i.num)).toEqual(['1', '2', '3']);
    expect(spent).toBe(10);
  });

  it('skips a too-big item but keeps packing smaller, lower-ranked ones (max points, not first-fit-stop)', () => {
    const { picked, spent } = computeBatchPack(ranked(), 6);
    // budget 6: #1(3) fits → 3; #2(size5) would be 8 > 6, skip; #3 task(2) → 5; #4(size2) would be 7 > 6, skip
    expect(picked.map((i) => i.num)).toEqual(['1', '3']);
    expect(spent).toBe(5);
  });

  it('never packs a story·13 (split-candidate) even with budget to spare', () => {
    const { picked } = computeBatchPack(ranked(), 999);
    expect(picked.map((i) => i.num)).not.toContain('5');
    expect(picked.map((i) => i.num)).toEqual(['1', '2', '3', '4']); // 3+5+2+2 = 12, all eligible
  });

  describe('cross-locus pack — locus-agnostic (#498/#500); each item gated in its own locus at close-out', () => {
    const mixed = () => computeSelection(makeItems([
      { num: 1, type: 'issue', status: 'open', workItem: 'story', size: 3, leverageScore: 5000 }, // no locus → webeverything
      { num: 2, type: 'idea', status: 'open', workItem: 'story', size: 3, leverageScore: 4000, locus: 'plateau-app', locusAuthored: true },
      { num: 3, type: 'idea', status: 'open', workItem: 'story', size: 2, leverageScore: 3000, locus: 'frontierui', locusAuthored: false }, // inferred
      { num: 4, type: 'idea', status: 'open', workItem: 'task', leverageScore: 2000 }, // webeverything
    ])).tierA;

    it('packs batchable items of every locus together — no item held out for locus', () => {
      const { picked } = computeBatchPack(mixed(), 999);
      // budget to spare → all four eligible items pack regardless of locus, in rank order.
      expect(picked.map((i) => i.num)).toEqual(['1', '2', '3', '4']);
    });

    it('each packed item carries its own locus (the gate home the loop closes it with)', () => {
      const { picked } = computeBatchPack(mixed(), 999);
      const byNum = Object.fromEntries(picked.map((i) => [i.num, i.locus ?? 'webeverything']));
      expect(byNum).toEqual({ 1: 'webeverything', 2: 'plateau-app', 3: 'frontierui', 4: 'webeverything' });
    });

    it('no longer returns an otherLocus bucket (the single-locus filter is gone)', () => {
      expect(computeBatchPack(mixed(), 999)).not.toHaveProperty('otherLocus');
    });
  });
});

describe('buildReadinessReport — the #431 report-model view (slice B of #435; #710)', () => {
  const fixture = () => {
    const sel = computeSelection(makeItems([
      { num: 1, type: 'issue', status: 'open', workItem: 'story', size: 3, leverageScore: 5000 },
      { num: 2, type: 'idea', status: 'open', workItem: 'story', size: 5, leverageScore: 4000, locus: 'frontierui', locusAuthored: true },
      { num: 3, type: 'idea', status: 'open', workItem: 'task', leverageScore: 3000 },
    ]));
    const pack = computeBatchPack(sel.tierA, 10);
    return { report: buildReadinessReport(sel, pack, 10), sel, pack };
  };

  it('emits one selector source and two scores-only sections (a ranking, not a conformance pass)', () => {
    const { report } = fixture();
    expect(report.id).toBe('check-readiness');
    expect(report.sources).toEqual([{ id: 'check-readiness', name: 'check:readiness', kind: 'selector' }]);
    expect(report.sections.map((s) => s.id)).toEqual(['ranked-selection', 'batch-pack']);
    // No findings anywhere — readiness ranks, it doesn't flag conformance.
    for (const s of report.sections) expect(s.findings).toBeUndefined();
  });

  it('ranked-selection scores carry every Tier-A item with leverageScore as the value', () => {
    const { report, sel } = fixture();
    const ranked = report.sections.find((s) => s.id === 'ranked-selection');
    expect(ranked.scores).toHaveLength(sel.tierA.length);
    expect(ranked.scores[0]).toMatchObject({ id: 'tierA/1', value: 5000, unit: 'leverage' });
  });

  it('batch-pack scores carry each packed item with batchCost (value) against the budget (max)', () => {
    const { report, pack } = fixture();
    const packSec = report.sections.find((s) => s.id === 'batch-pack');
    expect(packSec.scores).toHaveLength(pack.picked.length);
    expect(packSec.scores.every((sc) => sc.max === 10 && sc.unit === 'pts')).toBe(true);
    expect(packSec.scores.find((sc) => sc.id === 'pack/2').label).toContain('(frontierui)');
  });

  it('is model-valid: pipes unchanged through the #434 SARIF/JUnit export adapters', () => {
    // Readiness emits a scores-only report (no findings — it ranks, it doesn't flag), so the
    // findings-table renderer isn't the applicable view; the export adapters are the cross-cutting
    // proof it's a well-formed #431 Report (one SARIF run per declared source, model-valid JUnit).
    const { report } = fixture();
    const sarif = toSarif(report);
    expect(sarif.runs).toHaveLength(report.sources.length);
    expect(() => toJUnit(report)).not.toThrow();
  });
});

describe('determinism (#250)', () => {
  it('produces byte-identical output regardless of input order', () => {
    const a = makeItems([
      { num: 2, type: 'idea', status: 'resolved' },
      { num: 30, type: 'idea', status: 'open', blockedBy: [2] },
      { num: 10, type: 'idea', status: 'open', workItem: 'story' },
    ]);
    const b = [a[2], a[0], a[1]]; // shuffled
    expect(JSON.stringify(computeReadiness(a))).toEqual(JSON.stringify(computeReadiness(b)));
    expect(JSON.stringify(computeSelection(a))).toEqual(JSON.stringify(computeSelection(b)));
  });
});

describe('spliceStaleEdges — frontmatter-only, body never touched (#250)', () => {
  const FILE = [
    '---',
    'type: idea',
    'status: active',
    'blockedBy: ["248", "249"]',
    'tags: [backlog]',
    '---',
    '',
    '# Title',
    '',
    'Body prose that mentions ["248"] and must never change.',
    '',
  ].join('\n');

  it('drops a subset of resolved edges, keeping the still-open ones', () => {
    const out = spliceStaleEdges(FILE, ['248']);
    expect(out).toContain('blockedBy: ["249"]');
    expect(out).toContain('Body prose that mentions ["248"] and must never change.');
  });

  it('removes the whole blockedBy line when every edge is stale', () => {
    const out = spliceStaleEdges(FILE, ['248', '249']);
    expect(out).not.toMatch(/^blockedBy:/m);
    expect(out).toContain('tags: [backlog]');           // sibling field intact
    expect(out).toContain('# Title');                   // body intact
    expect(out).toContain('Body prose that mentions ["248"]');
  });

  it('returns null (gives up safely) when there is nothing to drop', () => {
    expect(spliceStaleEdges(FILE, ['999'])).toBeNull();
  });

  it('returns null when blockedBy is block-style (not a flow array) rather than guessing', () => {
    const blockStyle = '---\ntype: idea\nblockedBy:\n  - "248"\n---\n# T\n';
    expect(spliceStaleEdges(blockStyle, ['248'])).toBeNull();
  });
});
