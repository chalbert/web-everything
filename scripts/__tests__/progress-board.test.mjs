/**
 * @file progress-board.test.mjs — the derivation + the CLI behind the operator's published board (item `x9t5i5a`).
 *
 * Two surfaces, both load-bearing and both cheap to get wrong:
 *   • `classifyPr` — the whole "who is holding the ball" reduction. A mis-ranked label puts the ONE pull request
 *     that needs the operator underneath five that do not, which is precisely the failure the board exists to fix.
 *   • The CLI — the only writer of the state file. If a verb is not idempotent, a second identical run silently
 *     rewrites a date or duplicates a row, and the board starts lying about when work moved.
 *
 * The CLI tests SPAWN the real script against a temp state + out path with `--no-gh`, so nothing here touches the
 * network or the repo's own board. `WE_BOARD_NOW` freezes the stamp so renders are comparable byte-for-byte.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyPr,
  ciFailed,
  ciPending,
  buildModel,
  renderPage,
  applyVerb,
  slugify,
  loadState,
  assertWritablePath,
  ensureRulingNumbers,
  findDecision,
  verifyPage,
  decisionGaps,
  validateDecisions,
  PR_STATUS,
  STATE_ERROR,
  DECISION_FIELDS,
  DECISION_STATUSES,
} from '../progress-board.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'scripts', 'progress-board.mjs');
const NOW = '2026-08-08T12:00:00.000Z';
process.env.WE_BOARD_NOW = NOW; // freeze the stamp for the in-process `renderPage` cases too

const sandbox = mkdtempSync(join(tmpdir(), 'progress-board-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

let statePath;
let outPath;
let seq = 0;

const SEED = {
  title: 'Test board',
  repo: 'chalbert/web-everything',
  artifactUrl: null,
  phases: { 1: 'First' },
  items: [
    { id: 'alpha', title: 'Alpha', phase: 1, status: 'todo' },
    { id: 'beta', title: 'Beta', phase: 1, status: 'in-progress', pr: 1099 },
  ],
  // Complete on purpose: the board REFUSES to render an `awaiting` decision that cannot be answered from the
  // page, so a seed with a bare title would fail every CLI case here for the wrong reason.
  decisions: [
    {
      id: '2978',
      title: 'A decision',
      status: 'awaiting',
      question: 'Do we take the decision?',
      options: [
        { label: 'Yes', detail: 'take it', recommended: true },
        { label: 'No', detail: 'leave it' },
      ],
      ifNothing: 'nothing moves',
    },
  ],
};

beforeEach(() => {
  seq += 1;
  statePath = join(sandbox, `state-${seq}.json`);
  outPath = join(sandbox, `board-${seq}.html`);
  writeFileSync(statePath, JSON.stringify(SEED, null, 2));
});

/** Run the real CLI. Never throws — exit code + stdout are the assertion surface. */
function cli(...args) {
  const r = spawnSync(process.execPath, [CLI, `--state=${statePath}`, `--out=${outPath}`, '--no-gh', ...args], {
    encoding: 'utf8',
    env: { ...process.env, WE_BOARD_NOW: NOW, WE_BOARD_NO_GH: '1' },
  });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}

const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
const page = () => readFileSync(outPath, 'utf8');

const pr = (over = {}) => ({
  number: 1,
  title: 'A pull request',
  state: 'OPEN',
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: [],
  labels: [],
  ...over,
  labels: (over.labels ?? []).map((name) => ({ name })),
});

// ── The derivation ────────────────────────────────────────────────────────────

describe('classifyPr', () => {
  it('flags a human-hold pull request as the operator\'s', () => {
    expect(classifyPr(pr({ labels: ['ready-to-merge', 'review:human'] }))).toBe('needs-human');
  });

  it('ranks a changes-requested pull request as the AUTHOR\'s, even when it also carries the human hold', () => {
    // The ball is with the author lane. Surfacing it to the operator would bury the PRs that truly await them.
    expect(classifyPr(pr({ labels: ['review:changes', 'review:human'] }))).toBe('bounced');
  });

  it('lets review:accepted supersede review:human', () => {
    expect(classifyPr(pr({ labels: ['review:human', 'review:accepted'] }))).toBe('queued');
  });

  it('reports a failed required check ahead of any queue label', () => {
    expect(classifyPr(pr({ labels: ['ready-to-merge'], statusCheckRollup: [{ conclusion: 'FAILURE' }] }))).toBe('ci-red');
  });

  it('reports a dirty or behind merge state as conflicted', () => {
    expect(classifyPr(pr({ mergeStateStatus: 'DIRTY', labels: ['ready-to-merge'] }))).toBe('conflicted');
    expect(classifyPr(pr({ mergeStateStatus: 'BEHIND', labels: ['ready-to-merge'] }))).toBe('conflicted');
  });

  it('distinguishes parked-for-review from reviewed-and-queued', () => {
    expect(classifyPr(pr({ labels: ['ready-to-merge', 'review:pending'] }))).toBe('needs-review');
    expect(classifyPr(pr({ labels: ['ready-to-merge', 'review:accepted'] }))).toBe('queued');
  });

  it('treats a merged pull request as landed whatever its labels say', () => {
    expect(classifyPr(pr({ state: 'MERGED', labels: ['review:human'] }))).toBe('landed');
  });

  it('falls back to plain open with no signal at all', () => {
    expect(classifyPr(pr())).toBe('open');
  });

  it('separates a pending check from a failed one', () => {
    expect(ciPending([{ conclusion: '', state: 'PENDING' }])).toBe(true);
    expect(ciFailed([{ conclusion: '', state: 'PENDING' }])).toBe(false);
    expect(ciFailed([{ conclusion: 'TIMED_OUT' }])).toBe(true);
  });

  it('ranks the operator\'s status above every other', () => {
    const ranks = Object.entries(PR_STATUS).map(([k, v]) => [k, v.rank]);
    expect(Math.min(...ranks.map(([, r]) => r))).toBe(PR_STATUS['needs-human'].rank);
  });
});

