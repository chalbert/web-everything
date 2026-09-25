/**
 * @file priority-sync-real.test.mjs — the REAL mechanism of `priority-sync` (#2949): a real git repo holding a
 * tracker card and cards, the real command line (`run.mjs priority-sync`) run in a dry run and then with
 * `--apply`, the real loader in its child process, and afterwards the real `check-priority --strict` gate.
 *
 * The repo has an older checkout (the "prototype branch") and a newer `main`: the branch lists two cards, and `main`
 * has since resolved one, filed two, claimed one and landed a PR naming another. Running from the branch with
 * `--ref=main` must fix exactly that, write nothing else, and never commit.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withRealRepo } from './helpers/real-repo.mjs';
import { extractSectionText, parseSection, UNWRITTEN_WHY } from '../priority-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const RUN = join(REPO, 'scripts', 'operations', 'run.mjs');
const TRACKER = join(REPO, 'scripts', 'prototype-tracker.mjs');

const frontmatter = (o) => `---\n${Object.entries({ kind: 'story', size: 3, status: 'open', parent: '3383', dateOpened: '"2026-09-01"', ...o })
  .filter(([, v]) => v !== undefined && v !== null)
  .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => `"${x}"`).join(', ')}]` : v}`).join('\n')}\n---\n`;
const cardFile = (title, o = {}, body = 'One line of body.\n') => `${frontmatter(o)}\n# ${title}\n\n${body}`;

const TRACKER_BODY = [
  '# Tracker', '', '## Priority order', '',
  'Updated: 2026-09-20 by fixture — old reason. Derived by the rules below from the ranker. Whoever files a card updates this section.', '',
  '**Rules — re-apply exactly as written.**', '',
  '0. **The mechanised system first.** Prose that names #3999 is not an entry.', '',
  '**Health chain (rule 1) — before every band**', '',
  '**Delegation to Codex and Antigravity (operator priority) — before band A**', '',
  '**Band A — dispatchable now**', '',
  '1. #3600 · 3 · A · Clears: the manual step a.',
  '2. #3601 · 3 · A · Clears: the manual step b.', '',
  '**Band B — design first (uncleared)**', '',
  '**Band C — needs an operator ruling**', '',
  '**Claimed (`status: active`) — listed, not ordered**', '',
  '**Off-path, not ordered — not #3383 cards.** Listed so nothing is silently dropped.', '',
  '## Session update (2026-09-20) — a later section stays untouched', '', 'Body that names #3700.', '',
].join('\n');

/**
 * One scenario, on a fresh real repo (`withRealRepo`): the older "prototype branch" state committed on `main`,
 * branched as `lane/proto`; then `main` moves on and the branch is checked out again. `fn` gets the repo, a `run`
 * that spawns a real command in it, and the tracker path.
 */
function scenario(fn) {
  return withRealRepo(async (ctx) => {
    const { root, tmp, commit } = ctx;
    const sh = ctx.git;
    const env = { ...process.env, OPERATION_RUNS_DIR: join(tmp, 'runs'), OPERATION_CALLS_DIR: join(tmp, 'calls'), GIT_CONFIG_GLOBAL: '/dev/null' };

    // The older state: the prototype branch's own cards.
    commit({
      'backlog/3383-tracker.md': `${frontmatter({ kind: 'epic', status: 'active', parent: '"3029"' })}\n${TRACKER_BODY}`,
      'backlog/3600-first-card.md': cardFile('First card'),
      'backlog/3601-second-card.md': cardFile('Second card'),
    }, 'base: the prototype branch');
    sh(['branch', 'lane/proto']);

    // main moves on: resolves #3601, files #3700 (design to settle), #3701 (a decision), #3702 (claimed),
    // #3703 (out of tree), #3704 (blocked by #3700), and lands a PR that names #3600 without resolving it.
    commit({
      'backlog/3601-second-card.md': cardFile('Second card', { status: 'resolved', dateResolved: '"2026-09-21"' }),
      'backlog/3700-new-design-card.md': cardFile('New design card', { size: 5 }, 'FIX: a thing. DESIGN TO SETTLE: which way. ACCEPTANCE: y.\n'),
      'backlog/3701-new-decision.md': cardFile('New decision', { kind: 'decision', size: undefined }, 'A fork.\n'),
      'backlog/3702-new-claimed.md': cardFile('New claimed card', { status: 'active', dateStarted: '"2026-09-21"' }),
      'backlog/3703-elsewhere.md': cardFile('Card elsewhere', { parent: '"3054"' }),
      'backlog/3704-plain.md': cardFile('Plain new card', { size: 2, blockedBy: ['3700'] }),
    }, 'backlog: file the new cards');
    sh(['commit', '--quiet', '--allow-empty', '-m', 'Merge pull request #2400 from someone/lane/3600-first-card']);
    sh(['checkout', '--quiet', 'lane/proto']);

    const run = (args, cmd = RUN, cwd = root) => spawnSync(process.execPath, [cmd, ...args], { cwd, env, encoding: 'utf8', timeout: 170_000 });
    return fn({ ...ctx, sh, run, env, trackerPath: join(root, 'backlog', '3383-tracker.md') });
  });
}

