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
/** Collapse every run of whitespace: a bullet that wrapped onto continuation lines reads as one line again. */
const flat = (t) => t.replace(/\s+/g, ' ');
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
    expect(report.workItems.find((w) => w.ref === 'plateau-app#148').state).toBe('blocked-on:review stalled');
    // the nested session row says `stalled` too, so the PR row and its session never disagree
    expect(text).toContain('  - ↳ review-148 stalled\n    - runs on');
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
    expect(flat(text)).toMatch(/- ↳ fix-2108 idle - runs on claude-sonnet-5; delegated to Codex \S+ \(cli [\d.]+\) - since /);
    const pr = report.workItems.find((w) => w.ref === 'web-everything#2108');
    expect(pr.sessions.map((s) => s.name)).toEqual(['fix-2108']);
    expect(text).not.toMatch(/Supervisor|Executor|live-idle|dead-record|live-active/);
  });
  it('has an empty operator queue: `Needs you: none` and a checked-at header, never omitted', () => {
    expect(report.needsYou).toEqual([]);
    expect(text).toContain('## Needs you\nNeeds you: none');
    expect(text).toMatch(/^- operator queue: none \(checked \d\d:\d\d\)$/m);
  });
  it('puts the header first: the time, then one short bullet each for load + workers, runner, the queue-first count and the operator queue', () => {
    expect(text.split('\n').slice(0, 8)).toEqual([
      expect.stringMatching(/^2026-09-20 \d\d:\d\d E[SD]T$/),
      expect.stringMatching(/^- load [\d.]+ on 12 cores · workers \d+ of 3$/),
      '- runner: not live', '  - Attention items are NOT auto-handled',
      '- 3 PRs open from before today', expect.stringMatching(/^ {2}- oldest plateau-app#148 \(/),
      '- operator queue: none (checked ' + text.match(/checked (\d\d:\d\d)/)[1] + ')', '']);
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Attention', '## Work items', expect.stringMatching(/^## Done since /), '## Next', '## Needs you']);
  });
  it('lists a merged PR under Done, using the fallback window when no last-wip exists', () => {
    expect(report.done.fallback).toBe(true);
    expect(report.done.since).toBe(RAW.now - DONE_FALLBACK_MS);
    expect(text).toMatch(/## Done since 2026-09-20 \d\d:\d\d E[SD]T \(last 3 h; no earlier \/wip stamp\)/);
    expect(text).toMatch(/- \d\d:\d\d web-everything#2350 landed\n {2}backlog: file decision/);
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
    expect(flat(text)).toMatch(/## Next - we#2170: fix deferred — no free worker slot/);
  });
  it('lists no session row for a dead record; dead records are one count line', () => {
    const rows = composeInput(RAW).sessions;
    const dead = rows.filter((r) => r.liveness === 'dead-record'), liveNames = new Set(rows.filter(isLiveSession).map((r) => r.name));
    expect(dead.length).toBeGreaterThan(20);
    for (const d of dead.filter((r) => !liveNames.has(r.name))) {
      expect(text).not.toContain(`**session ${d.name}**`);
      expect(text).not.toContain(`↳ ${d.name} `);
    }
    expect(flat(text)).toContain(`${dead.length} dead session records (no process): nothing to act on.`);
    expect(report.workItems.filter((w) => w.type === 'session').every((w) => liveNames.has(w.sessions[0].name))).toBe(true);
  });
  it('never lists a decision as a work item or as operator work: one count line after the table, flagged when stale', () => {
    expect(report.workItems.filter((w) => w.type === 'decision')).toHaveLength(0);
    expect(text).not.toMatch(/decision #|ready to ratify|you decide/);
    expect(report.docket).toMatchObject({ total: 8, stale: true });
    // the docket file in the fixture was built 2026-09-14, days before the capture
    expect(flat(text)).toMatch(/ 8 open decisions in the docket \(built 2026-09-14 \d\d:\d\d EDT\) — docket may be stale ## Done since/);
  });
  it('drops the stale flag for a docket built within 24 h, and says nothing when there is no docket', () => {
    const fresh = clone(); fresh.docket.generatedAt = new Date(RAW.now - 3600000).toISOString();
    const t = run(fresh).text;
    expect(flat(t)).toMatch(/8 open decisions in the docket \(built 2026-09-20 \d\d:\d\d EDT\) ## Done since/);
    expect(t).not.toContain('may be stale');
    const none = clone(); none.docket = null;
    expect(flat(run(none).text)).toContain('Open decisions: not listed (no decision docket data on this machine).');
    const one = clone(); one.docket.items = one.docket.items.slice(0, 1); one.docket.generatedAt = fresh.docket.generatedAt;
    expect(run(one).text).toContain('1 open decision in the docket (built');
  });
  it('uses ONE worker count: the header, the over-capacity rule and the Next lines agree, and a finished session with a live pid is not a worker', () => {
    const cap = report.capacity, header = text.split('\n')[1];
    expect(header).toContain(`workers ${cap.live} of ${cap.cap}`);
    expect(cap.live).toBe(3); // review-148, fix-2347 (stalled), fix-2108; the old finished fix-2347 no longer holds a slot
    expect(flat(text)).toContain(`no free worker slot (${cap.live} of ${cap.cap} workers running, ${cap.freeLanes} free lanes)`);
    expect(text).not.toContain('as land-advance counts them');
    expect(rowsFor(report, 'over-capacity')).toHaveLength(0);
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
    [pr(['review:changes']), { sessions: [sess('fix', 'stalled')] }, 'blocked-on:fix stalled'],
    [pr(['review:pending']), { sessions: [sess('review', 'waiting-permission')] }, 'blocked-on:review waiting on a permission prompt'],
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
    expect(text).toContain('\n- runner: live\n');
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
    expect(flat(text)).toContain('- ↳ review-7 working - runs on');
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
    expect(a.text).toContain('\n- runner: not live\n  - Attention items are NOT auto-handled\n');
    const unknown = base(); unknown.runner = { state: 'unknown' };
    const b = run(unknown);
    expect(rowsFor(b.report, 'runner-not-live')).toHaveLength(0);
    expect(b.text).toContain('\n- runner: unknown (source unavailable)\n');
    expect(b.text).not.toContain('NOT auto-handled');
  });
  it('flags over-capacity from the live workers versus the cap', () => {
    const raw = base();
    raw.landInputs.cap = 1;
    raw.landInputs.sessions = ['fix-1', 'fix-2'].map((name) => ({ name, kind: 'background', liveness: 'live-active', verdict: 'progressing' }));
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
    expect(text).toContain('- ↳ t-3383-r1-parse working');
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
    expect(text).toContain('\n- operator queue: 2 waiting on you\n');
    expect(text).not.toContain('Needs you: none');
  });
  it('says unknown, not none, when the queue could not be read', () => {
    const raw = clone(); raw.operatorQueueText = null;
    const { text } = run(raw);
    expect(text).toContain('Needs you: unknown');
    expect(text).toContain('\n- operator queue: unknown\n  - could not read it\n');
  });
});

describe('one layout for a phone and a desktop terminal (stacked bullets, no tables)', () => {
  const remedy = (r) => (r === 'auto' ? 'auto' : 'no handler');
  /** `#2344` and `#2349` under review, each with a live review session nested under its PR (a second tonight shape). */
  function withReviewingChildren() {
    const raw = { now: Date.parse('2026-09-20T17:07:00Z'), runner: { state: 'down', stalledReason: 'No singleton runner lease exists; no runner is registered.' },
      operatorQueueText: 'NEEDS YOU (x):\n(none)\nPENDING — y:\n(none)\n', completions: [], errors: [],
      merged: [{ repo: 'we', slug: 'chalbert/web-everything', number: 2347, title: 'Make the conveyor\'s checks multi-repo, and guard against single-repo checks', mergedAt: '2026-09-20T14:18:00Z' }],
      wipData: { agents: [], facts: {} }, landInputs: { prs: [], sessions: [], cap: 3, freeLanes: 9, load: 0.2, loadThreshold: 1.5 } };
    const label = (...n) => n.map((name) => ({ name }));
    const pr = (number, over = {}) => ({ repo: 'we', slug: 'chalbert/web-everything', number, title: `A very long title for PR ${number} that must be cut to fit a phone screen`, labels: label('review:pending', 'review-status:reviewing'),
      baseRefName: 'main', createdAt: '2026-09-20T14:00:00Z', updatedAt: '2026-09-20T14:30:00Z', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', isDraft: false, ...over });
    raw.landInputs.prs = [pr(2344), pr(2349)];
    raw.wipData = { agents: [2344, 2349].map((n) => ({ id: `a${n}`, sessionId: `s${n}`, kind: 'background', name: `review-${n}`, state: 'working', status: 'busy', pid: n, startedAt: raw.now - 1800000 })),
      facts: Object.fromEntries([2344, 2349].map((n) => [`s${n}`, { pidAlive: true, transcriptMtimeMs: raw.now - 60000, resultFiles: [] }])) };
    return raw;
  }
  const SCENARIOS = { 'tonight fixture (#2170 blocked, #2344/#2349, stalled review-148, unreaped group, runner not live, Done)': withStalledReview, 'reviewing PRs with child sessions': withReviewingChildren };

  /** Every fact of the structured report appears in the text (wrapping aside), whatever the layout. */
  function expectEveryFact(report, text) {
    const f = flat(text), has = (s) => expect(f).toContain(flat(s));
    const h = report.header;
    has(h.time); has(`workers ${h.workers.live} of ${h.workers.cap}`); has(`runner: ${h.runner}`);
    if (h.load != null) has(`load ${h.load.toFixed(2)} on ${h.cores} cores`);
    if (h.preToday.count) { has(`${h.preToday.count} PR`); has(`oldest ${h.preToday.oldest.ref}`); }
    has(`operator queue: ${h.operatorQueue === 'none' ? 'none' : h.operatorQueue}`);
    for (const a of report.attention) {
      has(a.item); has(a.what); has(`remedy: ${remedy(a.remedy)}`);
      expect(f).toMatch(a.since == null ? /since unknown/ : /since (\d\d-\d\d )?\d\d:\d\d \(\d+[dhm]/);
    }
    for (const w of report.workItems) {
      has(`**${w.ref}** ${w.state}`);
      if (w.title) has(w.title.length > 36 ? `${w.title.slice(0, 35).trimEnd()}…` : w.title);
      if (w.next && w.next !== '—') has(`next: ${w.next}`);
      for (const s of w.sessions) { has(s.name); has(s.state); has(s.agent); }
    }
    for (const d of report.done.rows) { has(clockOf(d.at)); for (const part of d.text.split(' — ')) has(part); }
    for (const n of report.next ?? []) has(n.text);
    expect(f).toContain(`## Done since`);
  }
  const clockOf = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

  describe.each(Object.entries(SCENARIOS))('%s', (_name, make) => {
    const { report, text } = run(make());
    const lines = text.split('\n');
    const needsYou = lines.indexOf('## Needs you');

    it('(a) has no table row and no table separator', () => {
      expect(lines.filter((l) => /^\s*\|/.test(l) || /\|\s*---\s*\|/.test(l))).toEqual([]);
      expect(text).not.toMatch(/^\| /m);
    });
    it('(b) still shows every fact, under the same section headings in the same order', () => {
      expectEveryFact(report, text);
      expect(lines.filter((l) => l.startsWith('## '))).toEqual(['## Attention', '## Work items', expect.stringMatching(/^## Done since /), '## Next', '## Needs you']);
    });
    it('(c) has no line over 60 columns, except headings and the verbatim Needs-you lines', () => {
      const exempt = (l, i) => l.startsWith('## ') || i > needsYou;
      expect(lines.filter((l, i) => l.length > 60 && !exempt(l, i))).toEqual([]);
    });
    it('(d) is byte-identical for identical input', () => {
      expect(run(make()).text).toBe(text);
      expect(renderReport(report)).toBe(text);
    });
  });

  it('keeps the nested session rows as sub-bullets under their PR', () => {
    const { text } = run(withReviewingChildren());
    expect(text).toContain('- **web-everything#2344** reviewing\n  - A very long title for PR 2344 that…\n  - since ');
    expect(text).toMatch(/- \*\*web-everything#2344\*\* reviewing\n(  - .+\n)+  - ↳ review-2344 working\n    - runs on .+\n(?: {6}.+\n)*    - since \d\d:\d\d \(\d+m\)\n/);
    expect(text).toContain('  - ↳ review-2349 working\n');
  });
  it('cuts a long PR title with an ellipsis, on its own sub-bullet, and shows a short one whole', () => {
    const raw = withReviewingChildren(); raw.landInputs.prs[1].title = 'Short title';
    const { text } = run(raw);
    const long = text.split('\n').find((l) => l.startsWith('  - A very long title'));
    expect(long).toBe('  - A very long title for PR 2344 that…');
    expect(long.length).toBeLessThanOrEqual(40);
    expect(text).toContain('\n  - Short title\n');
  });
  it('gives each Attention item three sub-bullets (what is wrong, since, remedy), worst rule first', () => {
    const { text } = run(withStalledReview());
    expect(text).toMatch(/## Attention\n- \*\*web-everything#2349\*\*\n {2}- CI failed[^\n]*\n(?: {4}[^\n]*\n)? {2}- since [^\n]+\n {2}- remedy: no handler\n/);
  });
  it('puts the title of a Done row on the next indented line, never the same line', () => {
    const { text } = run(withStalledReview());
    expect(text).toMatch(/\n- 10:18 web-everything#2347 landed\n {2}Make the conveyor's checks multi-repo/);
    expect(text).toMatch(/\n- \d\d:\d\d [^\n]+ landed\n {2}\S/);
  });
  it('splits the old one-line header into short lines: no header line passes 48 columns', () => {
    const lines = run(withStalledReview()).text.split('\n');
    const head = lines.slice(0, lines.indexOf('## Attention'));
    expect(head.length).toBeGreaterThan(5);
    expect(head.filter((l) => l.length > 48)).toEqual([]);
  });
  it('prints Needs you byte-identical to the operator queue text, wrapping nothing', () => {
    const line = `chalbert/web-everything#2400  ${'a very long title '.repeat(8).trim()}`;
    const raw = withReviewingChildren(); raw.operatorQueueText = `NEEDS YOU (x):\n${line}\nPENDING — y:\n(none)\n`;
    const { text } = run(raw);
    expect(text.split('\n## Needs you\n')[1]).toBe(`- ${line}`);
  });
});