describe('buildModel', () => {
  const prs = {
    fresh: true,
    fetchedAt: NOW,
    reason: null,
    rows: [
      { number: 1099, title: 'Needs the operator', labels: [], status: 'needs-human', detail: '' },
      { number: 1092, title: 'Bounced', labels: [], status: 'bounced', detail: '' },
      { number: 1090, title: 'Landed', labels: [], status: 'landed', detail: '' },
    ],
  };

  it('puts decisions, human-hold PRs and blocked items in the operator\'s section', () => {
    const s = { ...SEED, items: [{ id: 'x', title: 'X', phase: 1, status: 'blocked', blocker: 'waiting' }] };
    const m = buildModel(s, prs);
    expect(m.needsYou.decisions).toHaveLength(1);
    expect(m.needsYou.prs.map((r) => r.number)).toEqual([1099]);
    expect(m.needsYou.items.map((i) => i.id)).toEqual(['x']);
    expect(m.counts.needsYou).toBe(3);
  });

  it('does not list an in-progress item twice when its pull request is already on the board', () => {
    const m = buildModel(SEED, prs); // `beta` is pinned to PR #1099, which IS in the rows
    expect(m.inFlight.items.map((i) => i.id)).not.toContain('beta');
    expect(m.plan[0].items.map((i) => i.id)).toContain('beta'); // the plan table still enumerates it
  });

  it('joins a plan item to its live pull-request row', () => {
    const m = buildModel(SEED, prs);
    const beta = m.plan[0].items.find((i) => i.id === 'beta');
    expect(beta.prRow.status).toBe('needs-human');
  });

  it('sorts pull rows by consequence, not by number', () => {
    const m = buildModel(SEED, prs);
    expect(m.prs.rows.map((r) => r.status)).toEqual(['needs-human', 'bounced', 'landed']);
  });
});

// ── The page ──────────────────────────────────────────────────────────────────

