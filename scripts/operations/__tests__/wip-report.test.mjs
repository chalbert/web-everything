/**
 * The pure `/wip` report core, driven by a fixture captured from the real state of 2026-09-20 ~10:57 EDT
 * (`gh pr list` for the three repos + `claude agents --json` + the sources around them; see `raw-2026-09-20.json`).
 */
import { it, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  composeInput, buildReport, renderReport, derivePrState, parseNeedsYou, defaultBindSession, isLiveSession,
  PR_STATES, ATTENTION_RULES, DONE_FALLBACK_MS,
} from '../wip-report.mjs';

const RAW = JSON.parse(readFileSync(resolve('scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json'), 'utf8'));
const clone = () => structuredClone(RAW);
const run = (raw, opts) => { const report = buildReport(composeInput(raw), opts); return { report, text: renderReport(report) }; };
const REMEDIES = ['auto', 'no-handler'];
const STATE_RE = /^(reviewing|waiting-for-reviewer|fixing|waiting-CI|waiting-merge|needs-operator|landed|unknown|blocked-on:.+)$/;

/** The operator saw `review-148` blocked for two hours; the capture caught its transcript freshly touched, so age it. */
function withStalledReview() {
  const raw = clone();
  const s = raw.wipData.agents.find((a) => a.name === 'review-148');
  raw.wipData.facts[s.sessionId].transcriptMtimeMs = raw.now - 130 * 60000;
  return raw;
}
const rowsFor = (report, rule) => report.attention.filter((a) => a.rule === rule);

