/**
 * @file priority-sync.test.mjs — the `priority-sync` operation's pure planner and its declaration (epic #3383).
 *
 * TABLE TESTS over fixtures for every rule the planner owns: drop, add (by band, by rule 3, by `blockedBy`), the
 * claimed list, the off-path list, `pinned by operator`, the delegation section, renumbering, the `Updated:` line,
 * the unwritten-why marker, and the landed-but-open flag. The real mechanism (a real git repo, the real command
 * line, then the real `check-priority` gate) is `priority-sync-real.test.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRIORITY_SYNC_EFFECT, PRIORITY_SYNC_OP, UNWRITTEN_WHY, bandOf, extractSectionText, finishPriorityOutcome, parseSection,
  planPrioritySync, prioritySyncOperation, renderPlan, replaceSectionText, shapePriorityRead, sizeLabel,
} from '../priority-sync.mjs';
import {
  createPrioritySyncSinks, hasDesignSignal, landedFromLog, mergeRaw,
} from '../priority-sync-io.mjs';
import { checkPriorityOrder, liveTree, parsePriorityOrder } from '../../lib/priority-order.mjs';
import { findTrackerPath } from '../../lib/prototype-tracker-data.mjs';
import { createRegistry } from '../registry.mjs';
import { runOperationCli } from '../cli-adapter.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { importGraph } from './import-graph.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────

const card = (id, o = {}) => ({
  id, parent: '3383', status: 'open', blockedBy: [], kind: 'story', size: '3', tier: 'A', leverage: 0,
  humanGated: false, designFirst: false, bornAs: null, ...o,
});

const UPDATED = 'Updated: 2026-09-20 by someone — the old reason. Derived by the rules below from the ranker. Whoever files a card updates this section; `check-priority` fails on drift.';

/** A section with every block the real one has. Each block takes its lines; the rules and prose stay fixed. */
function section({ health = [], delegation = [], A = [], B = [], C = [], claimed = [], offpath = [], updated = UPDATED } = {}) {
  const blank = (arr) => (arr.length ? ['', ...arr, ''] : ['']);
  return [
    '## Priority order', '',
    updated, '',
    '**Scope.** Every open card under #3383. See #3999 in prose.', '',
    '**Rules — re-apply exactly as written.**', '',
    '0. **The mechanised system first.** Prose that cites #3998 is not an entry.',
    '1. **Dependencies first.** A card never precedes a card in its `blockedBy`.', '',
    '**Health chain (rule 1) — before every band**', ...blank(health),
    '**Delegation to Codex and Antigravity (operator priority) — before band A**', ...blank(delegation),
    '**Band A — dispatchable now**', ...blank(A),
    '**Band B — design first (uncleared)**', ...blank(B),
    '**Band C — needs an operator ruling**', ...blank(C),
    '**Claimed (`status: active`) — listed, not ordered**', ...blank(claimed),
    '**Owed, no card yet — not ordered** (from this card\'s own notes).', '',
    '- Graduate something first and alone.', '',
    '**Off-path, not ordered — not #3383 cards.** Listed so nothing is silently dropped.', ...blank(offpath),
    '- off-path: the operator clearing list is not a priority list.',
    '',
  ].join('\n');
}

const asRead = (text, cards, extra = {}) => ({
  trackerPath: '/x/backlog/3383-tracker.md',
  sectionText: text,
  cards,
  live: [...liveTree(new Map(cards.map((c) => [c.id, c])))],
  landed: {},
  today: '2026-09-21',
  ranker: 'loader',
  ...extra,
});

const plan = (text, cards, extra) => planPrioritySync(asRead(text, cards, extra));