describe('renderPage', () => {
  const html = () => renderPage(buildModel(SEED, { fresh: true, fetchedAt: NOW, reason: null, rows: [] }));

  it('emits an Artifact-ready fragment — a provenance marker, then a title, no document skeleton', () => {
    const h = html();
    expect(h).toMatch(/^<!-- progress-board:generated /);
    expect(h.split('\n').slice(1).join('\n')).toMatch(/^<title>/);
    expect(h).not.toMatch(/<!doctype/i);
    expect(h).not.toMatch(/<html[\s>]/i);
    expect(h).not.toMatch(/<body[\s>]/i);
  });

  it('is self-contained — the strict CSP blocks every external host', () => {
    const h = html();
    expect(h).not.toMatch(/src\s*=\s*["']https?:/i);
    expect(h).not.toMatch(/<link\b/i);
    expect(h).not.toMatch(/<script\b/i);
    expect(h).not.toMatch(/@import/i);
    expect(h).not.toMatch(/url\(\s*["']?https?:/i);
  });

  it('defines the palette in all four theme places so the viewer\'s toggle wins both ways', () => {
    const h = html();
    expect(h).toContain('@media (prefers-color-scheme: dark)');
    expect(h).toContain(':root[data-theme="dark"]');
    expect(h).toContain(':root[data-theme="light"]');
    expect(h.match(/--bg:/g).length).toBe(4); // :root + media + both toggles
  });

  it('scrolls wide content in its own container, never the body', () => {
    const h = html();
    expect(h).toContain('.scroll { overflow-x: auto');
    expect(h).toMatch(/body\s*\{[^}]*overflow-x: hidden/);
  });

  it('carries a refresh stamp and an honest note that pull-request state moves', () => {
    const h = html();
    expect(h).toContain('Last refreshed');
    expect(h).toContain('2026-08-08 12:00 UTC');
    expect(h).toMatch(/Pull-request state moves continuously/);
  });

  it('leads with what needs the operator', () => {
    const h = html();
    expect(h.indexOf('Needs you')).toBeLessThan(h.indexOf('In flight'));
    expect(h.indexOf('In flight')).toBeLessThan(h.indexOf('Landed'));
  });

  it('escapes hostile content out of pull-request titles', () => {
    const rows = [{ number: 7, title: '<img src=x onerror=alert(1)>', labels: [], status: 'open', detail: '' }];
    const h = renderPage(buildModel(SEED, { fresh: true, fetchedAt: NOW, reason: null, rows }));
    expect(h).not.toContain('<img src=x');
    expect(h).toContain('&lt;img src=x');
  });

  it('says so, loudly, when the pull-request half is stale', () => {
    const h = renderPage(buildModel(SEED, { fresh: false, fetchedAt: NOW, reason: 'GitHub was unreachable', rows: [] }));
    expect(h).toContain('class="banner"');
    expect(h).toContain('GitHub was unreachable');
  });
});

// ── Decisions: the page's only ask ────────────────────────────────────────────

/**
 * A decision has to be ANSWERABLE from the page — the question, why it is a judgment call, the real options
 * with one recommended, what breaks if nothing is done, and the grounding. Every field is optional, so the
 * fallback (a bare `{id, title, detail}`, the shape the board shipped with) has to keep rendering too.
 */
describe('decisions', () => {
  const RICH = {
    id: 'fork-b',
    title: 'Fork B — rebuild or drop',
    status: 'awaiting',
    question: 'Does the codification shortcut get one more attempt, or get dropped?',
    why: 'Broken three times by three independent reviewers.',
    options: [
      { label: 'One round rebuilt on markdown-it', detail: 'detection and rendering cannot disagree', recommended: true },
      { label: 'Drop Fork B now', detail: 'the status quo, and it costs little' },
    ],
    ifNothing: 'Fork A still ships; codification PRs keep needing a human.',
    evidence: ['three breaks: mid-rule splice', 'a working attack added autoLand:true'],
  };
  /** The shape the board shipped with — id, title, detail. It stays renderable for the states that are not asks. */
  const LEGACY = { id: '2691', title: 'Define a feature tier above epic', preparedDate: '2026-07-28', detail: 'prepared and ready to ratify' };
  const COMPLETE = { ...RICH, id: 'other', title: 'Another decision', question: 'Another question?' };

  const render = (decisions) =>
    renderPage(buildModel({ ...SEED, items: [], decisions }, { fresh: true, fetchedAt: NOW, reason: null, rows: [] }));

  /** The markup of ONE section, so "renders" and "renders IN THE RIGHT PLACE" are different assertions. */
  const section = (h, title) => {
    const start = h.indexOf(`<h2>${title}</h2>`);
    expect(start).toBeGreaterThan(-1);
    return h.slice(start, h.indexOf('</section>', start));
  };

  it('leads a rich decision with the question, not the title', () => {
    const h = section(render([RICH]), 'Needs you');
    expect(h).toContain('<div class="t">Does the codification shortcut get one more attempt, or get dropped?</div>');
    expect(h).toContain('Fork B — rebuild or drop'); // the title survives as the handle underneath
    expect(h.indexOf('get dropped?')).toBeLessThan(h.indexOf('Fork B — rebuild or drop'));
  });

  it('renders why it is a judgment call, every option, and marks exactly one recommended', () => {
    const h = section(render([RICH]), 'Needs you');
    expect(h).toContain('Broken three times by three independent reviewers.');
    expect(h).toContain('One round rebuilt on markdown-it');
    expect(h).toContain('Drop Fork B now');
    expect(h).toContain('detection and rendering cannot disagree');
    expect(h.match(/class="chip ok">recommended</g)).toHaveLength(1);
    expect(h.match(/<li class="rec">/g)).toHaveLength(1);
  });

  it('gives what-breaks and the grounding their own treatment', () => {
    const h = section(render([RICH]), 'Needs you');
    expect(h).toContain('<b>If nothing is done:</b> Fork A still ships');
    expect(h).toContain('<span class="mono e">three breaks: mid-rule splice</span>');
    expect(h).toContain('<span class="mono e">a working attack added autoLand:true</span>');
  });

  it('still renders a bare decision from `detail` alone — none of the new fields required to RENDER', () => {
    // The fields are required to ASK (see the enforcement cases); rendering keeps working for the states
    // that are not asks, so an old entry never becomes unprintable.
    const h = section(render([{ ...LEGACY, status: 'queued' }]), 'Ruled, queued');
    expect(h).toContain('Define a feature tier above epic');
    expect(h).toContain('prepared and ready to ratify · prepared 2026-07-28');
    expect(h).not.toContain('class="opts"');
    expect(h).not.toContain('class="breaks"');
  });

  it('keeps a RULED-and-queued decision visible but out of the operator\'s section and out of its count', () => {
    const queued = { id: '2572', title: 'Converge daemon scheduling', status: 'queued', ifNothing: 'every parked PR keeps waiting.' };
    const m = buildModel({ ...SEED, items: [], decisions: [COMPLETE, queued] }, { fresh: true, fetchedAt: NOW, reason: null, rows: [] });
    expect(m.needsYou.decisions.map((d) => d.id)).toEqual(['other']);
    expect(m.ruled.map((d) => d.id)).toEqual(['2572']);
    expect(m.counts.needsYou).toBe(1); // the ruling is already made; it is not an ask

    const h = renderPage(m);
    expect(section(h, 'Needs you')).not.toContain('Converge daemon scheduling');
    const ruled = section(h, 'Ruled, queued');
    expect(ruled).toContain('Converge daemon scheduling');
    expect(ruled).toContain('ruled · queued');
    expect(ruled).toContain('every parked PR keeps waiting.');
  });

  it('keeps a DRAFT far away from the operator, in its own low-emphasis section', () => {
    const draft = { id: 'half-built', title: 'Half-built', status: 'draft', question: 'Is this ready?', ifNothing: 'nothing' };
    const m = buildModel({ ...SEED, items: [], decisions: [COMPLETE, draft] }, { fresh: true, fetchedAt: NOW, reason: null, rows: [] });
    expect(m.needsYou.decisions.map((d) => d.id)).toEqual(['other']);
    expect(m.drafts.map((d) => d.id)).toEqual(['half-built']);
    expect(m.counts.needsYou).toBe(1);

    const h = renderPage(m);
    expect(section(h, 'Needs you')).not.toContain('Half-built');
    const drafts = section(h, 'Decisions being prepared');
    expect(drafts).toContain('Is this ready?');
    expect(drafts).toContain('<span class="chip muted">draft</span>');
    // Low emphasis means low ON THE PAGE too — it sits below the plan, not above it.
    expect(h.indexOf('<h2>The plan</h2>')).toBeLessThan(h.indexOf('<h2>Decisions being prepared</h2>'));
  });

  it('omits the ruled and draft sections entirely when there is nothing in them', () => {
    const h = render([COMPLETE]);
    expect(h).not.toContain('Ruled, queued');
    expect(h).not.toContain('Decisions being prepared');
  });

  it('treats a decision with no status recorded as still outstanding', () => {
    const m = buildModel({ ...SEED, decisions: [{ ...COMPLETE, status: undefined }] }, { fresh: true, fetchedAt: NOW, reason: null, rows: [] });
    expect(m.needsYou.decisions.map((d) => d.id)).toEqual(['other']);
  });

  it('escapes hostile content out of every new decision field', () => {
    const h = render([
      { id: 'x', title: 'X', question: '<img src=x>', why: '<img src=y>', options: [{ label: '<img src=z>', detail: '<b>d</b>' }], ifNothing: '<img src=w>', evidence: ['<img src=v>'] },
    ]);
    expect(h).not.toMatch(/<img src=[xyzwv]>/);
    expect(h).toContain('&lt;img src=v&gt;');
  });
});

/**
 * The operator answers these in chat — "R6 — as recommended". A number that comes from position means
 * nothing the next day, so the number has to be identity: assigned once, persisted, never renumbered, never
 * reused.
 */
describe('ruling numbers', () => {
  const st = (decisions, nextRuling) => ({ decisions, ...(nextRuling ? { nextRuling } : {}) });

  it('assigns R1, R2, … from the counter and records where the counter got to', () => {
    const s = st([{ id: 'a' }, { id: 'b' }]);
    expect(ensureRulingNumbers(s)).toBe(2);
    expect(s.decisions.map((d) => d.ruling)).toEqual(['R1', 'R2']);
    expect(s.nextRuling).toBe(3);
  });

  it('assigns ONCE — a second pass moves nothing, and reordering the list moves nothing either', () => {
    const s = st([{ id: 'a' }, { id: 'b' }]);
    ensureRulingNumbers(s);
    expect(ensureRulingNumbers(s)).toBe(0);
    s.decisions.reverse();
    ensureRulingNumbers(s);
    expect(s.decisions.find((d) => d.id === 'a').ruling).toBe('R1');
  });

  it('never reuses a retired number — a taken decision keeps R5 and the next one is R8', () => {
    const s = st([{ id: 'a', ruling: 'R5', status: 'taken' }, { id: 'b', ruling: 'R6' }, { id: 'c', ruling: 'R7' }], 8);
    s.decisions.push({ id: 'd' });
    ensureRulingNumbers(s);
    expect(s.decisions.at(-1).ruling).toBe('R8');
    expect(s.nextRuling).toBe(9);
  });

  it('skips a number that is somehow already in use rather than minting a duplicate', () => {
    const s = st([{ id: 'a', ruling: 'R1' }, { id: 'b' }], 1);
    ensureRulingNumbers(s);
    expect(s.decisions[1].ruling).toBe('R2');
  });

  it('backfills entries that predate the scheme, in list order', () => {
    const s = st([{ id: '2978' }, { id: '2908', ruling: 'R9' }, { id: '2691' }]);
    ensureRulingNumbers(s);
    expect(s.decisions.map((d) => d.ruling)).toEqual(['R1', 'R9', 'R2']);
  });

  it('resolves a decision by EITHER handle — the ruling number or the id it is filed under', () => {
    const s = st([{ id: '2978', ruling: 'R1' }]);
    expect(findDecision(s, 'R1').id).toBe('2978');
    expect(findDecision(s, 'r1').id).toBe('2978'); // the operator will not shift-key it
    expect(findDecision(s, '2978').ruling).toBe('R1');
    expect(findDecision(s, 'R9')).toBeNull();
  });

  it('renders BOTH handles — the number to answer with, the item number for the record', () => {
    const d = { id: '2691', ruling: 'R3', status: 'awaiting', question: 'Which tier?', options: [{ label: 'A', recommended: true }, { label: 'B' }], ifNothing: 'nothing' };
    const h = renderPage(buildModel({ ...SEED, items: [], decisions: [d] }, { fresh: true, fetchedAt: NOW, reason: null, rows: [] }));
    expect(h).toContain('<span class="rnum">R3</span>Which tier?');
    expect(h).toContain('answer as R3');
    expect(h).toContain('filed as #2691');
  });
});

/**
 * The template lives in exactly ONE place, and the realistic failure is not someone editing the HTML — it is
 * someone in a hurry hand-writing a page and publishing it to the board's URL. The marker makes that
 * detectable instead of merely forbidden.
 */
describe('the generated-page marker', () => {
  const real = () => renderPage(buildModel(SEED, { fresh: true, fetchedAt: NOW, reason: null, rows: [] }));

  it('accepts the script\'s own output', () => {
    const v = verifyPage(real());
    expect(v.ok).toBe(true);
    expect(v.reason).toMatch(/fingerprint [0-9a-f]{16}/);
  });

  it('rejects a hand-written page outright', () => {
    const v = verifyPage('<title>Progress board</title><p>three clears and three rulings, trust me</p>');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/NOT generated by the board script/);
  });

  it('rejects a page whose marker was copied onto edited content', () => {
    const h = real();
    const v = verifyPage(h.replace('Needs you', 'Needs you (hand-tweaked)'));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/does not match the page body/);
  });

  it('rejects a marker from a different schema, rather than trusting it', () => {
    const v = verifyPage(real().replace('schema=1', 'schema=99'));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/schema 99/);
  });

  it('counts the decisions in the marker, so a thinner page is visible from the marker alone', () => {
    expect(real()).toMatch(/decisions=1 /);
  });
});

/**
 * The context fields are NOT optional, and that is the point: optional context means the next entry goes in
 * as a bare title and the page slides back into a list of one-liners nobody can act on. The tool enforces it
 * so nobody has to remember it.
 */
describe('the enforced decision contract', () => {
  const complete = () => ({
    id: 'x',
    status: 'awaiting',
    title: 'X',
    question: 'Do we?',
    options: [{ label: 'Yes', recommended: true }, { label: 'No' }],
    ifNothing: 'nothing moves',
  });

  it('names every missing piece, and nothing when the decision is answerable', () => {
    expect(decisionGaps(complete())).toEqual([]);
    expect(decisionGaps({ ...complete(), question: undefined })[0]).toMatch(/^question/);
    expect(decisionGaps({ ...complete(), ifNothing: undefined })[0]).toMatch(/^ifNothing/);
    expect(decisionGaps({})).toHaveLength(3);
  });

  it('demands at least two options — one option is an announcement, not a decision', () => {
    expect(decisionGaps({ ...complete(), options: [{ label: 'Yes', recommended: true }] })[0]).toMatch(/at least two, this has 1/);
    expect(decisionGaps({ ...complete(), options: [] })[0]).toMatch(/at least two, this has 0/);
  });

  it('demands exactly one recommendation — none and two are both wrong', () => {
    expect(decisionGaps({ ...complete(), options: [{ label: 'Yes' }, { label: 'No' }] })[0]).toMatch(/exactly one option marked recommended/);
    expect(
      decisionGaps({ ...complete(), options: [{ label: 'Yes', recommended: true }, { label: 'No', recommended: true }] })[0],
    ).toMatch(/exactly one option marked recommended/);
  });

  it('does not hold `why` or `evidence` hostage — a hard rule there would only train people to type filler', () => {
    expect(decisionGaps({ ...complete(), why: undefined, evidence: undefined })).toEqual([]);
  });

  it('only judges what is being ASKED — draft, queued and taken are exempt', () => {
    const bare = { id: 'bare', title: 'Bare' };
    for (const status of ['draft', 'queued', 'taken']) {
      expect(validateDecisions({ decisions: [{ ...bare, status }] })).toEqual([]);
    }
    expect(validateDecisions({ decisions: [{ ...bare, status: 'awaiting' }] })).toHaveLength(1);
  });
});

// ── The CLI ───────────────────────────────────────────────────────────────────

describe('CLI verbs', () => {
  it('renders with no verb at all', () => {
    const r = cli();
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^✓ rendered/);
    expect(r.out.split('\n')).toHaveLength(1); // one line, nothing more
    expect(existsSync(outPath)).toBe(true);
  });

  it('--start moves an item to in-progress and re-renders', () => {
    expect(cli('--start=alpha').code).toBe(0);
    expect(state().items.find((i) => i.id === 'alpha')).toMatchObject({ status: 'in-progress', startedAt: '2026-08-08' });
    expect(page()).toContain('Alpha');
  });

  it('--start clears a blocker (this is how unblocking works)', () => {
    cli('--block=alpha', '--why=waiting on the gate');
    expect(state().items.find((i) => i.id === 'alpha').blocker).toBe('waiting on the gate');
    cli('--start=alpha');
    const it = state().items.find((i) => i.id === 'alpha');
    expect(it.status).toBe('in-progress');
    expect(it.blocker).toBeUndefined();
  });

  it('--done marks it done, and re-running never moves the recorded date', () => {
    cli('--done=alpha');
    const first = state().items.find((i) => i.id === 'alpha').doneAt;
    const r = spawnSync(process.execPath, [CLI, `--state=${statePath}`, `--out=${outPath}`, '--no-gh', '--done=alpha'], {
      encoding: 'utf8',
      env: { ...process.env, WE_BOARD_NOW: '2027-01-01T00:00:00.000Z', WE_BOARD_NO_GH: '1' },
    });
    expect(r.status).toBe(0);
    expect(state().items.find((i) => i.id === 'alpha').doneAt).toBe(first);
  });

  it('--block requires a reason and records it', () => {
    expect(cli('--block=alpha').code).toBe(1);
    const r = cli('--block=alpha', '--why=blocked on #984');
    expect(r.code).toBe(0);
    expect(state().items.find((i) => i.id === 'alpha')).toMatchObject({ status: 'blocked', blocker: 'blocked on #984' });
    expect(page()).toContain('blocked on #984');
  });

  it('--note sets a note and an empty --text clears it', () => {
    cli('--note=alpha', '--text=rebased onto main');
    expect(state().items.find((i) => i.id === 'alpha').note).toBe('rebased onto main');
    cli('--note=alpha', '--text=');
    expect(state().items.find((i) => i.id === 'alpha').note).toBeUndefined();
  });

  it('--add appends once — the same title twice is a no-op, not a duplicate', () => {
    cli('--add=Ship the drain rewrite', '--phase=1');
    expect(state().items.filter((i) => i.id === 'ship-the-drain-rewrite')).toHaveLength(1);
    const r = cli('--add=Ship the drain rewrite', '--phase=1');
    expect(r.out).toMatch(/already on the board/);
    expect(state().items.filter((i) => i.id === 'ship-the-drain-rewrite')).toHaveLength(1);
  });

  it('--decide takes a decision off the operator\'s section', () => {
    expect(cli('--decide=2978').code).toBe(0);
    expect(state().decisions[0]).toMatchObject({ status: 'taken', takenAt: '2026-08-08' });
    expect(page()).not.toContain('A decision');
  });

  it('--url stores the published artifact URL and prints it back on every later run', () => {
    cli('--url=https://claude.ai/public/artifacts/abc');
    expect(state().artifactUrl).toBe('https://claude.ai/public/artifacts/abc');
    expect(cli().out).toContain('https://claude.ai/public/artifacts/abc');
  });

  it('nags for the URL while none is stored', () => {
    expect(cli().out).toMatch(/no artifact URL stored yet/);
  });

  it('refuses an unknown id and names the ones it knows', () => {
    const r = cli('--start=nope');
    expect(r.code).toBe(1);
    expect(r.err).toContain('no item "nope"');
    expect(r.err).toContain('alpha');
  });

  it('renders byte-identically when nothing changed (safe to run on every pass)', () => {
    cli();
    const first = page();
    cli();
    expect(page()).toBe(first);
  });
});

/**
 * The decision verbs exist so the model NEVER hand-edits the state JSON — which is the only way the board
 * stays mechanical. Each one must be idempotent (a repeat re-states, never duplicates), must re-render, and
 * must print exactly one line.
 */
describe('CLI decision verbs', () => {
  const decision = (id = 'ship-it-or-not') => state().decisions.find((d) => String(d.id) === id);

  const ADD = ['--decision-add=Ship it or not', '--question=Do we ship the thing?', '--if-nothing=it never ships'];

  it('--decision-add lands as a DRAFT, and a repeat is a no-op', () => {
    const r = cli(...ADD);
    expect(r.code).toBe(0);
    expect(r.out.split('\n')).toHaveLength(1);
    expect(r.out).toMatch(/added decision ship-it-or-not \(draft\)/);
    // Draft, not awaiting: it has no options yet, so it is not answerable and must not reach the operator.
    expect(decision()).toMatchObject({ title: 'Ship it or not', question: 'Do we ship the thing?', ifNothing: 'it never ships', status: 'draft' });
    expect(page()).toContain('Decisions being prepared');

    const again = cli(...ADD);
    expect(again.out).toMatch(/already on the board: decision ship-it-or-not/);
    expect(state().decisions.filter((d) => d.id === 'ship-it-or-not')).toHaveLength(1);
  });

  it('--decision-add refuses a bare title — a title is not a decision', () => {
    const r = cli('--decision-add=Ship it or not');
    expect(r.code).toBe(1);
    expect(r.err).toContain('--question');
    expect(r.err).toContain('--if-nothing');
    expect(state().decisions).toHaveLength(1); // nothing was written
  });

  it('--decision-add --status=queued records an ALREADY-RULED call without demanding a question', () => {
    // Recording an answer is a different act from asking a question, and is not held to the same bar.
    const r = cli('--decision-add=Converge daemon scheduling', '--id=2572', '--status=queued');
    expect(r.code).toBe(0);
    expect(decision('2572')).toMatchObject({ id: '2572', title: 'Converge daemon scheduling', status: 'queued' });
    expect(page()).toContain('#2572');
    expect(page()).toContain('Ruled, queued');
  });

  it('--decision-add --status=awaiting is held to the full contract', () => {
    const r = cli(...ADD, '--status=awaiting');
    expect(r.code).toBe(1);
    expect(r.err).toContain('ship-it-or-not');
    expect(r.err).toMatch(/at least two/);
  });

  it('refuses to flip a half-built decision to awaiting, naming the id and every gap', () => {
    cli(...ADD);
    const r = cli('--decision-set=ship-it-or-not', '--field=status', '--value=awaiting');
    expect(r.code).toBe(1);
    expect(r.err).toContain('"ship-it-or-not"');
    expect(r.err).toMatch(/at least two/);
    expect(decision().status).toBe('draft'); // refused BEFORE anything was written

    cli('--decision-option=ship-it-or-not', '--label=Ship', '--detail=go', '--recommend');
    expect(cli('--decision-set=ship-it-or-not', '--field=status', '--value=awaiting').code).toBe(1); // still one option
    cli('--decision-option=ship-it-or-not', '--label=Hold', '--detail=wait');
    const ok = cli('--decision-set=ship-it-or-not', '--field=status', '--value=awaiting');
    expect(ok.code).toBe(0);
    expect(decision().status).toBe('awaiting');
  });

  it('refuses to RENDER a board carrying an unanswerable awaiting decision, naming the id and the field', () => {
    // The guard the verbs cannot provide: an entry that predates the rule, or one written around the CLI.
    writeFileSync(statePath, JSON.stringify({ ...SEED, decisions: [{ id: '2691', title: 'Legacy', status: 'awaiting', detail: 'one line' }] }));
    const r = cli();
    expect(r.code).toBe(1);
    expect(r.err).toContain('cannot be answered from the page');
    expect(r.err).toContain('"2691"');
    expect(r.err).toMatch(/missing question/);
    expect(r.err).toMatch(/ifNothing/);
    expect(r.err).toMatch(/--value=draft/); // and it says how to get unstuck
  });

  it('still SAVES the verb when the render is refused — otherwise the repair route is a deadlock', () => {
    writeFileSync(statePath, JSON.stringify({ ...SEED, decisions: [{ id: '2691', title: 'Legacy', status: 'awaiting' }] }));
    expect(cli('--decision-set=2691', '--field=question', '--value=What is it?').code).toBe(1); // still incomplete
    expect(state().decisions[0].question).toBe('What is it?'); // …but the edit landed
    expect(cli('--decision-set=2691', '--field=status', '--value=draft').code).toBe(0); // parking it clears the board
  });

  it('--decision-set writes one field, and an empty --value clears it', () => {
    cli('--decision-set=2978', '--field=why', '--value=the two sessions share an id');
    expect(state().decisions[0].why).toBe('the two sessions share an id');
    expect(page()).toContain('the two sessions share an id');
    cli('--decision-set=2978', '--field=why', '--value=');
    expect(state().decisions[0].why).toBeUndefined();
  });

  it('--decision-set is idempotent — setting the same value twice changes nothing', () => {
    cli('--decision-set=2978', '--field=ifNothing', '--value=nothing lands');
    const first = JSON.stringify(state());
    cli('--decision-set=2978', '--field=ifNothing', '--value=nothing lands');
    expect(JSON.stringify(state())).toBe(first);
  });

  it('--decision-set refuses a field with no verb and a status outside the lifecycle', () => {
    const bad = cli('--decision-set=2978', '--field=options', '--value=nope');
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('own verbs');
    const worse = cli('--decision-set=2978', '--field=status', '--value=maybe');
    expect(worse.code).toBe(1);
    expect(worse.err).toContain(DECISION_STATUSES.join(', '));
    expect(DECISION_FIELDS).toContain('question');
  });

  it('--decision-set=queued takes a RULED decision out of "needs you" without hiding it', () => {
    cli('--decision-set=2978', '--field=status', '--value=queued');
    const r = cli();
    expect(r.out).toContain('(0 needs you'); // ruled, therefore not an ask
    expect(page()).toContain('Ruled, queued');
    expect(page()).toContain('A decision');
  });

  it('--decision-option appends, and the same label twice updates rather than duplicates', () => {
    const before = state().decisions[0].options.length;
    cli('--decision-option=2978', '--label=Do it', '--detail=costs a session');
    cli('--decision-option=2978', '--label=Drop it', '--detail=costs nothing');
    expect(state().decisions[0].options).toHaveLength(before + 2);
    const r = cli('--decision-option=2978', '--label=Do it', '--detail=costs a session');
    expect(r.out).toMatch(/option updated on 2978: Do it/);
    expect(state().decisions[0].options).toHaveLength(before + 2);
    expect(page()).toContain('costs a session');
  });

  it('--recommend marks exactly one option, and a second --recommend MOVES it', () => {
    cli('--decision-option=2978', '--label=Do it', '--detail=a', '--recommend');
    cli('--decision-option=2978', '--label=Drop it', '--detail=b');
    expect(state().decisions[0].options.filter((o) => o.recommended)).toHaveLength(1);
    cli('--decision-option=2978', '--label=Drop it', '--recommend');
    const recs = state().decisions[0].options.filter((o) => o.recommended);
    expect(recs.map((o) => o.label)).toEqual(['Drop it']);
    expect(page().match(/class="chip ok">recommended</g)).toHaveLength(1);
  });

  it('--decision-option demands a label', () => {
    const r = cli('--decision-option=2978', '--detail=orphaned');
    expect(r.code).toBe(1);
    expect(r.err).toContain('--label');
  });

  it('--decision-evidence appends, dedups the same text, and an empty --text clears all of it', () => {
    cli('--decision-evidence=2978', '--text=row 3 currently PASSES');
    const again = cli('--decision-evidence=2978', '--text=row 3 currently PASSES');
    expect(again.out).toMatch(/evidence already on 2978/);
    expect(state().decisions[0].evidence).toEqual(['row 3 currently PASSES']);
    cli('--decision-evidence=2978', '--text=and row 4 does not');
    expect(state().decisions[0].evidence).toHaveLength(2);
    expect(page()).toContain('and row 4 does not');
    cli('--decision-evidence=2978', '--text=');
    expect(state().decisions[0].evidence).toBeUndefined();
  });

  it('names the decisions it knows when the id is wrong', () => {
    const r = cli('--decision-set=nope', '--field=why', '--value=x');
    expect(r.code).toBe(1);
    expect(r.err).toContain('no decision "nope"');
    expect(r.err).toContain('2978');
  });

  it('numbers every decision on the first run and never moves one afterwards', () => {
    cli();
    expect(state().decisions[0].ruling).toBe('R1');
    expect(state().nextRuling).toBe(2);
    cli(...ADD);
    expect(decision().ruling).toBe('R2');
    const before = JSON.stringify(state());
    cli();
    expect(JSON.stringify(state())).toBe(before); // the backfill is a one-time migration, not a per-run write
    expect(page()).toContain('<span class="rnum">R1</span>');
  });

  it('takes a verb by the ruling number the operator would actually type', () => {
    cli();
    expect(cli('--decide=R1').code).toBe(0);
    expect(state().decisions[0].status).toBe('taken');
    expect(cli('--decision-set=r1', '--field=detail', '--value=via the lowercase form').code).toBe(0);
    expect(state().decisions[0].detail).toBe('via the lowercase form');
  });

  it('names both handles when the id is wrong, so either one can be found', () => {
    cli();
    const r = cli('--decide=R99');
    expect(r.code).toBe(1);
    expect(r.err).toContain('R1/2978');
  });

  it('refuses an --id in the R-number namespace — those are the board\'s to hand out', () => {
    const r = cli('--decision-add=Squatter', '--id=R4', '--question=Q?', '--if-nothing=nothing');
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/reserved/);
  });

  it('--verify says yes to its own output and no to a hand-written page', () => {
    cli();
    const good = spawnSync(process.execPath, [CLI, `--verify=${outPath}`], { encoding: 'utf8' });
    expect(good.status).toBe(0);
    expect(good.stdout).toContain('is the generated board');

    const fake = join(sandbox, 'handrolled.html');
    writeFileSync(fake, '<title>Progress board</title><p>trust me</p>');
    const bad = spawnSync(process.execPath, [CLI, `--verify=${fake}`], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('is NOT the generated board');
  });

  it('--decide still means TAKEN — the decision leaves the board entirely', () => {
    cli('--decision-set=2978', '--field=question', '--value=Do we?');
    cli('--decide=2978');
    expect(state().decisions[0]).toMatchObject({ status: 'taken' });
    expect(page()).not.toContain('Do we?');
    expect(page()).not.toContain('Ruled, queued');
  });

  it('re-rendering after the decision verbs is still byte-stable', () => {
    cli();
    const first = page();
    cli();
    expect(page()).toBe(first);
  });
});

describe('degradation when gh is unavailable', () => {
  it('still renders, with an empty pull-request half and a stale banner', () => {
    const r = cli();
    expect(r.code).toBe(0);
    expect(r.out).toContain('PR state STALE');
    expect(page()).toContain('class="banner"');
    expect(page()).toContain('Nothing landed yet.'); // no pull-request rows at all…
    expect(page()).toContain('A decision'); // …but the hand-maintained half still renders in full
  });

  it('serves the last good snapshot when one was cached', () => {
    writeFileSync(
      join(sandbox, '.progress-board-cache.json'),
      JSON.stringify({
        fetchedAt: '2026-08-07T09:00:00.000Z',
        rows: [{ number: 1099, title: 'Cached pull request', labels: ['review:human'], status: 'needs-human', detail: '' }],
      }),
    );
    const r = cli();
    expect(r.code).toBe(0);
    expect(page()).toContain('Cached pull request');
    expect(page()).toContain('snapshot from 2026-08-07 09:00 UTC');
    rmSync(join(sandbox, '.progress-board-cache.json'));
  });
});

/**
 * `--out=` and `--state=` are the only paths a caller controls. Nothing in the state file or the GitHub data
 * reaches them, so this is not hostile-content-reachable — but an unguarded primitive that can overwrite a
 * tracked repo file is worth closing. The rule is deliberately narrow, because writing OUTSIDE the repo is
 * legitimate and in active use: the board is published from a scratchpad path.
 */
describe('path containment', () => {
  const REPO = join(ROOT, 'scripts', 'progress-board.mjs'); // any tracked file will do

  it('refuses a path inside the repository but outside reports/', () => {
    expect(() => assertWritablePath('./DECOY_TRACKED.json', '--out')).toThrow(/inside the repository/);
    expect(() => assertWritablePath(join(ROOT, 'package.json'), '--state')).toThrow(/only write/);
    // `..` out of an allowed directory is the same case and must not be a hole.
    expect(() => assertWritablePath(join(ROOT, 'reports', '..', 'package.json'), '--out')).toThrow(/inside the repository/);
  });

  it('allows reports/, where the board actually lives', () => {
    expect(assertWritablePath(join(ROOT, 'reports', 'progress-board.html'), '--out')).toBe(join(ROOT, 'reports', 'progress-board.html'));
    expect(assertWritablePath('reports/nested/deep.html', '--out')).toContain(join('reports', 'nested', 'deep.html'));
  });

  it('allows a path outside the repository entirely — the publish workflow depends on it', () => {
    expect(assertWritablePath(join(sandbox, 'board.html'), '--out')).toContain('board.html');
    expect(() => assertWritablePath(join(sandbox, 'state.json'), '--state')).not.toThrow();
  });

  it('the CLI refuses it too, and writes nothing', () => {
    const r = spawnSync(process.execPath, [CLI, `--state=${statePath}`, '--out=./DECOY_TRACKED.json', '--no-gh'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('refusing --out=');
    expect(existsSync(join(ROOT, 'DECOY_TRACKED.json'))).toBe(false);
    expect(readFileSync(REPO, 'utf8').length).toBeGreaterThan(0);
  });
});

/**
 * The `gh` half already degrades rather than dying; the hand-maintained half has to as well. The realistic
 * trigger is not exotic — the state file is git-tracked, so an unresolved merge-conflict marker makes it
 * invalid JSON, and crashing there loses the whole page over a fixable typo.
 */
describe('degradation when the state file is malformed', () => {
  const broken = (text) => {
    writeFileSync(statePath, text);
    return cli();
  };

  it('renders anyway when the file is not valid JSON, and says so on the PAGE, not only on stderr', () => {
    const r = broken('<<<<<<< HEAD\n{ "title": "x" }\n=======\n');
    expect(r.code).toBe(0);
    expect(r.out).toContain('STATE FILE UNREADABLE');
    expect(existsSync(outPath)).toBe(true);
    expect(page()).toContain('class="banner crit"');
    expect(page()).toContain('The plan and decisions could not be read');
    expect(page()).toContain('is not valid JSON');
  });

  it('renders anyway when items or decisions hold the wrong type', () => {
    const r = broken(JSON.stringify({ title: 'T', items: 'not an array', decisions: { a: 1 } }));
    expect(r.code).toBe(0);
    expect(r.out).toContain('STATE FILE UNREADABLE');
    expect(page()).toContain('wrong type for: items, decisions');
  });

  it('drops non-object entries rather than choking on them', () => {
    writeFileSync(statePath, JSON.stringify({ title: 'T', items: [{ id: 'a', title: 'A', status: 'todo' }, 'junk', null], decisions: [] }));
    const s = loadState(statePath);
    expect(s.items.map((i) => i.id)).toEqual(['a']);
    expect(s[STATE_ERROR]).toMatch(/entries that were not objects/);
  });

  it('REFUSES to apply a verb to an unreadable file — an empty save would destroy a recoverable plan', () => {
    const text = '{ not json';
    writeFileSync(statePath, text);
    const r = cli('--done=alpha');
    expect(r.code).toBe(1);
    expect(r.err).toContain('refusing to write');
    expect(readFileSync(statePath, 'utf8')).toBe(text); // byte-for-byte untouched
  });

  it('does NOT swallow the decision contract — a well-formed file with a half-decision still exits non-zero', () => {
    // Two different failures that must stay different: unreadable degrades, unanswerable refuses.
    writeFileSync(statePath, JSON.stringify({ ...SEED, decisions: [{ id: '2978', title: 'A decision', status: 'awaiting' }] }));
    const r = cli();
    expect(r.code).toBe(1);
    expect(r.err).toContain('"2978"');
    expect(r.err).toContain('cannot be answered from the page');
    expect(r.err).not.toContain('STATE FILE UNREADABLE');
  });

  it('a missing state file is not an error at all — it is a fresh board', () => {
    rmSync(statePath);
    const r = cli();
    expect(r.code).toBe(0);
    expect(r.out).not.toContain('STATE FILE UNREADABLE');
    expect(page()).toContain('Nothing is waiting on you.');
  });
});

describe('pure helpers', () => {
  it('slugifies a title into a stable id', () => {
    expect(slugify('Ship the drain rewrite!')).toBe('ship-the-drain-rewrite');
    expect(slugify('  ')).toBe('item');
  });

  it('applyVerb rejects a verb it does not know', () => {
    expect(() => applyVerb({ items: [], decisions: [] }, 'teleport', {})).toThrow(/unknown verb/);
  });
});
