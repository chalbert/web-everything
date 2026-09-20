/**
 * @file scripts/__tests__/priority-order.test.mjs
 * @description Proof of the `## Priority order` gate (`we:scripts/lib/priority-order.mjs` + the `check-priority`
 *   subcommand of `we:scripts/prototype-tracker.mjs`). Three layers, per the real-mechanism rule (#2949):
 *   pure fixtures for each finding kind; the SAME shell run against a real directory and a real git repo (the
 *   two card sources); and the real tracker card of this checkout, so a malformed section fails here and not
 *   silently in the gate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parsePriorityOrder, liveTree, checkPriorityOrder, parseCard, mergeCards, parseCatFileBatch,
  readCardsFromDir, readCardsFromRef, defaultGit,
} from '../lib/priority-order.mjs';
import { main } from '../prototype-tracker.mjs';
import { findTrackerPath } from '../lib/prototype-tracker-data.mjs';

const card = (id, o = {}) => ({ id, parent: o.parent ?? '3383', status: o.status ?? 'open', blockedBy: o.blockedBy ?? [] });
const mapOf = (...cs) => new Map(cs.map((c) => [c.id, c]));

const SECTION = (lines) => `# Tracker\n\nlead paragraph\n\n## Priority order\n\nUpdated: x\n\n${lines.join('\n')}\n\n## Session update (2026-09-20) — later\n\n1. #9999 · 1 · A · not in the section\n`;

describe('parsePriorityOrder', () => {
  it('reads only entry-marker lines inside the section, not prose mentions or the next heading', () => {
    const text = SECTION([
      '1. #3768 · 5 · B · Clears: the branch; see #3772 for more.',
      '2. #3772 · 3 · B · Clears: drift.',
      '- #3443 · epic · claimed · not ordered',
      'A sentence that mentions #3999 in prose.',
    ]);
    const r = parsePriorityOrder(text);
    expect(r.found).toBe(true);
    expect(r.entries.map((e) => [e.id, e.kind, e.n])).toEqual([['3768', 'ordered', 1], ['3772', 'ordered', 2], ['3443', 'claimed', null]]);
  });
  it('reports a missing section', () => {
    expect(parsePriorityOrder('# t\n\n## Session update (2026-09-20) — x\n')).toEqual({ found: false, entries: [] });
  });
});

describe('liveTree', () => {
  it('walks open and active cards through open parents and stops at a resolved one', () => {
    const cards = mapOf(
      card('3718', { status: 'open' }), card('3730', { parent: '3718' }),
      card('3637', { status: 'resolved' }), card('3638', { parent: '3637' }),
      card('3443', { status: 'active' }), card('3486', { parent: '3443' }),
      card('3500', { status: 'resolved' }),
    );
    expect([...liveTree(cards)].sort()).toEqual(['3443', '3486', '3718', '3730']);
  });
});

describe('checkPriorityOrder', () => {
  const cards = mapOf(card('3768'), card('3772'), card('3443', { status: 'active' }), card('3500', { status: 'resolved' }), card('3600', { blockedBy: ['3768'] }));
  const ok = SECTION(['1. #3768 · 5 · B · a', '2. #3772 · 3 · B · b', '3. #3600 · 3 · A · c', '- #3443 · epic · claimed · d']);
  const kinds = (t, c = cards) => checkPriorityOrder(t, c).findings.map((f) => f.kind).sort();

  it('passes a complete, ordered list', () => { expect(checkPriorityOrder(ok, cards)).toMatchObject({ ok: true, findings: [] }); });
  it('flags an open child with no line', () => { expect(kinds(SECTION(['1. #3768 · 5 · B · a', '3. #3600 · 3 · A · c', '- #3443 · epic · claimed · d']))).toEqual(['missing']); });
  it('flags a claimed child with no line too', () => { expect(kinds(SECTION(['1. #3768 · 5 · B · a', '2. #3772 · 3 · B · b', '3. #3600 · 3 · A · c']))).toEqual(['missing']); });
  it('flags a resolved child that still has a line', () => { expect(kinds(`${ok}\n`.replace('## Session', '2. #3500 · 1 · A · e\n\n## Session'))).toEqual(['resolved-listed']); });
  it('flags a number listed twice', () => { expect(kinds(SECTION(['1. #3768 · 5 · B · a', '2. #3772 · 3 · B · b', '3. #3600 · 3 · A · c', '4. #3768 · 5 · B · again', '- #3443 · epic · claimed · d']))).toEqual(['duplicate']); });
  it('flags a listed number that is no card', () => { expect(kinds(SECTION(['1. #3768 · 5 · B · a', '2. #3772 · 3 · B · b', '3. #3600 · 3 · A · c', '4. #4242 · 1 · A · ghost', '- #3443 · epic · claimed · d']))).toEqual(['unknown']); });
  it('flags a blocker ordered below the card it blocks', () => { expect(kinds(SECTION(['1. #3600 · 3 · A · c', '2. #3768 · 5 · B · a', '3. #3772 · 3 · B · b', '- #3443 · epic · claimed · d']))).toEqual(['blocked-order']); });
  it('flags an active card in the ordered list and an open card under claimed', () => {
    expect(kinds(SECTION(['1. #3768 · 5 · B · a', '2. #3772 · 3 · B · b', '3. #3600 · 3 · A · c', '4. #3443 · epic · B · claimed but ordered']))).toEqual(['claimed-ordered']);
    expect(kinds(SECTION(['1. #3768 · 5 · B · a', '- #3772 · 3 · claimed · wrong', '3. #3600 · 3 · A · c', '- #3443 · epic · claimed · d']))).toEqual(['not-claimed']);
  });
  it('does not flag a blocker that is claimed, resolved, or outside the list', () => {
    const c = mapOf(card('3600', { blockedBy: ['3443', '3500', '3999'] }), card('3443', { status: 'active' }), card('3500', { status: 'resolved' }));
    expect(checkPriorityOrder(SECTION(['1. #3600 · 3 · A · c', '- #3443 · epic · claimed · d']), c).ok).toBe(true);
  });
  it('flags a missing section', () => { expect(kinds('# t\n')).toEqual(['no-section']); });
});

describe('card sources', () => {
  it('parses frontmatter, including a block-list blockedBy and an unquoted numeric parent', () => {
    expect(parseCard('3600', '---\nkind: story\nparent: 3383\nstatus: open\nblockedBy:\n  - "3768"\n  - 3772\n---\n\n# t\n'))
      .toEqual({ id: '3600', parent: '3383', status: 'open', blockedBy: ['3768', '3772'] });
  });
  it('resolved in either source is resolved; otherwise the first source wins', () => {
    const a = mapOf(card('1', { status: 'open' }), card('2', { status: 'resolved' }), card('3', { status: 'open' }));
    const b = mapOf(card('1', { status: 'resolved' }), card('2', { status: 'open' }), card('4', { status: 'open' }));
    const m = mergeCards(a, b);
    expect(['1', '2', '3', '4'].map((i) => m.get(i).status)).toEqual(['resolved', 'resolved', 'open', 'open']);
  });
  it('splits a cat-file batch stream by declared size, including content that contains newlines', () => {
    const buf = Buffer.from('aaa blob 8\nab\ncd\nef\nbbb blob 1\nz\nccc missing\n');
    expect(parseCatFileBatch(buf)).toEqual([{ sha: 'aaa', text: 'ab\ncd\nef' }, { sha: 'bbb', text: 'z' }]);
  });
});

// ---- real mechanism (#2949): the same shell, real fs and real git, not stubs ---------------------------------
const cardFile = (num, o = {}) => `---\nkind: story\nparent: "${o.parent ?? '3383'}"\nstatus: ${o.status ?? 'open'}\n${o.blockedBy ? `blockedBy: [${o.blockedBy.map((b) => `"${b}"`).join(', ')}]\n` : ''}---\n\n# card ${num}\n`;
const trackerFile = (lines) => `---\nkind: epic\nparent: "3029"\nstatus: active\n---\n\n# Tracker\n\n## Priority order\n\nUpdated: test\n\n${lines.join('\n')}\n`;

function capture(git) {
  const out = []; const err = [];
  return { out, err, io: { read: (p) => readFileSync(p, 'utf8'), write() {}, stdin: () => '', out: (s) => out.push(s), err: (s) => err.push(s), ...(git ? { git } : {}) } };
}

describe('check-priority against a real directory', () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'prio-dir-'));
    writeFileSync(join(dir, '3383-tracker.md'), trackerFile(['1. #3600 · 3 · A · c']));
    writeFileSync(join(dir, '3600-a.md'), cardFile('3600'));
    writeFileSync(join(dir, '3601-b.md'), cardFile('3601'));
    writeFileSync(join(dir, '3602-done.md'), cardFile('3602', { status: 'resolved' }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads the real files, prints the drift and exits 0 by default', () => {
    const { io, out } = capture();
    expect(main(['check-priority', `--backlog-dir=${dir}`], io)).toBe(0);
    expect(out.join('')).toMatch(/DRIFT/);
    expect(out.join('')).toMatch(/missing: open card #3601/);
    expect(out.join('')).toMatch(/warn only/);
  });
  it('exits 1 on the same drift with --strict', () => {
    const { io } = capture();
    expect(main(['check-priority', `--backlog-dir=${dir}`, '--strict'], io)).toBe(1);
  });
  it('exits 0 with --strict once the section covers the live tree', () => {
    writeFileSync(join(dir, '3383-tracker.md'), trackerFile(['1. #3600 · 3 · A · c', '2. #3601 · 3 · A · d']));
    const { io, out } = capture();
    expect(main(['check-priority', `--backlog-dir=${dir}`, '--strict'], io)).toBe(0);
    expect(out.join('')).toMatch(/priority order OK — 2 open cards/);
    expect(readCardsFromDir({ backlogDir: dir }).get('3602').status).toBe('resolved');
  });
});

describe('check-priority against a real git ref', () => {
  let repo;
  const git = (...args) => { const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo, encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout; };
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'prio-git-'));
    git('init', '-q', '-b', 'main');
    mkdirSync(join(repo, 'backlog'));
    writeFileSync(join(repo, 'backlog', '3600-a.md'), cardFile('3600'));
    writeFileSync(join(repo, 'backlog', '3601-b.md'), cardFile('3601'));              // only on the ref: filed on main
    writeFileSync(join(repo, 'backlog', '3602-c.md'), cardFile('3602', { status: 'resolved' }));
    git('add', '-A'); git('commit', '-q', '-m', 'cards');
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('reads every card blob in one pass and keeps the frontmatter', () => {
    const cards = readCardsFromRef('main', { git: defaultGit, cwd: repo });
    expect([...cards.keys()].sort()).toEqual(['3600', '3601', '3602']);
    expect(cards.get('3602')).toEqual({ id: '3602', parent: '3383', status: 'resolved', blockedBy: [] });
  });
  it('a card only on the ref counts, and a card the LOCAL side resolved stays resolved', () => {
    const local = mkdtempSync(join(tmpdir(), 'prio-local-'));
    try {
      writeFileSync(join(local, '3383-tracker.md'), trackerFile(['1. #3601 · 3 · A · from main']));
      writeFileSync(join(local, '3600-a.md'), cardFile('3600', { status: 'resolved' })); // open on the ref, resolved here
      const { io, out } = capture((a, o) => defaultGit(a, { ...o, cwd: repo }));
      expect(main(['check-priority', `--backlog-dir=${local}`, '--ref=main', '--strict'], io)).toBe(0);
      expect(out.join('')).toMatch(/priority order OK — 1 open cards/);
    } finally { rmSync(local, { recursive: true, force: true }); }
  });
  it('reports an unreadable ref instead of passing', () => {
    const local = mkdtempSync(join(tmpdir(), 'prio-local-'));
    try {
      writeFileSync(join(local, '3383-tracker.md'), trackerFile(['1. #3600 · 3 · A · c']));
      const { io, err } = capture((a, o) => defaultGit(a, { ...o, cwd: repo }));
      expect(main(['check-priority', `--backlog-dir=${local}`, '--ref=no-such-ref', '--strict'], io)).toBe(1);
      expect(err.join('')).toMatch(/could not read the cards/);
    } finally { rmSync(local, { recursive: true, force: true }); }
  });
});

describe("this checkout's real tracker card", () => {
  const path = findTrackerPath({});
  it('has a parseable Priority order section with no duplicate numbers', () => {
    const r = parsePriorityOrder(readFileSync(path, 'utf8'));
    expect(r.found).toBe(true);
    expect(r.entries.length).toBeGreaterThan(0);
    expect(new Set(r.entries.map((e) => e.id)).size).toBe(r.entries.length);
    const ordered = r.entries.filter((e) => e.kind === 'ordered').map((e) => e.n);
    expect(ordered).toEqual(ordered.map((_, i) => i + 1));
  });
  it('lists no card that is resolved in this checkout, and orders no blocker below its blocked card', () => {
    const cards = readCardsFromDir({});
    const findings = checkPriorityOrder(readFileSync(path, 'utf8'), cards).findings;
    expect(findings.filter((f) => f.kind === 'resolved-listed' || f.kind === 'blocked-order' || f.kind === 'duplicate' || f.kind === 'claimed-ordered')).toEqual([]);
    expect(readdirSync(join(process.cwd(), 'backlog')).length).toBeGreaterThan(0);
  });
});