describe('the fixture state (2026-09-20)', () => {
  const { report, text } = run(withStalledReview());

  it('flags #2349: ci:failed with no fixer, and no handler exists for it', () => {
    const rows = rowsFor(report, 'ci-failed-no-fixer');
    expect(rows.map((r) => r.item)).toEqual(['web-everything#2349']);
    expect(rows[0].remedy).toBe('no-handler');
  });
  it('flags #2344: DIRTY with no fix in flight AND a stale fixing tag', () => {
    expect(rowsFor(report, 'conflict-no-fix-in-flight').map((r) => r.item)).toContain('web-everything#2344');
    const stale = rowsFor(report, 'stale-tag').find((r) => r.item === 'web-everything#2344');
    expect(stale.what).toMatch(/tag says fixing/);
    expect(report.workItems.find((w) => w.ref === 'web-everything#2344').state).toBe('blocked-on:merge conflict');
  });
  it('flags review-148 as a stalled session and shows the PR as blocked on its reviewer', () => {
    const row = rowsFor(report, 'session-stalled').find((r) => r.item.startsWith('review-148'));
    expect(row).toBeTruthy();
    expect(row.what).toMatch(/no activity for 2h/);
    expect(report.workItems.find((w) => w.ref === 'plateau-app#148').state).toBe('blocked-on:reviewer stalled');
  });
  it('counts finished-but-unreaped sessions (a count row) and the pre-today PRs (queue-first)', () => {
    const [u] = rowsFor(report, 'session-finished-unreaped');
    expect(u.item).toMatch(/^\d+ sessions$/);
    expect(u.what).toMatch(/finished but the process is still running/);
    const [p] = rowsFor(report, 'pre-today-pr-open');
    expect(p.what).toMatch(/oldest is plateau-app#148/);
    expect(report.header.preToday.count).toBe(3);
  });
  it('nests the live sessions under their PR, showing the model as "runs on" and the CLI as "delegated to"', () => {
    expect(text).toMatch(/\| ↳ fix-2108 \| idle \| runs on claude-sonnet-5; delegated to Codex \S+ \(cli [\d.]+\) \|/);
    const pr = report.workItems.find((w) => w.ref === 'web-everything#2108');
    expect(pr.sessions.map((s) => s.name)).toEqual(['fix-2108']);
    expect(text).not.toMatch(/Supervisor|Executor|live-idle|dead-record|live-active/);
  });
  it('has an empty operator queue: `Needs you: none` and a checked-at header, never omitted', () => {
    expect(report.needsYou).toEqual([]);
    expect(text).toContain('## Needs you\nNeeds you: none');
    expect(text.split('\n')[0]).toMatch(/operator queue: none \(checked \d\d:\d\d\)/);
  });
  it('puts the header first with load, cores, workers, runner state and the queue-first count', () => {
    const header = text.split('\n')[0];
    expect(header).toMatch(/^2026-09-20 \d\d:\d\d E[SD]T · load [\d.]+ on 12 cores · workers \d+ of 3 · runner: not live — Attention items are NOT auto-handled · 3 PRs open from before today, oldest plateau-app#148 \(/);
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Attention', '## Work items', expect.stringMatching(/^## Done since /), '## Next', '## Needs you']);
  });
  it('lists a merged PR under Done, using the fallback window when no last-wip exists', () => {
    expect(report.done.fallback).toBe(true);
    expect(report.done.since).toBe(RAW.now - DONE_FALLBACK_MS);
    expect(text).toMatch(/## Done since 2026-09-20 \d\d:\d\d E[SD]T \(last 3 h; no earlier \/wip stamp\)/);
    expect(text).toMatch(/- \d\d:\d\d web-everything#2350 landed — backlog: file decision/);
  });
  it('scopes Done to the persisted last-wip when there is one', () => {
    const raw = clone(); raw.lastWip = '2026-09-20T14:30:00.000Z';
    const { report: r, text: t } = run(raw);
    expect(r.done.fallback).toBe(false);
    expect(t).toContain('## Done since 2026-09-20 10:30 EDT\n');
    expect(r.done.rows.map((d) => d.text)).toEqual(expect.arrayContaining([expect.stringContaining('web-everything#2350 landed')]));
    expect(r.done.rows.every((d) => d.at > Date.parse('2026-09-20T14:30:00Z'))).toBe(true);
    expect(t).not.toContain('web-everything#2343');
  });
  it('puts the land-advance deferrals in Next with their reason, and invents nothing', () => {
    expect(report.next.map((n) => n.subject).sort()).toEqual(['we#2170', 'we#2344']);
    expect(report.next.every((n) => n.deferred && n.reason === 'capacity')).toBe(true);
    expect(text).toMatch(/## Next\n- we#2170: fix deferred — no free worker slot/);
  });
  it('lists no session row for a dead record; dead records are one count line', () => {
    const rows = composeInput(RAW).sessions;
    const dead = rows.filter((r) => r.liveness === 'dead-record'), liveNames = new Set(rows.filter(isLiveSession).map((r) => r.name));
    expect(dead.length).toBeGreaterThan(20);
    for (const d of dead.filter((r) => !liveNames.has(r.name))) {
      expect(text).not.toContain(`session ${d.name} |`);
      expect(text).not.toContain(`↳ ${d.name} |`);
    }
    expect(text).toContain(`${dead.length} dead session records (no process): nothing to act on.`);
    expect(report.workItems.filter((w) => w.type === 'session').every((w) => liveNames.has(w.sessions[0].name))).toBe(true);
  });
  it('shows a work item for the open decisions the docket lists, capped, with the rest counted', () => {
    expect(report.workItems.filter((w) => w.type === 'decision')).toHaveLength(5);
    expect(text).toMatch(/3 more open decisions in the docket \(top 5 by leverage shown/);
  });
});

describe('closed vocabularies and determinism', () => {
  it('is byte-identical for identical input (text and JSON)', () => {
    const a = run(clone()), b = run(clone());
    expect(a.text).toBe(b.text);
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
  });
  it('emits only states from the closed PR vocabulary, and only rules from the closed Attention table', () => {
    for (const raw of [clone(), withStalledReview()]) {
      const { report } = run(raw);
      for (const w of report.workItems.filter((w) => w.type === 'pr')) expect(w.state).toMatch(STATE_RE);
      for (const a of report.attention) {
        expect(Object.keys(ATTENTION_RULES)).toContain(a.rule);
        expect(REMEDIES).toContain(a.remedy);
      }
    }
    expect(Object.keys(ATTENTION_RULES)).toEqual(['ci-failed-no-fixer', 'conflict-no-fix-in-flight', 'changes-requested-no-fixer', 'review-pending-no-reviewer',
      'stale-tag', 'session-stalled', 'session-finished-unreaped', 'pre-today-pr-open', 'over-capacity', 'runner-not-live']);
    expect(PR_STATES).toEqual(['reviewing', 'waiting-for-reviewer', 'fixing', 'waiting-CI', 'waiting-merge', 'blocked-on:<what>', 'needs-operator', 'landed', 'unknown']);
  });
  it('a bad input never crashes: no sources at all still renders every section, with unknowns named', () => {
    const { text } = run({ now: RAW.now });
    expect(text).toContain('## Needs you\nNeeds you: unknown');
    expect(text).toContain('runner: unknown');
    expect(text).toContain('pre-today PRs: unknown');
    expect(text).toContain('Unknown (land-advance could not run).');
  });
});

describe('derivePrState (labels + mergeStateStatus + session verdicts)', () => {
  const pr = (labels, extra = {}) => ({ number: 1, labels: labels.map((name) => ({ name })), mergeStateStatus: 'CLEAN', ...extra });
  const sess = (role, verdict = 'progressing') => ({ binding: { kind: 'pr', role, number: 1 }, session: { verdict, liveness: 'live-active' } });
  it.each([
    [pr(['review:human', 'advisory:accepted']), {}, 'needs-operator'],
    [pr(['review:pending']), { sessions: [sess('review')] }, 'reviewing'],
    [pr(['review:changes']), { sessions: [sess('fix')] }, 'fixing'],
    [pr(['review:changes']), { sessions: [sess('fix', 'stalled')] }, 'blocked-on:fixer stalled'],
    [pr(['review:pending']), {}, 'waiting-for-reviewer'],
    [pr(['review:accepted']), {}, 'waiting-merge'],
    [pr(['review:accepted'], { mergeStateStatus: 'UNSTABLE' }), {}, 'waiting-CI'],
    [pr([], { mergeStateStatus: 'BLOCKED' }), {}, 'waiting-CI'],
    [pr(['ci:failed'], { mergeStateStatus: 'BLOCKED' }), {}, 'blocked-on:CI failure'],
    [pr(['review:changes'], { mergeStateStatus: 'DIRTY' }), {}, 'blocked-on:merge conflict'],
    [pr(['review:changes']), {}, 'blocked-on:changes requested'],
    [pr([], { isDraft: true }), {}, 'blocked-on:draft PR'],
    [pr(['review:accepted']), { planRow: { owedAction: 'wait-on-drain', evidence: ['couple-carrier:x', '3 passes'] } }, 'blocked-on:drain (couple-carrier:x)'],
    [pr([]), {}, 'unknown'],
  ])('%j → %s', (p, ctx, want) => expect(derivePrState(p, ctx)).toBe(want));
});

describe('attention rules', () => {
  const base = () => ({ now: Date.parse('2026-09-20T15:00:00Z'), runner: { state: 'alive-and-idle' }, operatorQueueText: 'NEEDS YOU (x):\n(none)\nPENDING — y:\n(none)\n', merged: [], completions: [], errors: [],
    wipData: { agents: [], facts: {} }, landInputs: { prs: [], sessions: [], cap: 3, freeLanes: 9, load: 0.2, loadThreshold: 1.5 } });
  const pr = (over) => ({ repo: 'we', slug: 'chalbert/web-everything', number: 7, title: 't', labels: [], baseRefName: 'main', createdAt: '2026-09-20T14:00:00Z', updatedAt: '2026-09-20T14:30:00Z', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', isDraft: false, ...over });
  const label = (...n) => n.map((name) => ({ name }));
  it('says nothing needs attention on a clean state, and a live runner adds no warning', () => {
    const { text } = run(base());
    expect(text).toContain('## Attention\nNothing needs attention.');
    expect(text.split('\n')[0]).toContain('runner: live');
    expect(text).not.toContain('NOT auto-handled');
  });
  it('flags review:pending with no reviewer as auto when land-advance can dispatch it, and stops once a live reviewer exists', () => {
    const raw = base(); raw.landInputs.prs = [pr({ labels: label('review:pending', 'review-status:reviewing') })];
    const { report } = run(raw);
    expect(rowsFor(report, 'review-pending-no-reviewer')).toMatchObject([{ item: 'web-everything#7', remedy: 'auto' }]);
    expect(rowsFor(report, 'stale-tag')).toHaveLength(1);
    const agent = { id: 'a1', sessionId: 's1', kind: 'background', name: 'review-7', state: 'working', status: 'busy', pid: 4242, startedAt: Date.parse('2026-09-20T14:40:00Z') };
    raw.wipData = { agents: [agent], facts: { s1: { pidAlive: true, transcriptMtimeMs: raw.now - 60000, resultFiles: [] } } };
    const { report: r2, text } = run(raw);
    expect(rowsFor(r2, 'review-pending-no-reviewer')).toHaveLength(0);
    expect(rowsFor(r2, 'stale-tag')).toHaveLength(0);
    expect(r2.workItems[0]).toMatchObject({ ref: 'web-everything#7', state: 'reviewing' });
    expect(text).toContain('| ↳ review-7 | working | runs on');
  });
  it('a session with a dead pid is never a fixer or a row', () => {
    const raw = base(); raw.landInputs.prs = [pr({ labels: label('ci:failed') })];
    raw.wipData = { agents: [{ id: 'a2', sessionId: 's2', kind: 'background', name: 'fix-7', state: 'working', pid: 99, startedAt: raw.now - 3600000 }], facts: { s2: { pidAlive: false } } };
    const { report, text } = run(raw);
    expect(rowsFor(report, 'ci-failed-no-fixer')).toHaveLength(1);
    expect(text).not.toContain('↳ fix-7');
    expect(text).toContain('1 dead session record (no process)');
  });
  it('reports the runner: not live adds a row and the header warning; unknown adds neither (never a guess)', () => {
    const down = base(); down.runner = { state: 'down', stalledReason: 'No singleton runner lease exists; no runner is registered.' };
    const a = run(down);
    expect(rowsFor(a.report, 'runner-not-live')).toHaveLength(1);
    expect(a.text.split('\n')[0]).toContain('runner: not live — Attention items are NOT auto-handled');
    const unknown = base(); unknown.runner = { state: 'unknown' };
    const b = run(unknown);
    expect(rowsFor(b.report, 'runner-not-live')).toHaveLength(0);
    expect(b.text.split('\n')[0]).toContain('runner: unknown');
  });
  it('flags over-capacity from the live workers versus the cap', () => {
    const raw = base();
    raw.landInputs.cap = 1;
    raw.wipData = { agents: ['fix-1', 'fix-2'].map((name, i) => ({ id: `a${i}`, sessionId: `s${i}`, kind: 'background', name, state: 'working', status: 'busy', pid: 10 + i, startedAt: raw.now - 600000 })),
      facts: { s0: { pidAlive: true, transcriptMtimeMs: raw.now - 1000, resultFiles: [] }, s1: { pidAlive: true, transcriptMtimeMs: raw.now - 1000, resultFiles: [] } } };
    const { report } = run(raw);
    expect(rowsFor(report, 'over-capacity')).toMatchObject([{ item: '2 workers', remedy: 'no-handler' }]);
  });
  it('binds supervision-tree task sessions (t-<story>-r<round>-<task>) to their story item row, and honours an injected binder', () => {
    const raw = base(); raw.landInputs.prs = [pr({ labels: label('review:changes') })];
    const agent = (name, id) => ({ id, sessionId: `s-${id}`, kind: 'background', name, state: 'working', status: 'busy', pid: 70 + id.length, startedAt: raw.now - 600000 });
    raw.wipData = { agents: [agent('t-3383-r1-parse', 'a1'), agent('t-3383-r1-render', 'a2'), agent('graduation-1', 'a3')],
      facts: Object.fromEntries(['a1', 'a2', 'a3'].map((id) => [`s-${id}`, { pidAlive: true, transcriptMtimeMs: raw.now - 1000, resultFiles: [] }])) };
    expect(defaultBindSession({ name: 't-3383-r1-parse' })).toMatchObject({ kind: 'item', role: 'task', key: '#3383' });
    expect(defaultBindSession({ name: 'graduation-1' })).toBeNull();
    const { report, text } = run(raw);
    const item = report.workItems.find((w) => w.type === 'item');
    expect(item).toMatchObject({ ref: 'item #3383', state: 'working' });
    expect(item.sessions.map((s) => s.name)).toEqual(['t-3383-r1-parse', 't-3383-r1-render']);
    expect(text).toContain('| ↳ t-3383-r1-parse | working |');
    expect(report.workItems.find((w) => w.ref === 'session graduation-1')).toBeTruthy();
    // an injected binder can claim any session for a PR (the hook for future contracts)
    const bind = (s) => (s.name === 'graduation-1' ? { kind: 'pr', role: 'fix', number: 7, key: '#7' } : defaultBindSession(s));
    const r2 = run(raw, { bindSession: bind }).report;
    expect(r2.workItems.find((w) => w.ref === 'web-everything#7')).toMatchObject({ state: 'fixing' });
    expect(r2.workItems.find((w) => w.ref === 'web-everything#7').sessions.map((s) => s.name)).toEqual(['graduation-1']);
  });
});

describe('Needs you (operator-queue lines, verbatim)', () => {
  const TEXT = 'NEEDS YOU (review:human + advisory:accepted, all gates pass):\nchalbert/web-everything#2400  Ship the thing\nchalbert/plateau-app#160  Another one\n'
    + 'PENDING — transient, re-run (x):\n(none)\nUNSUPPORTED REPO — owed:\n(none)\nNOT READY — agent work:\nchalbert/web-everything#9  no advisory verdict\n';
  it('parses only the NEEDS YOU section', () => {
    expect(parseNeedsYou(TEXT)).toEqual(['chalbert/web-everything#2400  Ship the thing', 'chalbert/plateau-app#160  Another one']);
    expect(parseNeedsYou('NEEDS YOU (x):\n(none)\nPENDING — y:\n(none)\n')).toEqual([]);
    expect(parseNeedsYou('garbage')).toBeNull();
    expect(parseNeedsYou(undefined)).toBeNull();
  });
  it('prints the lines verbatim and counts them in the header', () => {
    const raw = clone(); raw.operatorQueueText = TEXT;
    const { text } = run(raw);
    expect(text).toContain('## Needs you\n- chalbert/web-everything#2400  Ship the thing\n- chalbert/plateau-app#160  Another one');
    expect(text.split('\n')[0]).toContain('operator queue: 2 waiting on you');
    expect(text).not.toContain('Needs you: none');
  });
  it('says unknown, not none, when the queue could not be read', () => {
    const raw = clone(); raw.operatorQueueText = null;
    const { text } = run(raw);
    expect(text).toContain('Needs you: unknown');
    expect(text.split('\n')[0]).toContain('operator queue: unknown');
  });
});
