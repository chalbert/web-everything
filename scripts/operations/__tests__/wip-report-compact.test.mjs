/**
 * #3736: the COMPACT-TABLES default of the `/wip` report (made for a phone held vertically), the stacked-bullets fallback
 * (`--bullets` / `WIP_REPORT_STYLE=bullets`) kept byte-for-byte, and the CLI switches. Fixture: the real state of 2026-09-20.
 */
import { it, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeInput, buildReport, renderReport, renderCompact, renderBullets, tableRow, mdTable, shortState, ROW_MAX, TITLE_MAX } from '../wip-report.mjs';
import { main } from '../wip-report-cli.mjs';

const RAW = JSON.parse(readFileSync(resolve('scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json'), 'utf8'));
const SNAPSHOT = readFileSync(resolve('scripts/operations/__fixtures__/wip-report/bullets-2026-09-20.txt'), 'utf8');
const LIVE = { state: 'alive-and-idle' }, DOWN = { state: 'down', stalledReason: 'No singleton runner lease exists; no runner is registered.' };

/** The fixture with `review-148` blocked for two hours (the shape the operator saw), under a chosen runner. */
function stalled(runner = DOWN) {
  const raw = structuredClone(RAW);
  const s = raw.wipData.agents.find((a) => a.name === 'review-148');
  raw.wipData.facts[s.sessionId].transcriptMtimeMs = raw.now - 130 * 60000;
  raw.runner = runner;
  return raw;
}
/** Two PRs under review with a live review session each, and nothing else wrong. */
function reviewing() {
  const label = (...n) => n.map((name) => ({ name }));
  const raw = { now: Date.parse('2026-09-20T17:07:00Z'), runner: LIVE, operatorQueueText: 'NEEDS YOU (x):\n(none)\nPENDING — y:\n(none)\n', completions: [], errors: [], merged: [],
    wipData: { agents: [], facts: {} }, landInputs: { prs: [], sessions: [], cap: 3, freeLanes: 9, load: 0.2, loadThreshold: 1.5 } };
  const pr = (number) => ({ repo: 'we', slug: 'chalbert/web-everything', number, title: `A very long title for PR ${number} that must be cut to fit a phone screen`, labels: label('review:pending', 'review-status:reviewing'),
    baseRefName: 'main', createdAt: '2026-09-20T14:00:00Z', updatedAt: '2026-09-20T14:30:00Z', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', isDraft: false });
  raw.landInputs.prs = [pr(2344), pr(2349)];
  raw.wipData = { agents: [2344, 2349].map((n) => ({ id: `a${n}`, sessionId: `s${n}`, kind: 'background', name: `review-${n}`, state: 'working', status: 'busy', pid: n, startedAt: raw.now - 1800000 })),
    facts: Object.fromEntries([2344, 2349].map((n) => [`s${n}`, { pidAlive: true, transcriptMtimeMs: raw.now - 60000, resultFiles: [] }])) };
  return raw;
}
const report = (raw) => buildReport(composeInput(raw));
const SCENARIOS = { 'tonight, runner not live': () => stalled(DOWN), 'tonight, runner live (queued / gaps / overdue)': () => stalled(LIVE), 'two reviewing PRs': reviewing };
const capture = () => { const out = { stdout: '', stderr: '' }; return { out, stdout: (s) => { out.stdout += s; }, stderr: (s) => { out.stderr += s; } }; };
const cols = (row) => row.replace(/^\||\|$/g, '').split('|').length;

describe('tableRow / mdTable: the compact-table renderer', () => {
  it('a row is unpadded cells between pipes, with exactly the columns it was given', () => {
    expect(tableRow(['we#2349', 'Fix the thing', 'fixing'], 1)).toBe('|we#2349|Fix the thing|fixing|');
    expect(cols(tableRow(['a', 'b', 'c'], 1))).toBe(3);
    expect(cols(tableRow(['a', 'b'], 1))).toBe(2);
  });
  it('a row is never wider than 35 characters, whatever the cells hold', () => {
    const long = 'x'.repeat(80);
    for (const cells of [[long, long, long], ['we#2349', long, 'blocked'], [long, 'short', long], ['↳', long, 'stalled'], ['', long, ''], ['a|b', 'c|d', 'e|f']]) {
      for (let flex = 0; flex < 3; flex++) expect(tableRow(cells, flex).length).toBeLessThanOrEqual(ROW_MAX);
    }
    expect(ROW_MAX).toBe(35);
  });
  it('cuts a title to about 18 characters with an ellipsis, and leaves a short one whole', () => {
    const row = tableRow(['we#2349', 'Decision Docket: render every text field', 'review'], 1);
    expect(row).toBe('|we#2349|Decision Docket:…|review|');
    expect(row.split('|')[2].length).toBeLessThanOrEqual(TITLE_MAX);
    expect(row.split('|')[2].length).toBeGreaterThanOrEqual(TITLE_MAX - 2);
    expect(tableRow(['we#2349', 'Short title', 'review'], 1)).toContain('|Short title|');
    expect(TITLE_MAX).toBe(18);
  });
  it('cuts the title further when the other cells leave less room, before touching them', () => {
    const row = tableRow(['plateau-app#148', 'A long title that is cut', 'blocked'], 1);
    expect(row.length).toBeLessThanOrEqual(ROW_MAX);
    expect(row).toContain('|plateau-app#148|');
    expect(row).toContain('|blocked|');
    expect(row.split('|')[2].endsWith('…')).toBe(true);
  });
  it('a pipe inside a cell cannot add a column, and a newline cannot add a row', () => {
    const row = tableRow(['a|b', 'c\nd', 'e'], 1);
    expect(cols(row)).toBe(3);
    expect(row).not.toContain('\n');
  });
  it('mdTable is the header row, a separator row of the same width in columns, then the rows, with no blank line', () => {
    const t = mdTable(['item', 'title', 'state'], [['we#1', 'One', 'fixing'], ['we#2', 'Two', 'review']], 1);
    expect(t).toEqual(['|item|title|state|', '|-|-|-|', '|we#1|One|fixing|', '|we#2|Two|review|']);
    expect(t.every((l) => cols(l) === 3 && l.length <= ROW_MAX)).toBe(true);
  });
  it('shortState keeps the closed vocabulary within 8 characters and moves the reason to a note', () => {
    const closed = ['reviewing', 'waiting-for-reviewer', 'fixing', 'waiting-CI', 'waiting-merge', 'needs-operator', 'landed', 'unknown', 'working', 'idle', 'stalled', 'queued'];
    for (const s of closed) expect(shortState(s)).toEqual({ short: expect.any(String), detail: null });
    for (const s of [...closed, 'blocked-on:merge conflict', 'blocked on a permission prompt', 'waiting on the CI', 'something new and long']) expect(shortState(s).short.length).toBeLessThanOrEqual(8);
    expect(shortState('blocked-on:drain (stuck: ci:failed)')).toEqual({ short: 'blocked', detail: 'blocked on drain (stuck: ci:failed)' });
    expect(shortState('blocked on a permission prompt')).toEqual({ short: 'blocked', detail: 'blocked on a permission prompt' });
    expect(shortState('waiting on the CI')).toEqual({ short: 'waiting', detail: 'waiting on the CI' });
    expect(shortState('brand new state').detail).toBe('brand new state');
  });
});

describe.each(Object.entries(SCENARIOS))('vertical space, %s', (_n, make) => {
  const r = report(make()), text = renderReport(r), lines = text.split('\n'), bullets = renderReport(r, { style: 'bullets' });
  const tableLines = lines.filter((l) => l.startsWith('|'));

  it('has tables, and every table row is at most 35 characters and at most 3 columns', () => {
    expect(tableLines.length).toBeGreaterThan(4);
    expect(tableLines.filter((l) => l.length > ROW_MAX)).toEqual([]);
    expect(tableLines.filter((l) => cols(l) > 3)).toEqual([]);
  });
  it('has no blank line inside a table, and a table starts on the line right after its heading', () => {
    const blocks = [];
    lines.forEach((l, i) => { if (l.startsWith('|')) { if (blocks.at(-1)?.end === i - 1) blocks.at(-1).end = i; else blocks.push({ start: i, end: i }); } });
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of blocks) {
      expect(lines.slice(b.start, b.end + 1).every((l) => l.startsWith('|'))).toBe(true);
      expect(lines[b.start - 1]).toMatch(/^## /);
      expect(lines[b.start + 1]).toMatch(/^\|(-\|)+$/);
    }
  });
  it('has at most one blank line between sections, and only right before a section heading', () => {
    expect(text).not.toMatch(/\n\n\n/);
    lines.forEach((l, i) => { if (l === '') expect(lines[i + 1]).toMatch(/^## /); });
    expect(lines.filter((l) => l === '')).toHaveLength(lines.filter((l) => l.startsWith('## ')).length);
    expect(text.startsWith('\n')).toBe(false);
    expect(text.endsWith('\n')).toBe(false);
  });
  it('has fewer lines than the stacked-bullets output for the same report', () => {
    expect(lines.length).toBeLessThan(bullets.split('\n').length);
  });
  it('keeps the same sections in the same order as the bullets style, and the same Needs you text', () => {
    const heads = (t) => t.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.replace(/^(## Done since).*/, '$1'));
    expect(heads(text)).toEqual(heads(bullets));
    expect(text.split('## Needs you\n')[1]).toBe(bullets.split('## Needs you\n')[1]);
  });
  it('is byte-identical for identical input', () => expect(renderReport(report(make()))).toBe(text));
});

describe('the compact report, section by section', () => {
  it('header: plain lines with no bullet marker, and `runner not live` says nothing is auto-handled', () => {
    const t = renderReport(report(stalled(DOWN)));
    expect(t.split('\n').slice(0, 6)).toEqual([
      '2026-09-20 10:57 EDT', 'load 8.21 on 12 cores · workers 3 of 3', 'runner not live: nothing auto-handled',
      'old PRs: 3, oldest plateau-app#148 (12d', '  19h)', 'queue: none (checked 10:57)']);
  });
  it('Attention (runner not live): only what still waits for a person is a table row: finding, since, remedy', () => {
    const t = renderReport(report(stalled(DOWN))), rows = t.split('## Work items')[0].split('\n').filter((l) => l.startsWith('|'));
    expect(rows).toEqual(['|finding|since|remedy|', '|-|-|-|', '|conflict we#2344|44m|auto:down|', '|changes we#2170|16h|auto:down|', '|changes we#2344|44m|auto:down|',
      '|stale tag pa#148|2h|auto:down|', '|stale tag we#2344|44m|auto:down|', '|unreaped x8|2h|run reaper|', '|runner down|?|/conveyor|']);
    expect(t.replace(/\n {2,}/g, ' ')).toContain('- 4 gaps queued (ci-failed-no-fixer:we#2349, session-stalled:review-148, session-stalled:fix-2347, pre-today-pr-open)');
  });
  it('Attention (runner live): every finding left the table, `queued` rows appear under Work items, and one gaps line names the plan', () => {
    const r = report(stalled(LIVE)), t = renderReport(r), attention = t.split('## Work items')[0], work = t.split('## Work items')[1].split('## Done since')[0];
    expect(attention.split('\n').filter((l) => l.startsWith('|'))).toEqual([]);
    expect(attention).not.toContain('Nothing needs attention.');
    expect(attention.replace(/\n {2,}/g, ' ')).toContain('- 4 gaps queued (ci-failed-no-fixer:we#2349, session-stalled:review-148, session-stalled:fix-2347, pre-today-pr-open)');
    expect(work).toContain('|we#2344|conflict fix+revi…|queued|');
    expect(work).toContain('|we#2170|review fix|queued|');
    expect(work).toContain('|unreaped x8|reap|queued|');
    expect(work.split('\n').filter((l) => l.startsWith('|') && l.endsWith('|queued|'))).toHaveLength(r.queue.handledRows.length);
  });
  it('Attention (runner live): an overdue finding gets ONE line naming its key, and a fresh one gets none', () => {
    const t = renderReport(report(stalled(LIVE))).replace(/\n {2,}/g, ' ');
    expect(t).toContain('- overdue 16h 58m: changes-requested-no-fixer:we#2170');
    expect(t).toContain('- overdue 2h 10m: session-stalled:review-148');
    expect(t).not.toMatch(/overdue [^:]*: session-stalled:fix-2347/);
  });
  it('says nothing needs attention only when nothing is shown, queued as a gap, or overdue', () => {
    expect(renderReport(report(reviewing()))).toContain('## Attention\nNothing needs attention.\n');
    expect(renderReport(report(stalled(LIVE)))).not.toContain('Nothing needs attention.');
  });
  it('Work items: item, title cut to about 18, state; a session nests under its PR as a `↳` row', () => {
    const t = renderReport(report(reviewing())), work = t.split('## Work items\n')[1].split('\n\n')[0];
    expect(work.split('\n').filter((l) => l.startsWith('|'))).toEqual(['|item|title|state|', '|-|-|-|', '|we#2344|A very long title…|review|', '|↳|review-2344|working|', '|we#2349|A very long title…|review|', '|↳|review-2349|working|']);
  });
  it('a note goes under the table only when a row needs detail: a clean row has none, a blocked row has its reason', () => {
    const clean = renderReport(report(reviewing()));
    expect(clean.split('## Work items')[1].split('## Done since')[0]).not.toMatch(/^- (we#2344|we#2349):/m); // a PR row that is just `review` needs no note
    const busy = renderReport(report(stalled(DOWN))).replace(/\n {2,}/g, ' ');
    expect(busy).toContain('- we#2170: blocked on changes requested');
    expect(busy).toContain('- pa#148: blocked on review stalled');
    expect(busy).toContain('- fix-2108: runs on claude-sonnet-5; delegated to Codex');
    expect(busy).not.toMatch(/- we#2108:/); // the `fixing` PR row needs no note
  });
  it('Done since: time, item, title cut to about 18, and the heading is verbatim', () => {
    const t = renderReport(report(stalled(DOWN)));
    expect(t).toMatch(/## Done since 2026-09-20 \d\d:\d\d E[SD]T \(last 3 h; no earlier \/wip stamp\)\n\|time\|item\|title\|\n\|-\|-\|-\|\n\|\d\d:\d\d\|/);
    expect(t).toContain('|10:18|we#2347|Make the conveyor…|');
    const scoped = structuredClone(stalled(DOWN)); scoped.lastWip = '2026-09-20T14:30:00.000Z';
    expect(renderReport(report(scoped))).toContain('## Done since 2026-09-20 10:30 EDT\n|time|item|title|');
  });
  it('Done since: a finished session shows its own name, and an empty window is one plain line', () => {
    const raw = stalled(DOWN); raw.merged = []; raw.completions = [{ session: 'build-3495', status: 'done', outcome: 'PR opened\nsecond line', updatedAt: new Date(raw.now - 600000).toISOString() }];
    expect(renderReport(report(raw))).toContain('|build-3495|PR opened|');
    raw.completions = [];
    expect(renderReport(report(raw))).toContain('## Done since 2026-09-20 07:57 EDT (last 3 h; no earlier /wip stamp)\nNothing landed or finished in this window.');
  });
  it('Next and Needs you keep their lines; Needs you is the operator queue text verbatim and unwrapped', () => {
    const raw = stalled(DOWN), line = `chalbert/web-everything#2400  ${'a very long title '.repeat(8).trim()}`;
    raw.operatorQueueText = `NEEDS YOU (x):\n${line}\nPENDING — y:\n(none)\n`;
    const t = renderReport(report(raw));
    expect(t.split('\n## Needs you\n')[1]).toBe(`- ${line}`);
    expect(t).toContain('queue: 1 waiting on you');
    expect(t.replace(/\n {2,}/g, ' ')).toContain('## Next\n- we#2170: fix deferred — no free worker slot (3 of 3 workers running, 12 free lanes)');
  });
  it('names an unreadable source instead of showing an empty section, and never crashes on no input', () => {
    const t = renderReport(report({ now: RAW.now }));
    for (const want of ['runner: unknown (source unavailable)', 'old PRs: unknown', 'Unknown (land-advance could not run).', 'Needs you: unknown', 'No open PRs or live sessions.', 'Nothing needs attention.']) expect(t).toContain(want);
    const withErr = renderReport(report({ now: RAW.now, errors: [{ source: 'docket', message: 'boom' }] }));
    expect(withErr).toMatch(/\n\n- Source error: docket: boom$/);
  });
  it('says the docket is unlisted when there is none, and flags a stale one', () => {
    const none = stalled(DOWN); none.docket = null;
    expect(renderReport(report(none)).replace(/\n {2,}/g, ' ')).toContain('- Open decisions: not listed (no decision docket data on this machine).');
    expect(renderReport(report(stalled(DOWN))).replace(/\n {2,}/g, ' ')).toContain('- 8 open decisions in the docket (built 2026-09-14 14:32 EDT) — docket may be stale');
  });
  it('shows every landed PR, live session and finding it is given (nothing is silently dropped)', () => {
    const r = report(stalled(LIVE)), t = renderReport(r);
    for (const w of r.workItems.filter((w) => w.type === 'pr')) expect(t).toContain(`|${w.short}|`);
    for (const d of r.done.rows) expect(t).toContain(`|${d.ref}|`);
    for (const p of r.queue.plan) expect(t.replace(/\n {2,}/g, ' ')).toContain(p.key);
  });
});

describe('the stacked-bullets fallback is unchanged (--bullets)', () => {
  it('reproduces today\'s bullets output for the fixed fixture, byte for byte (the snapshot was re-captured for #3721: two sessions quiet under the grace period, `proto-note` and `session-verdicts`, are live rows, not "finished")', () => {
    expect(renderReport(report(stalled(DOWN)), { style: 'bullets' }) + '\n').toBe(SNAPSHOT);
    expect(renderBullets(report(stalled(DOWN))) + '\n').toBe(SNAPSHOT);
    expect(SNAPSHOT.split('\n').length).toBe(177 + 1 - 0);
  });
  it('the default is compact, and an unknown style is compact', () => {
    const r = report(stalled(DOWN));
    expect(renderReport(r)).toBe(renderCompact(r));
    expect(renderReport(r, { style: 'nonsense' })).toBe(renderCompact(r));
    expect(renderReport(r, {})).toBe(renderCompact(r));
  });
  it('the bullets style still shows every finding, queued or not (the classification only changes the compact view)', () => {
    const t = renderReport(report(stalled(LIVE)), { style: 'bullets' });
    expect(t).toContain('- **web-everything#2349**');
    expect(t).toContain('remedy: auto');
    expect(t).not.toContain('gaps queued');
    expect(t).not.toMatch(/^\|/m);
  });
});

describe('CLI: --bullets, WIP_REPORT_STYLE, --queue-plan', () => {
  const run = async (argv, { env = {}, raw = stalled(DOWN), stamps = [] } = {}) => {
    const c = capture();
    const code = await main({ argv, env, readRaw: async () => structuredClone(raw), stamp: (iso) => stamps.push(iso), stdout: c.stdout, stderr: c.stderr });
    return { code, ...c.out, stamps };
  };
  it('the default is compact tables', async () => {
    const r = await run([]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(renderCompact(report(stalled(DOWN))) + '\n');
    expect(r.stdout).toMatch(/^\|finding\|since\|remedy\|$/m);
  });
  it('--bullets prints the old stacked bullets, exactly the snapshot', async () => {
    const r = await run(['--bullets']);
    expect(r.stdout).toBe(SNAPSHOT);
  });
  it('env WIP_REPORT_STYLE=bullets does the same, and any other value stays compact', async () => {
    expect((await run([], { env: { WIP_REPORT_STYLE: 'bullets' } })).stdout).toBe(SNAPSHOT);
    expect((await run([], { env: { WIP_REPORT_STYLE: 'compact' } })).stdout).toMatch(/^\|finding\|/m);
    expect((await run([], { env: { WIP_REPORT_STYLE: 'wide' } })).stdout).toMatch(/^\|finding\|/m);
  });
  it('--json is the structured report either way, and it now carries the queue', async () => {
    const a = JSON.parse((await run(['--json'])).stdout), b = JSON.parse((await run(['--json', '--bullets'])).stdout);
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(expect.arrayContaining(['header', 'attention', 'queue', 'workItems', 'done', 'next', 'needsYou']));
    expect(a.queue.plan.map((p) => p.key)).toContain('ci-failed-no-fixer:we#2349');
  });
  it('--queue-plan prints only the plan (what would be filed, nothing is), and is not a stamped run', async () => {
    const r = await run(['--queue-plan'], { raw: stalled(LIVE) });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Queue plan: 4 to file (read-only: this report files nothing)');
    expect(r.stdout).toContain('- ci-failed-no-fixer:we#2349 — CI failed (ci:failed label) and no fixer is running');
    expect(r.stdout).not.toContain('## ');
    expect(r.stdout.endsWith('\n')).toBe(true);
    expect(r.stamps).toEqual([]);
  });
  it('--queue-plan --json is the queue data: the plan, the handled findings, the deadline', async () => {
    const q = JSON.parse((await run(['--queue-plan', '--json'], { raw: stalled(LIVE) })).stdout);
    expect(Object.keys(q)).toEqual(['deadlineMs', 'handled', 'handledRows', 'plan', 'shown', 'overdue']);
    expect(q.deadlineMs).toBe(7200000);
    expect(q.plan.map((p) => p.key)).toEqual(['ci-failed-no-fixer:we#2349', 'session-stalled:review-148', 'session-stalled:fix-2347', 'pre-today-pr-open']);
    expect(q.handled.map((h) => h.class)).toEqual(Array(6).fill('handled'));
  });
  it('--queue-plan says so when there is nothing to file', async () => {
    expect((await run(['--queue-plan'], { raw: reviewing() })).stdout).toBe('Queue plan: nothing to file.\n');
  });
  it('a default run writes nothing; only --stamp stamps, in either style', async () => {
    for (const argv of [[], ['--bullets'], ['--queue-plan'], ['--json']]) expect((await run(argv)).stamps).toEqual([]);
    expect((await run(['--stamp'])).stamps).toEqual([new Date(RAW.now).toISOString()]);
    expect((await run(['--bullets', '--stamp'])).stamps).toHaveLength(1);
  });
  it('still rejects an unknown flag before reading anything', async () => {
    const c = capture();
    expect(await main({ argv: ['--tables'], readRaw: async () => { throw new Error('no'); }, stdout: c.stdout, stderr: c.stderr })).toBe(1);
    expect(c.out.stderr).toContain('Unknown argument: --tables (known: --json --sessions --stamp --bullets --queue-plan)');
  });
});
