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
import { classifyPr, ciFailed, ciPending, buildModel, renderPage, applyVerb, slugify, PR_STATUS } from '../progress-board.mjs';

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
  decisions: [{ id: '2978', title: 'A decision', status: 'awaiting' }],
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

  it('emits an Artifact-ready fragment — a title, no document skeleton', () => {
    const h = html();
    expect(h).toMatch(/^<title>/);
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

describe('pure helpers', () => {
  it('slugifies a title into a stable id', () => {
    expect(slugify('Ship the drain rewrite!')).toBe('ship-the-drain-rewrite');
    expect(slugify('  ')).toBe('item');
  });

  it('applyVerb rejects a verb it does not know', () => {
    expect(() => applyVerb({ items: [], decisions: [] }, 'teleport', {})).toThrow(/unknown verb/);
  });
});