/** The numbered entry lines of a planned section, in order. */
const orderedLines = (p) => p.newSection.split('\n').filter((l) => /^\d+\. #/.test(l));
const ids = (lines) => lines.map((l) => /#([0-9a-z]+)/.exec(l)[1]);
const claimedLines = (p) => p.newSection.split('\n').filter((l) => /^- #/.test(l));
const offPathLines = (p) => p.newSection.split('\n').filter((l) => /^- off-path #/.test(l));
const blockOf = (p, id) => parseSection(p.newSection).lines.find((l) => l.id === id)?.block;

// A base list every case starts from: a health line, a delegation line, one A, B, C line and one claimed line.
const BASE = {
  health: ['1. #3768 · 5 · B · Clears: health.'],
  delegation: ['2. #3696 · 5 · A · operator-added · Clears: delegation.'],
  A: ['3. #3600 · 3 · A · Clears: a.'],
  B: ['4. #3601 · 3 · B · Clears: b.'],
  C: ['5. #3602 · decision · C · Clears: c.'],
  claimed: ['- #3443 · epic · claimed · z'],
};
const BASE_CARDS = [
  card('3768'), card('3696', { parent: '3369' }), card('3600'), card('3601', { designFirst: true }),
  card('3602', { kind: 'decision', tier: 'B' }), card('3443', { status: 'active', kind: 'epic', tier: null }),
];

describe('the section parser', () => {
  it('reads entry lines and tags each with its block; prose mentions are not entries', () => {
    const p = parseSection(section(BASE));
    const entries = p.lines.filter((l) => l.id).map((l) => [l.id, l.type, l.block]);
    expect(entries).toEqual([
      ['3768', 'ordered', 'health'], ['3696', 'ordered', 'delegation'], ['3600', 'ordered', 'A'],
      ['3601', 'ordered', 'B'], ['3602', 'ordered', 'C'], ['3443', 'claimed', 'claimed'],
    ]);
  });

  it('agrees with the gate\'s own parser on which lines are entries (fixture and off-path list)', () => {
    const text = section({ ...BASE, offpath: ['- off-path #3735 · decision · parent #3054: why.'] });
    const gate = parsePriorityOrder(text).entries.map((e) => [e.id, e.kind]);
    const mine = parseSection(text).lines.filter((l) => l.type === 'ordered' || l.type === 'claimed').map((l) => [l.id, l.type]);
    expect(mine).toEqual(gate);
  });

  it('agrees with the gate\'s own parser over the REAL tracker card of this checkout', () => {
    const path = findTrackerPath({ backlogDir: resolve(HERE, '..', '..', '..', 'backlog') });
    const text = readFileSync(path, 'utf8');
    const gate = parsePriorityOrder(text).entries.map((e) => [e.id, e.kind]);
    const mine = parseSection(text).lines.filter((l) => l.type === 'ordered' || l.type === 'claimed').map((l) => [l.id, l.type]);
    expect(gate.length).toBeGreaterThan(100);
    expect(mine).toEqual(gate);
  });

  it('reads the markers of a line and keeps the prose apart', () => {
    const [l] = parseSection(section({ delegation: ['2. #3696 · 5 · A · operator-added · pinned by operator · Clears: a · b.'] })).lines.filter((x) => x.id);
    expect(l).toMatchObject({ size: '5', band: 'A', marks: ['operator-added', 'pinned by operator'], why: 'Clears: a · b.' });
  });

  it('round-trips the section text through extract and replace', () => {
    const tracker = `# T\n\n${section(BASE)}\n## Session update (2026-09-20) — later\n\nbody\n`;
    const sec = extractSectionText(tracker);
    expect(replaceSectionText(tracker, sec)).toBe(tracker);
    expect(replaceSectionText(tracker, `${sec}\nextra`)).toContain('extra');
  });
});

describe('band, size and the loader tier', () => {
  it('bands by the card\'s own fields', () => {
    expect(bandOf(card('1', { kind: 'decision', tier: 'B' }))).toBe('C');
    expect(bandOf(card('1', { kind: 'decision', tier: 'C' }))).toBe('C');
    expect(bandOf(card('1', { humanGated: true, tier: 'C' }))).toBe('C');
    expect(bandOf(card('1', { kind: 'epic' }))).toBe('B');
    expect(bandOf(card('1', { designFirst: true }))).toBe('B');
    expect(bandOf(card('1'))).toBe('A');
    expect(bandOf(card('1', { tier: 'C' }))).toBe('A'); // a blocked build is loader tier C, section band A
  });

  it('labels the size the way the lines do', () => {
    expect(['epic', 'decision', 'task', 5].map((k, i) => sizeLabel(card('1', i < 3 ? { kind: k } : { size: k })))).toEqual(['epic', 'decision', 'task', '5']);
  });

  it('spots a design signal in a card body', () => {
    expect(hasDesignSignal('x. DESIGN TO SETTLE: why. ACCEPTANCE: y')).toBe(true);
    expect(hasDesignSignal('## Open fork -- flagged\n')).toBe(true);
    expect(hasDesignSignal('there is no open fork here, design settled')).toBe(false);
  });
});

describe('rule 1: drop', () => {
  const cards = [...BASE_CARDS, card('3500', { status: 'resolved' }), card('3501', { status: 'preparing' })];

  it('drops the line of a resolved card and reports it', () => {
    const p = plan(section({ ...BASE, A: [...BASE.A, '4. #3500 · 2 · A · Clears: gone.'] }), cards);
    expect(ids(orderedLines(p))).not.toContain('3500');
    expect(p.dropped).toEqual([{ id: '3500', line: '4. #3500 · 2 · A · Clears: gone.', reason: 'resolved' }]);
    expect(p.counts.dropped).toBe(1);
  });

  it('drops any card that is no longer live, naming the status', () => {
    const p = plan(section({ ...BASE, B: [...BASE.B, '5. #3501 · 2 · B · Clears: paused.'] }), cards);
    expect(p.dropped.map((d) => [d.id, d.reason])).toEqual([['3501', 'status preparing']]);
  });

  it('drops a resolved card out of the delegation section too (the marker goes with the line)', () => {
    const p = plan(section({ ...BASE, delegation: [...BASE.delegation, '3. #3500 · 5 · A · operator-added · Clears: done.'] }), cards);
    expect(ids(orderedLines(p))).not.toContain('3500');
    expect(p.dropped.map((d) => d.id)).toEqual(['3500']);
  });

  it('drops a resolved card from the off-path list as well', () => {
    const p = plan(section({ ...BASE, offpath: ['- off-path #3500 · 3 · parent #9: gone.'] }), cards);
    expect(p.dropped.map((d) => d.id)).toEqual(['3500']);
    expect(offPathLines(p)).toEqual([]);
  });
});

describe('rule 2: add, by band', () => {
  const cards = [
    ...BASE_CARDS,
    card('3700'), // A
    card('3701', { designFirst: true }), // B: states a design to settle
    card('3702', { kind: 'epic', size: null }), // B: epic
    card('3703', { kind: 'decision', tier: 'B', size: null }), // C: decision
    card('3704', { humanGated: true, tier: 'C' }), // C: human gate
  ];

  it('puts each new card in the band its own fields give, after that band\'s last line', () => {
    const p = plan(section(BASE), cards);
    const bands = Object.fromEntries(p.added.map((a) => [a.id, a.band]));
    expect(bands).toEqual({ 3700: 'A', 3701: 'B', 3702: 'B', 3703: 'C', 3704: 'C' });
    expect(ids(orderedLines(p))).toEqual(['3768', '3696', '3600', '3700', '3601', '3701', '3702', '3602', '3704', '3703']); // in band C the sized card sorts before the decision
    expect(blockOf(p, '3700')).toBe('A');
    expect(blockOf(p, '3703')).toBe('C');
  });

  it('gives a new line the size word, the band and the unwritten marker, and no prose', () => {
    const p = plan(section(BASE), cards);
    const lines = orderedLines(p);
    expect(lines.find((l) => l.includes('#3702'))).toMatch(/^\d+\. #3702 · epic · B · why: \(unwritten\)$/);
    expect(lines.find((l) => l.includes('#3703'))).toMatch(/^\d+\. #3703 · decision · C · why: \(unwritten\)$/);
    expect(lines.find((l) => l.includes('#3700'))).toMatch(/^\d+\. #3700 · 3 · A · why: \(unwritten\)$/);
    expect(UNWRITTEN_WHY).toBe('why: (unwritten)');
  });

  it('leaves every existing line as it was, but for its number', () => {
    const before = orderedLines(plan(section(BASE), []));
    const p = plan(section(BASE), cards);
    const strip = (l) => l.replace(/^\d+\./, '');
    for (const line of before) expect(orderedLines(p).map(strip)).toContain(strip(line));
  });

  it('never inserts a new card into the health chain or the delegation section', () => {
    const p = plan(section(BASE), cards);
    for (const a of p.added) expect(['health', 'delegation']).not.toContain(blockOf(p, a.id));
  });

  it('adds nothing for a card that already has a line, in any list', () => {
    const p = plan(section({ ...BASE, A: [...BASE.A, '4. #3700 · 3 · A · Clears: listed.'], claimed: ['- #3443 · epic · claimed · z'] }), cards);
    expect(p.added.map((a) => a.id)).not.toContain('3700');
  });

  it('adds a card of an open epic child (its slice) as the live tree does, and none from a resolved parent', () => {
    const p = plan(section(BASE), [...BASE_CARDS, card('3718', { kind: 'epic' }), card('3730', { parent: '3718' }), card('3637', { status: 'resolved' }), card('3638', { parent: '3637' })]);
    expect(p.added.map((a) => a.id).sort()).toEqual(['3718', '3730']);
  });
});

describe('rule 2: order inside a band is the section\'s rule 3', () => {
  const only = (cards) => plan(section(BASE), [...BASE_CARDS, ...cards]);
  const newA = (p) => ids(orderedLines(p)).filter((id) => p.added.some((a) => a.id === id));

  it('leverage descending, then smaller size (task first), then number', () => {
    const p = only([
      card('3710', { size: '5' }), card('3711', { size: '2' }), card('3712', { kind: 'task', size: null }),
      card('3713', { size: '5', leverage: 1001 }), card('3709', { size: '5' }),
    ]);
    expect(newA(p)).toEqual(['3713', '3712', '3711', '3709', '3710']);
  });

  it('puts a card after the new cards that block it, whatever its own rank', () => {
    const p = only([card('3720', { size: '1', blockedBy: ['3721'] }), card('3721', { size: '8' })]);
    expect(newA(p)).toEqual(['3721', '3720']);
  });

  it('sends a card whose blocker is claimed or outside the epic to the end of the band', () => {
    const p = only([
      card('3722', { size: '1', blockedBy: ['3443'] }), // 3443 is claimed
      card('3723', { size: '1', blockedBy: ['3990'] }), // 3990 is open outside the tree
      card('3990', { parent: '3054' }),
      card('3724', { size: '8' }),
    ]);
    expect(newA(p)).toEqual(['3724', '3722', '3723']);
  });

  it('never puts a card in an earlier band than its blocker', () => {
    const p = only([card('3725', { designFirst: true }), card('3726', { blockedBy: ['3725'] })]); // 3726 is band A, blocker is band B
    expect(p.added.find((a) => a.id === '3726').band).toBe('B');
    expect(ids(orderedLines(p)).indexOf('3725')).toBeLessThan(ids(orderedLines(p)).indexOf('3726'));
  });

  it('places a new card just before an existing line it blocks', () => {
    const cards = [...BASE_CARDS.filter((c) => c.id !== '3600'), card('3600', { blockedBy: ['3730'] }), card('3730', { size: '8' })];
    const p = plan(section(BASE), cards);
    const order = ids(orderedLines(p));
    expect(order.indexOf('3730')).toBe(order.indexOf('3600') - 1);
    expect(p.flagged.filter((f) => f.kind === 'blocked-order')).toEqual([]);
    expect(checkPriorityOrder(p.newSection, new Map(cards.map((c) => [c.id, c]))).findings.filter((f) => f.kind === 'blocked-order')).toEqual([]);
  });

  it('flags, and does not fix, a new card that blocks a line of the delegation section', () => {
    const cards = [...BASE_CARDS.filter((c) => c.id !== '3696'), card('3696', { parent: '3369', blockedBy: ['3731'] }), card('3731')];
    const p = plan(section(BASE), cards);
    expect(blockOf(p, '3731')).toBe('A');
    expect(p.flagged.map((f) => f.kind)).toContain('blocked-order');
  });
});

describe('rule 2: claimed and off-path', () => {
  it('puts a new card with status active in the Claimed list, never in the ordered list', () => {
    const p = plan(section(BASE), [...BASE_CARDS, card('3740', { status: 'active', size: '5', tier: null })]);
    expect(claimedLines(p)).toEqual(['- #3443 · epic · claimed · z', `- #3740 · 5 · claimed · ${UNWRITTEN_WHY}`]);
    expect(ids(orderedLines(p))).not.toContain('3740');
    expect(p.added.find((a) => a.id === '3740').band).toBe('claimed');
  });

  it('moves an ordered line whose card is now active to the Claimed list, keeping its prose', () => {
    const p = plan(section(BASE), BASE_CARDS.map((c) => (c.id === '3600' ? { ...c, status: 'active' } : c)));
    expect(ids(orderedLines(p))).not.toContain('3600');
    expect(claimedLines(p)).toContain('- #3600 · 3 · claimed · Clears: a.');
    expect(p.moved).toMatchObject([{ id: '3600', from: 'ordered list', to: 'claimed list' }]);
  });

  it('moves a claimed line whose card is open again back into its band, keeping its prose', () => {
    const p = plan(section(BASE), BASE_CARDS.map((c) => (c.id === '3443' ? { ...c, status: 'open', kind: 'story' } : c)));
    expect(claimedLines(p)).toEqual([]);
    expect(orderedLines(p).find((l) => l.includes('#3443'))).toMatch(/^\d+\. #3443 · epic · A · z$/);
    expect(blockOf(p, '3443')).toBe('A');
  });

  it('moves a line for a card outside the live tree to the Off-path list, unless it is operator-added', () => {
    const cards = [...BASE_CARDS.filter((c) => c.id !== '3600'), card('3600', { parent: '3054' })];
    const p = plan(section(BASE), cards);
    expect(ids(orderedLines(p))).not.toContain('3600');
    expect(offPathLines(p)).toEqual(['- off-path #3600 · 3 · parent #3054: Clears: a.']);
    expect(p.moved).toMatchObject([{ id: '3600', to: 'off-path list' }]);
  });

  it('keeps an out-of-tree line that carries operator-added exactly where it is (the delegation cards are that)', () => {
    const p = plan(section(BASE), BASE_CARDS); // 3696's parent is 3369, outside the #3383 tree
    expect(blockOf(p, '3696')).toBe('delegation');
    expect(orderedLines(p).find((l) => l.includes('#3696'))).toContain('operator-added');
    expect(p.moved).toEqual([]);
  });

  it('keeps an operator-added line in a band when the card is outside the tree', () => {
    const cards = [...BASE_CARDS.filter((c) => c.id !== '3600'), card('3600', { parent: '3054' })];
    const p = plan(section({ ...BASE, A: ['3. #3600 · 3 · A · operator-added · Clears: a.'] }), cards);
    expect(blockOf(p, '3600')).toBe('A');
  });

  it('puts a card back into the live tree when it leaves the off-path list, with an unwritten why', () => {
    const p = plan(section({ ...BASE, offpath: ['- off-path #3750 · 3 · parent #3054: old reason.'] }), [...BASE_CARDS, card('3750')]);
    expect(p.moved).toMatchObject([{ id: '3750', from: 'off-path list' }]);
    expect(orderedLines(p).find((l) => l.includes('#3750'))).toContain(UNWRITTEN_WHY);
    expect(offPathLines(p)).toEqual([]);
  });

  it('leaves the off-path list of a card that is still outside the tree alone', () => {
    const p = plan(section({ ...BASE, offpath: ['- off-path #3735 · decision · parent #3054: why.'] }), [...BASE_CARDS, card('3735', { parent: '3054', kind: 'decision' })]);
    expect(offPathLines(p)).toEqual(['- off-path #3735 · decision · parent #3054: why.']);
    expect(p.changed).toBe(false);
  });
});

describe('rule 3: pinned by operator, and the delegation section', () => {
  const pinnedA = ['3. #3600 · 3 · A · pinned by operator · Clears: a.'];

  it('never drops a pinned line, even for a resolved card, and says so', () => {
    const p = plan(section({ ...BASE, A: pinnedA }), BASE_CARDS.map((c) => (c.id === '3600' ? { ...c, status: 'resolved' } : c)));
    expect(ids(orderedLines(p))).toContain('3600');
    expect(p.dropped).toEqual([]);
    expect(p.flagged.map((f) => f.kind)).toContain('pinned-not-live');
  });

  it('never moves a pinned line to the Claimed or off-path list', () => {
    const active = plan(section({ ...BASE, A: pinnedA }), BASE_CARDS.map((c) => (c.id === '3600' ? { ...c, status: 'active' } : c)));
    expect(blockOf(active, '3600')).toBe('A');
    const away = plan(section({ ...BASE, A: pinnedA }), BASE_CARDS.map((c) => (c.id === '3600' ? { ...c, parent: '3054' } : c)));
    expect(blockOf(away, '3600')).toBe('A');
    expect(away.moved).toEqual([]);
  });

  it('inserts new cards around a pinned line, never before it', () => {
    const p = plan(section({ ...BASE, A: pinnedA }), [...BASE_CARDS, card('3700', { size: '1' })]);
    const order = ids(orderedLines(p));
    expect(order.indexOf('3700')).toBeGreaterThan(order.indexOf('3600'));
    expect(orderedLines(p).find((l) => l.includes('#3600'))).toContain('pinned by operator');
  });

  it('never moves a delegation-section card out, and flags the state that would have moved it', () => {
    const active = plan(section(BASE), BASE_CARDS.map((c) => (c.id === '3696' ? { ...c, status: 'active' } : c)));
    expect(blockOf(active, '3696')).toBe('delegation');
    expect(active.flagged.map((f) => f.kind)).toContain('claimed-in-delegation');
    const out = plan(section({ ...BASE, delegation: ['2. #3696 · 5 · A · Clears: delegation.'] }), BASE_CARDS); // not operator-added, outside the tree
    expect(blockOf(out, '3696')).toBe('delegation');
    expect(out.flagged.map((f) => f.kind)).toContain('off-tree-in-delegation');
  });

  it('keeps the operator-added marker on every delegation line it keeps', () => {
    const p = plan(section(BASE), [...BASE_CARDS, card('3700')]);
    expect(orderedLines(p).find((l) => l.includes('#3696'))).toContain('operator-added');
  });

  it('never adds a card to the delegation section, even one whose own fields would suit it', () => {
    const p = plan(section({ ...BASE, delegation: [] }), [...BASE_CARDS, card('3700')]);
    expect(blockOf(p, '3700')).toBe('A');
    expect(p.added.every((a) => blockOf(p, a.id) !== 'delegation')).toBe(true);
  });
});

describe('rule 4: renumber, and the Updated line', () => {
  const cards = [...BASE_CARDS, card('3500', { status: 'resolved' }), card('3700')];
  const withGone = section({ ...BASE, health: [...BASE.health, '2. #3500 · 1 · B · gone.'] });

  it('numbers every ordered line 1..N across the sections and counts the lines that changed number', () => {
    const p = plan(withGone, cards);
    const nums = orderedLines(p).map((l) => Number(/^(\d+)\./.exec(l)[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    expect(p.renumbered).toBe(2); // the fixture's own numbers are 1,2,2,3,4,5: after the drop and the add, only the lines after the new one shift (3601, 3602)
  });

  it('does not renumber the lines of the rules text', () => {
    const p = plan(withGone, cards);
    expect(p.newSection).toContain('0. **The mechanised system first.**');
    expect(p.newSection).toContain('1. **Dependencies first.**');
  });

  it('rewrites the Updated line in place: date, priority-sync, the counts, and keeps the standing tail', () => {
    const p = plan(withGone, cards);
    expect(p.updated).toBe(
      'Updated: 2026-09-21 by delivery worker `priority-sync` — added 1, dropped 1, moved 0, flagged 0, renumbered 2; new lines wait for a worker to write their why. '
      + 'Derived by the rules below from the ranker. Whoever files a card updates this section; `check-priority` fails on drift.',
    );
    expect(p.newSection.split('\n').filter((l) => l.startsWith('Updated:'))).toEqual([p.updated]);
  });

  it('touches nothing, the Updated line included, when there is nothing to change', () => {
    const text = section(BASE);
    const p = plan(text, BASE_CARDS);
    expect(p.changed).toBe(false);
    expect(p.updated).toBeNull();
    expect(p.newSection).toBe(text.replace(/\n+$/, '') + (text.endsWith('\n') ? '\n' : ''));
    expect(p.newSection).toBe(text);
  });

  it('is idempotent: applying the plan and planning again is a no-op', () => {
    const p = plan(withGone, cards);
    const again = plan(p.newSection, cards);
    expect(again.changed).toBe(false);
    expect(again.newSection).toBe(p.newSection);
  });

  it('leaves the gate with no finding once applied (the unwritten marker only warns)', () => {
    const p = plan(withGone, cards);
    const result = checkPriorityOrder(p.newSection, new Map(cards.map((c) => [c.id, c])));
    expect(result.findings).toEqual([]);
    expect(result.warnings.map((w) => w.id)).toEqual(['3700']);
  });
});

describe('a hash id that was numbered', () => {
  it('renames the line in place, keeping its number, band and prose', () => {
    const p = plan(section({ ...BASE, A: [...BASE.A, '4. #xoppas2 · 3 · A · Off path: closes out.'] }), [...BASE_CARDS, card('3800', { bornAs: 'xoppas2' })]);
    expect(p.renamed).toEqual([{ from: 'xoppas2', to: '3800' }]);
    expect(orderedLines(p).find((l) => l.includes('#3800'))).toMatch(/^\d+\. #3800 · 3 · A · Off path: closes out\.$/);
    expect(p.added).toEqual([]);
  });

  it('flags an id that no card has and was born as no card, and leaves the line', () => {
    const p = plan(section({ ...BASE, A: [...BASE.A, '4. #4242 · 1 · A · ghost.'] }), BASE_CARDS);
    expect(p.flagged.map((f) => [f.kind, f.id])).toEqual([['unknown-line', '4242']]);
    expect(ids(orderedLines(p))).toContain('4242');
  });
});

describe('rule 6: landed but still open', () => {
  const landed = { 3600: { sha: 'abc1234', subject: 'Merge pull request #2400 from chalbert/lane/3600-x' }, 3500: { sha: 'def5678', subject: '#3500 done' } };

  it('flags an open card that a merged PR or commit names, and changes nothing', () => {
    const p = plan(section(BASE), BASE_CARDS, { landed });
    expect(p.flagged).toMatchObject([{ kind: 'landed-open', id: '3600', sha: 'abc1234' }]);
    expect(p.flagged[0].message).toContain('landed but still open: resolve it');
    expect(p.changed).toBe(false);
    expect(p.newSection).toBe(section(BASE));
  });

  it('flags a claimed card too, and never flags a resolved one', () => {
    const p = plan(section(BASE), [...BASE_CARDS, card('3500', { status: 'resolved' })], { landed: { ...landed, 3443: { sha: '1', subject: '#3443 x' } } });
    expect(p.flagged.map((f) => f.id)).toEqual(['3443', '3600']);
  });

  it('counts a flag in the Updated line only when something else changed', () => {
    const p = plan(section(BASE), [...BASE_CARDS, card('3700')], { landed });
    expect(p.updated).toContain('flagged 1');
  });
});

describe('landedFromLog', () => {
  const log = [
    ['aaa1111', 'Merge pull request #2363 from chalbert/lane/prepare-3690'],
    ['bbb2222', 'Merge pull request #2362 from chalbert/lane/container-test-skip-3751'],
    ['ccc3333', '#3767 track the deployed /wip command in source'],
    ['ddd4444', 'drain: JIT-number x9e1zpy→#3776 at land (#2288)'],
    ['eee5555', 'backlog: file six design-first stories, fold a finding into #3767'],
    ['fff6666', 'Merge pull request #2000 from chalbert/lane/3441b-retry'],
    ['ggg7777', 'prepare: bring decision #3690 to ready-to-ratify'],
    ['hhh8888', 'container-exec test: skip the volume block (#3751)'],
    ['iii9999', '#3767, #3768 both'],
  ].map((r) => r.join('\u001f')).join('\n');

  it('counts a merged PR from a branch carrying the card number, and a subject that starts with the number', () => {
    const r = landedFromLog(log, new Set(['3751', '3767', '3441', '3768', '3690', '3776', '2288']));
    expect(Object.keys(r).sort()).toEqual(['3441', '3751', '3767', '3768']);
    expect(r['3767']).toEqual({ sha: 'ccc3333', subject: '#3767 track the deployed /wip command in source' });
    expect(r['3751'].sha).toBe('bbb2222');
  });

  it('does not count filing, numbering or preparing a card, nor a mention in the middle of a subject', () => {
    const r = landedFromLog(log, new Set(['3690', '3776', '2288']));
    expect(r).toEqual({});
  });

  it('reports only the cards it was asked about', () => {
    expect(landedFromLog(log, new Set(['3999']))).toEqual({});
  });
});

describe('mergeRaw', () => {
  const f = (name) => ({ name, text: name });
  it('takes the checkout\'s file, except where the card is resolved only on the ref', () => {
    const local = new Map([['1', f('local-1')], ['2', f('local-2')], ['3', f('local-3')]]);
    const ref = new Map([['2', f('ref-2')], ['3', f('ref-3')], ['4', f('ref-4')]]);
    const localCards = new Map([['1', { status: 'open' }], ['2', { status: 'open' }], ['3', { status: 'resolved' }]]);
    const merged = new Map([['1', { status: 'open' }], ['2', { status: 'resolved' }], ['3', { status: 'resolved' }], ['4', { status: 'open' }]]);
    const out = mergeRaw(local, ref, localCards, merged);
    expect([...out].map(([id, r]) => [id, r.name])).toEqual([['1', 'local-1'], ['2', 'ref-2'], ['3', 'local-3'], ['4', 'ref-4']]);
  });
});

describe('the plan as a readable diff', () => {
  it('lists added, dropped, moved and flagged lines and says nothing was written on a dry run', () => {
    const cards = [...BASE_CARDS, card('3500', { status: 'resolved' }), card('3700')];
    const p = plan(section({ ...BASE, A: [...BASE.A, '4. #3500 · 2 · A · Clears: gone.'] }), cards, { landed: { 3600: { sha: 'abc', subject: '#3600 x' } } });
    const out = renderPlan(p);
    expect(out[0]).toBe('priority-sync: dry run — 1 added, 1 dropped, 0 moved, 0 renamed, 1 flagged; 2 existing lines renumbered');
    expect(out.some((l) => l.startsWith('+ ') && l.includes('#3700'))).toBe(true);
    expect(out.some((l) => l.startsWith('- ') && l.includes('#3500') && l.includes('[resolved]'))).toBe(true);
    expect(out.some((l) => l.startsWith('! landed-open: #3600 landed but still open: resolve it'))).toBe(true);
    expect(out.at(-1)).toContain('dry run: nothing written');
  });

  it('says it is in sync when there is nothing to do, and that it wrote the section when applied', () => {
    expect(renderPlan(plan(section(BASE), BASE_CARDS)).at(-1)).toBe('the section is already in sync: nothing to write');
    expect(renderPlan(plan(section(BASE), BASE_CARDS), { asked: true })[0]).toMatch(/^priority-sync: apply requested, nothing to write — 0 added/);
    const p = plan(section(BASE), [...BASE_CARDS, card('3700')]);
    expect(renderPlan(p, { applied: true, trackerPath: '/t.md' }).at(-1)).toBe('wrote the section in /t.md; nothing committed or pushed');
  });
});

describe('the declaration', () => {
  it('reaches nothing that can act: no node: specifier, no package', () => {
    expect(importGraph(resolve(HERE, '..', 'priority-sync.mjs')).external).toEqual([]);
  });

  it('refuses without a reader, and shapes a read with no section as a refusal', () => {
    expect(() => prioritySyncOperation()).toThrow(/readFacts/);
    expect(() => shapePriorityRead({})).toThrow(/no "## Priority order" section/);
  });

  const trackerPath = '/tmp/priority-sync-decl/backlog/3383-x.md';
  const wired = (text, cards) => {
    const declaration = prioritySyncOperation({ readFacts: () => asRead(text, cards, { trackerPath }) });
    const registry = createRegistry();
    registry.register(declaration);
    return { declaration, registry, store: createMemoryRunStore() };
  };
  const drive = (h, argv, sinks = {}) => runOperationCli({ declaration: h.declaration, argv, registry: h.registry, store: h.store, sinks, newRunId: () => 'run-ps-1' });

  it('a dry run (the default) declares no effect', async () => {
    const h = wired(section(BASE), [...BASE_CARDS, card('3700')]);
    const outcome = await drive(h, []);
    expect(outcome.stopped).toBe('complete');
    expect(outcome.run.effects).toEqual([]);
    expect(outcome.run.verdict.counts.added).toBe(1);
  });

  it('--apply with nothing to change declares no effect', async () => {
    const h = wired(section(BASE), BASE_CARDS);
    const outcome = await drive(h, ['--apply']);
    expect(outcome.run.effects).toEqual([]);
  });

  it('--apply with a change declares ONE idempotent write of the new section, and the sink applies it', async () => {
    const text = `# T\n\n${section(BASE)}\n## Session update (2026-09-20) — later\n`;
    const files = new Map([[trackerPath, text]]);
    const sinks = createPrioritySyncSinks({ read: (p) => files.get(p), write: (p, s) => files.set(p, s) });
    const h = wired(extractSectionText(text), [...BASE_CARDS, card('3700')]);
    const outcome = await drive(h, ['--apply'], sinks);
    expect(outcome.stopped).toBe('complete');
    expect(outcome.run.effects.map((e) => [e.type, e.status, e.idempotent])).toEqual([[PRIORITY_SYNC_EFFECT, 'applied', true]]);
    const written = files.get(trackerPath);
    expect(written).toContain('#3700 · 3 · A · why: (unwritten)');
    expect(written.endsWith('## Session update (2026-09-20) — later\n')).toBe(true);
    expect(written.startsWith('# T\n\n## Priority order')).toBe(true);
  });

  it('the sink refuses a section that changed since the plan, and treats an already-applied one as done', async () => {
    const text = section(BASE);
    const p = plan(text, [...BASE_CARDS, card('3700')]);
    const payload = { trackerPath, expectedSection: extractSectionText(text), newSection: p.newSection };
    const stale = new Map([[trackerPath, text.replace('Clears: a.', 'Clears: edited.')]]);
    const sink = createPrioritySyncSinks({ read: (path) => stale.get(path), write: (path, s) => stale.set(path, s) })[PRIORITY_SYNC_EFFECT];
    await expect(sink(payload)).rejects.toMatchObject({ notApplied: true });
    const done = new Map([[trackerPath, p.newSection]]);
    const again = createPrioritySyncSinks({ read: (path) => done.get(path), write: () => { throw new Error('must not write'); } })[PRIORITY_SYNC_EFFECT];
    await expect(again(payload)).resolves.toMatchObject({ alreadyApplied: true });
  });

  it('the command line trailer prints the plan first in plain mode and leaves --json to the payload', async () => {
    const h = wired(section(BASE), [...BASE_CARDS, card('3700')]);
    const outcome = await drive(h, []);
    const plain = finishPriorityOutcome({ run: outcome.run, code: outcome.code, lines: outcome.lines });
    expect(plain.lines[0]).toMatch(/^priority-sync: dry run — 1 added/);
    expect(plain.lines.at(-1)).toMatch(/complete/);
    expect(finishPriorityOutcome({ run: outcome.run, code: 0, lines: ['x'], json: true })).toEqual({ code: 0, lines: ['x'] });
    const json = await drive(h, ['--json']);
    expect(JSON.parse(json.lines.join('\n')).verdict.counts).toMatchObject({ added: 1, dropped: 0 });
  });

  it('is registered on the command line under its own name, with --help derived from the declaration', async () => {
    const { resolveOperation } = await import('../run.mjs');
    const r = resolveOperation(PRIORITY_SYNC_OP);
    expect(r.declaration.name).toBe('priority-sync');
    const { buildCliSpec } = await import('../cli-adapter.mjs');
    expect(buildCliSpec(r.declaration).usage).toMatch(/--ref=<string>, default origin\/main.*--apply=<boolean>, default false/);
    expect(Object.keys(r.sinks)).toEqual([PRIORITY_SYNC_EFFECT]);
  });
});

describe('check-priority: the unwritten why warns, it does not fail', () => {
  const cards = new Map(BASE_CARDS.map((c) => [c.id, c]));
  const text = section({ ...BASE, A: [...BASE.A, `4. #3700 · 3 · A · ${UNWRITTEN_WHY}`] });
  const all = new Map([...cards, ['3700', card('3700')]]);

  it('reports one warning per unwritten line and leaves ok alone', () => {
    const r = checkPriorityOrder(text, all);
    expect(r.ok).toBe(true);
    expect(r.warnings).toMatchObject([{ kind: 'why-unwritten', id: '3700' }]);
  });

  it('has no warning once the line carries a reason', () => {
    expect(checkPriorityOrder(text.replace(UNWRITTEN_WHY, 'Clears: x.'), all).warnings).toEqual([]);
  });
});