describe('priority-sync against a real repository', () => {
  it('a dry run prints the plan as a diff, writes nothing, and never commits', () => scenario(({ sh, run, trackerPath }) => {
    const before = readFileSync(trackerPath, 'utf8');
    const head = sh(['rev-parse', 'HEAD']).trim();
    const r = run(['priority-sync', '--ref=main', '--date=2026-09-21']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('priority-sync: dry run — 4 added, 1 dropped, 0 moved, 0 renamed, 1 flagged; 0 existing lines renumbered');
    expect(r.stdout).toMatch(/^\+ 2\. #3700 · 5 · B · why: \(unwritten\)/m);
    expect(r.stdout).toMatch(/^\+ 4\. #3701 · decision · C · why: \(unwritten\)/m);
    expect(r.stdout).toMatch(/^\+ 3\. #3704 · 2 · B · why: \(unwritten\)/m); // band B, because its blocker #3700 is band B
    expect(r.stdout).toMatch(/^\+ - #3702 · 3 · claimed · why: \(unwritten\)/m);
    expect(r.stdout).toMatch(/^- 2\. #3601 · 3 · A · Clears: the manual step b\.   \[resolved\]/m);
    expect(r.stdout).toContain('! landed-open: #3600 landed but still open: resolve it');
    expect(r.stdout).not.toContain('#3703'); // outside the tree and with no line: not the operation's business
    expect(r.stdout).toContain('dry run: nothing written');
    expect(readFileSync(trackerPath, 'utf8')).toBe(before);
    expect(sh(['rev-parse', 'HEAD']).trim()).toBe(head);
    expect(sh(['status', '--porcelain']).trim()).toBe('');
  }), 240_000);

  it('--json carries the same plan as data', () => scenario(({ run }) => {
    const r = run(['priority-sync', '--ref=main', '--date=2026-09-21', '--json']);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.verdict.counts).toEqual({ added: 4, dropped: 1, moved: 0, renamed: 0, flagged: 1, renumbered: 0 });
    expect(out.verdict.added.map((a) => [a.id, a.band])).toEqual([['3700', 'B'], ['3704', 'B'], ['3701', 'C'], ['3702', 'claimed']]);
    expect(out.verdict.flagged).toMatchObject([{ kind: 'landed-open', id: '3600' }]);
    expect(out.findings.read.ranker).toBe('loader');
  }), 240_000);

  it('--apply rewrites only the section in place; the gate then passes and only warns about the unwritten lines; a second run is a no-op', () => scenario(({ sh, run, trackerPath }) => {
    const head = sh(['rev-parse', 'HEAD']).trim();
    const beforeText = readFileSync(trackerPath, 'utf8');
    const applied = run(['priority-sync', '--ref=main', '--date=2026-09-21', '--apply']);
    expect(applied.status).toBe(0);
    expect(applied.stdout).toContain('priority-sync: APPLIED');
    expect(applied.stdout).toContain('nothing committed or pushed');

    const after = readFileSync(trackerPath, 'utf8');
    expect(after).not.toBe(beforeText);
    // Only the section moved: the frontmatter and the later session-update section are byte-identical.
    expect(after.slice(0, after.indexOf('## Priority order'))).toBe(beforeText.slice(0, beforeText.indexOf('## Priority order')));
    expect(after.slice(after.indexOf('## Session update'))).toBe(beforeText.slice(beforeText.indexOf('## Session update')));
    const sec = parseSection(extractSectionText(after));
    const ordered = sec.lines.filter((l) => l.type === 'ordered').map((l) => [l.n, l.id, l.block]);
    expect(ordered).toEqual([[1, '3600', 'A'], [2, '3700', 'B'], [3, '3704', 'B'], [4, '3701', 'C']]);
    expect(sec.lines.filter((l) => l.type === 'claimed').map((l) => l.id)).toEqual(['3702']);
    expect(after).toContain('Updated: 2026-09-21 by delivery worker `priority-sync` — added 4, dropped 1, moved 0, flagged 1, renumbered 0;');
    expect(after).toContain('Derived by the rules below from the ranker.');
    expect(after).toContain('1. #3600 · 3 · A · Clears: the manual step a.'); // existing prose untouched

    // Nothing was committed or staged: the one change is the tracker card in the working tree.
    expect(sh(['rev-parse', 'HEAD']).trim()).toBe(head);
    expect(sh(['status', '--porcelain']).trim()).toBe('M backlog/3383-tracker.md');

    // The real gate, from the same checkout: no drift; the unwritten lines only warn.
    const gate = run(['check-priority', '--ref=main', '--strict'], TRACKER);
    expect(gate.status).toBe(0);
    expect(gate.stdout).toContain('priority order OK');
    expect(gate.stdout).toMatch(/4 line\(s\) still unwritten \(warn only/);
    expect(gate.stdout).toContain(`still carries "${UNWRITTEN_WHY}"`);
    expect(run(['check-priority', '--ref=main', '--strict', '--strict-why'], TRACKER).status).toBe(1);

    // A second run finds the section in sync: nothing to write, and the landed card is still flagged.
    const again = run(['priority-sync', '--ref=main', '--date=2026-09-22', '--apply']);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('0 added, 0 dropped, 0 moved, 0 renamed, 1 flagged; 0 existing lines renumbered');
    expect(again.stdout).toContain('the section is already in sync: nothing to write');
    expect(readFileSync(trackerPath, 'utf8')).toBe(after);
  }), 480_000);

  it('refuses from a directory that holds no tracker card, with its own words', () => scenario(({ tmp, run }) => {
    const empty = join(tmp, 'elsewhere');
    mkdirSync(join(empty, 'backlog'), { recursive: true });
    const r = run(['priority-sync', '--ref=main'], RUN, empty);
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/no backlog\/3383-\*\.md/);
  }), 120_000);
});
