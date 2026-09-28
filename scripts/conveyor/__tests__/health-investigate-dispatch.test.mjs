/**
 * @file scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs
 * @description #4078 (health daemon slice 2) — the diagnose-only investigation dispatch.
 *   1. the pure budget ({@link planInvestigations}): one per episode, inhibiting episodes, one running, the
 *      rolling-24h and 7-day subject caps, a settled / pending diagnosis;
 *   2. the wall clock ({@link planWallClock}) and the findings scrub ({@link validateFindings});
 *   3. the REAL call path: the brief filled from disk, routed, and spawned through dispatch-lane's own sink with a
 *      fake `claude` — asserting the argv carries the read-only tool surface;
 *   4. whole passes of {@link runInvestigations} over a temp state dir: dispatch → no second agent → record →
 *      stopped + rendered into the report; and a wall-clock stop.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  planInvestigations, planWallClock, validateFindings, scrubInvestigationText, pruneLedger, HOLD_RULES, INHIBITING_SMELLS,
} from '../health-investigate-plan.mjs';
import {
  HEALTH_INVESTIGATE_READ_OPERATIONS, NON_READ_OPERATIONS, healthInvestigateToolArgs, createInvestigationSinks,
  dispatchInvestigation, runInvestigations, recordFindings, readLedger, ledgerPath, healthInvestigateBriefPath, main,
} from '../health-investigate-dispatch.mjs';
import { MINUTE, HOUR, renderEpisodeReport } from '../health-watch-core.mjs';
import {
  BRIEF_REQUIRED_BY_KIND, HEALTH_INVESTIGATE_KIND, LAUNCH_KINDS, fillBrief, sessionSlugFor,
} from '../../operations/dispatch-lane.mjs';
import { REPO_ROOT } from '../../operations/dispatch-lane-io.mjs';
import { CONVEYOR_STATE_ROOT_ENV } from '../../lib/daemon-last-good.mjs';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const ON = { investigateDispatch: true };
const INVESTIGATE = { id: 'lane-starvation', action: 'investigate', diagnose: { command: 'echo' } };
const NO_DIAG = { id: 'daemon-silent', action: 'investigate' };
const ALERT = { id: 'machine-overload', action: 'alert' };
const SMELLS = { [INVESTIGATE.id]: INVESTIGATE, [NO_DIAG.id]: NO_DIAG, [ALERT.id]: ALERT };

function ep(smell, subject, over = {}) {
  return {
    key: `${smell}::${subject}`, smell, subject, status: 'open', id: `2026-09-28-${smell}-${subject}-1100`,
    openedAt: NOW - HOUR, diagnosis: { command: 'echo', code: 0, output: 'x' }, tracked: null, ...over,
  };
}
const byKey = (...eps) => Object.fromEntries(eps.map((e) => [e.key, e]));
const entry = (e, over = {}) => ({ episodeId: e.id, key: e.key, smell: e.smell, subject: e.subject, startedAt: NOW - 2 * HOUR, status: 'finished', ...over });

// ── 1. the budget ────────────────────────────────────────────────────────────────────────────────────────────

describe('planInvestigations — the budget', () => {
  it('is OFF unless the operator turned investigateDispatch on (ships in shadow)', () => {
    const r = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we')), smellsById: SMELLS, ledger: [], now: NOW });
    expect(r.off).toBe(true);
    expect(r.dispatch).toEqual([]);
  });

  it('dispatches one agent for an open investigate episode whose diagnosis did not settle it; never for an alert smell', () => {
    const r = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we'), ep('machine-overload', 'host', { smell: 'machine-overload', status: 'pending' })), smellsById: SMELLS, ledger: [], config: ON, now: NOW });
    expect(r.dispatch.map((d) => d.key)).toEqual(['lane-starvation::we']);
  });

  it('refuses a SECOND agent for the same episode — whatever became of the first', () => {
    const e = ep('lane-starvation', 'we');
    for (const status of ['running', 'finished', 'stopped-wall-clock', 'dispatch-failed']) {
      const r = planInvestigations({ episodes: byKey(e), smellsById: SMELLS, ledger: [entry(e, { status, startedAt: NOW - 3 * 24 * HOUR })], config: ON, now: NOW });
      expect(r.dispatch, status).toEqual([]);
      expect(r.held[0].rule).toBe(HOLD_RULES.ONE_PER_EPISODE);
    }
  });

  it('refuses under an inhibiting episode (App token / rate limit, high load) — and resumes once it closes', () => {
    for (const smell of INHIBITING_SMELLS) {
      const inhibitor = ep(smell, 'host');
      const r = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we'), inhibitor), smellsById: SMELLS, ledger: [], config: ON, now: NOW });
      expect(r.dispatch, smell).toEqual([]);
      expect(r.held.find((h) => h.key === 'lane-starvation::we')).toMatchObject({ rule: HOLD_RULES.INHIBITED });
      expect(r.held.find((h) => h.key === 'lane-starvation::we').reason).toContain(smell);
    }
    // a pending (not yet open) inhibitor does not inhibit
    const pending = ep('machine-overload', 'host', { status: 'pending' });
    expect(planInvestigations({ episodes: byKey(ep('lane-starvation', 'we'), pending), smellsById: SMELLS, ledger: [], config: ON, now: NOW }).dispatch).toHaveLength(1);
  });

  it('refuses past the rolling 24 h budget (6), counting dispatch-failed attempts too; the window rolls', () => {
    const e = ep('lane-starvation', 'we');
    const past = (i, hoursAgo) => ({ episodeId: `old-${i}`, smell: 'other', subject: `s${i}`, startedAt: NOW - hoursAgo * HOUR, status: i === 0 ? 'dispatch-failed' : 'finished' });
    const six = [0, 1, 2, 3, 4, 5].map((i) => past(i, 1 + i));
    const r = planInvestigations({ episodes: byKey(e), smellsById: SMELLS, ledger: six, config: ON, now: NOW });
    expect(r.dispatch).toEqual([]);
    expect(r.held[0].rule).toBe(HOLD_RULES.WINDOW_BUDGET);
    // one of the six ages past 24 h → room again
    const rolled = [...six.slice(1), past(0, 25)];
    expect(planInvestigations({ episodes: byKey(e), smellsById: SMELLS, ledger: rolled, config: ON, now: NOW }).dispatch).toHaveLength(1);
  });

  it('holds at 1 running: a second candidate in the same tick waits, and is dispatched once the slot frees', () => {
    const a = ep('lane-starvation', 'we', { openedAt: NOW - 2 * HOUR });
    const b = ep('daemon-silent', 'review-daemon', { diagnosis: null });
    const r = planInvestigations({ episodes: byKey(b, a), smellsById: SMELLS, ledger: [], config: ON, now: NOW });
    expect(r.dispatch.map((d) => d.key)).toEqual(['lane-starvation::we']); // oldest first
    expect(r.held.find((h) => h.key === b.key).rule).toBe(HOLD_RULES.MAX_RUNNING);
    const next = planInvestigations({ episodes: byKey(b, a), smellsById: SMELLS, ledger: [entry(a, { status: 'finished', startedAt: NOW })], config: ON, now: NOW + 20 * MINUTE });
    expect(next.dispatch.map((d) => d.key)).toEqual([b.key]);
  });

  it('never runs a fourth investigation on one (smell, subject) within 7 days', () => {
    const e = ep('lane-starvation', 'we');
    const prior = (d) => ({ episodeId: `prior-${d}`, smell: e.smell, subject: e.subject, startedAt: NOW - d * 24 * HOUR, status: 'finished' });
    const three = [prior(1), prior(3), prior(6)];
    const r = planInvestigations({ episodes: byKey(e), smellsById: SMELLS, ledger: three, config: ON, now: NOW });
    expect(r.held[0].rule).toBe(HOLD_RULES.SUBJECT_CAP);
    // another subject of the same smell is unaffected; and the oldest ageing past 7 days frees the subject
    expect(planInvestigations({ episodes: byKey(ep('lane-starvation', 'pa')), smellsById: SMELLS, ledger: three, config: ON, now: NOW }).dispatch).toHaveLength(1);
    expect(planInvestigations({ episodes: byKey(e), smellsById: SMELLS, ledger: [prior(1), prior(3), prior(8)], config: ON, now: NOW }).dispatch).toHaveLength(1);
  });

  it('waits for a declared diagnosis, and holds when the smell says the diagnosis settled the cause', () => {
    const waiting = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we', { diagnosis: undefined })), smellsById: SMELLS, ledger: [], config: ON, now: NOW });
    expect(waiting.held[0].rule).toBe(HOLD_RULES.AWAITING_DIAGNOSIS);
    const settles = { ...INVESTIGATE, diagnosisSettles: (d) => d.output === 'leaked leases' };
    const settled = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we', { diagnosis: { output: 'leaked leases' } })), smellsById: { ...SMELLS, [settles.id]: settles }, ledger: [], config: ON, now: NOW });
    expect(settled.held[0].rule).toBe(HOLD_RULES.DIAGNOSIS_SETTLED);
    // a smell with no `diagnose` at all needs none
    expect(planInvestigations({ episodes: byKey(ep('daemon-silent', 'x', { diagnosis: undefined })), smellsById: SMELLS, ledger: [], config: ON, now: NOW }).dispatch).toHaveLength(1);
  });

  it('a tracked (silenced) episode stays quiet', () => {
    const r = planInvestigations({ episodes: byKey(ep('lane-starvation', 'we', { tracked: { card: '4078' } })), smellsById: SMELLS, ledger: [], config: ON, now: NOW });
    expect(r.held[0]).toMatchObject({ rule: HOLD_RULES.TRACKED });
  });
});

describe('planWallClock / pruneLedger', () => {
  const run = (minutesAgo, over = {}) => ({ episodeId: 'e1', handle: 'h1', session: 'health-e1', status: 'running', startedAt: NOW - minutesAgo * MINUTE, deadlineAt: NOW - minutesAgo * MINUTE + 20 * MINUTE, ...over });
  it('stops a running session on the first tick within the lead of its 20-minute clock — never after it', () => {
    expect(planWallClock([run(10)], { now: NOW })).toEqual([]);
    expect(planWallClock([run(15)], { now: NOW })).toEqual([{ episodeId: 'e1', handle: 'h1', session: 'health-e1', why: 'wall-clock' }]);
    expect(planWallClock([run(40)], { now: NOW })[0].why).toBe('wall-clock');
    expect(planWallClock([run(15, { status: 'finished' })], { now: NOW })).toEqual([]);
  });
  it('stops it as soon as its findings are recorded', () => {
    expect(planWallClock([run(2)], { now: NOW, hasFindings: () => true })[0].why).toBe('findings-recorded');
  });
  it('prunes finished entries past the longest window, never a running one', () => {
    const kept = pruneLedger([run(8 * 24 * 60), { ...run(8 * 24 * 60), episodeId: 'old', status: 'finished' }, { ...run(60), episodeId: 'new', status: 'finished' }], { now: NOW });
    expect(kept.map((x) => x.episodeId)).toEqual(['e1', 'new']);
  });
});

// ── 2. findings: validation + scrub ──────────────────────────────────────────────────────────────────────────

describe('validateFindings / scrubInvestigationText', () => {
  const good = {
    evidence: [{ command: 'node run.mjs stale-state --json', output: 'lease lane-3 held by dead session\nowner=/Users/op/workspace/wev' }],
    recommendation: { whatIsWrong: 'leaked leases', productChange: 'reap leases of dead sessions', nextStep: 'run the lease reaper' },
  };
  it('keeps paths (they are the evidence) but folds the home dir to ~', () => {
    const f = validateFindings(good, { home: '/Users/op' });
    expect(f.evidence[0].output).toContain('owner=~/workspace/wev');
    expect(f.evidence[0].output).toContain('lease lane-3 held by dead session');
  });
  it('redacts tokens, credentials, emails and opaque secrets', () => {
    const s = scrubInvestigationText([
      'auth ghp_abcdefghijklmnopqrstuvwxyz0123',
      'password: hunter2Trombone',
      'from op@example.com',
      'https://user:pa55word@host/x',
      'plain line stays',
    ].join('\n'));
    expect(s).not.toMatch(/ghp_abcdef|hunter2Trombone|op@example\.com|pa55word/);
    expect(s).toContain('plain line stays');
    expect(s).toMatch(/\[redacted/);
  });
  it('refuses findings with no evidence, a multi-line next step, or missing fields', () => {
    expect(() => validateFindings({ ...good, evidence: [] })).toThrow(/evidence/);
    expect(() => validateFindings({ ...good, recommendation: { ...good.recommendation, nextStep: 'a\nb' } })).toThrow(/ONE line/);
    expect(() => validateFindings({ evidence: good.evidence, recommendation: { whatIsWrong: 'x' } })).toThrow(/nextStep|productChange/);
    expect(() => validateFindings('nope')).toThrow(/JSON object/);
    expect(() => validateFindings({ ...good, evidence: Array(9).fill(good.evidence[0]) })).toThrow(/max 8/);
  });
});

// ── 3. the kind on dispatch-lane + the real spawn path ───────────────────────────────────────────────────────

describe('health-investigate on the declared dispatch-lane operation', () => {
  it('is a kind with its own brief row and session slug — and NOT a tick launch kind', () => {
    expect(BRIEF_REQUIRED_BY_KIND[HEALTH_INVESTIGATE_KIND]).toEqual(['EPISODE_ID', 'SMELL', 'SESSION_SLUG', 'WE_ROOT']);
    expect(sessionSlugFor('2026-09-28-lane-starvation-we-1100', HEALTH_INVESTIGATE_KIND)).toBe('health-2026-09-28-lane-starvation-we-1100');
    expect(LAUNCH_KINDS).not.toContain(HEALTH_INVESTIGATE_KIND);
  });

  it('the brief on disk fills cleanly with no leftover placeholder', () => {
    const { prompt } = fillBrief(readFileSync(healthInvestigateBriefPath(REPO_ROOT), 'utf8'), {
      EPISODE_ID: 'e-1', SMELL: 'lane-starvation', SESSION_SLUG: 'health-e-1', WE_ROOT: '/w',
    }, BRIEF_REQUIRED_BY_KIND[HEALTH_INVESTIGATE_KIND], []);
    for (const n of BRIEF_REQUIRED_BY_KIND[HEALTH_INVESTIGATE_KIND]) expect(prompt).not.toContain(`{{${n}}}`);
    expect(prompt).toContain('record --episode=e-1 --session=health-e-1');
  });

  it('every run.mjs operation is either one of the allowed reads or denied by name', async () => {
    const { OPERATIONS } = await import('../../operations/run.mjs');
    for (const op of Object.keys(OPERATIONS)) {
      expect(HEALTH_INVESTIGATE_READ_OPERATIONS.includes(op) || NON_READ_OPERATIONS.includes(op), op).toBe(true);
    }
    for (const op of HEALTH_INVESTIGATE_READ_OPERATIONS) expect(NON_READ_OPERATIONS).not.toContain(op);
  });

  it('spawns through the dispatch-lane sink with the read-only tool surface and the investigator-routed model', async () => {
    const spawned = [];
    const root = '/primary/webeverything';
    const sinks = createInvestigationSinks({
      root, stateRoot: '/state', agentArgs: [],
      spawnAgent: (argv) => { spawned.push(argv); return 'backgrounded · abc123\n'; },
      mintSessionId: () => 'sess-4078',
      now: () => new Date(NOW),
      sessionCwdFor: () => '/scratch/sess-4078',
      ensureSessionCwd: (d) => d,
      grantLanePermission: () => {},
      ensureWorktreeIsolation: () => {},
      resolveSettingsEnv: () => ({}),
    });
    const r = await dispatchInvestigation({ episodeId: '2026-09-28-lane-starvation-we-1100', smell: 'lane-starvation' }, {
      root, sinks, readBrief: () => readFileSync(healthInvestigateBriefPath(REPO_ROOT), 'utf8'),
    });
    expect(spawned).toHaveLength(1);
    const argv = spawned[0];
    expect(r.session).toBe('health-2026-09-28-lane-starvation-we-1100');
    expect(argv.slice(0, 3)).toEqual(['--bg', '-n', r.session]);
    const deny = argv.find((a) => a.startsWith('--disallowedTools='));
    const rules = deny.slice('--disallowedTools='.length).split(',');
    for (const must of ['Edit', 'Write', 'Bash(gh pr comment:*)', 'Bash(gh:*)', 'Bash(git:*)', `Bash(node ${root}/scripts/operations/run.mjs dispatch-lane:*)`]) {
      expect(rules, must).toContain(must);
    }
    const allow = argv.find((a) => a.startsWith('--allowedTools='));
    expect(allow).toContain(`Bash(node ${root}/scripts/operations/run.mjs stale-state:*)`);
    expect(allow).not.toMatch(/Edit|Write/);
    // model from routing (the investigator role → sonnet tier), never hand-set
    expect(argv[argv.indexOf('--model') + 1]).toBe('sonnet');
    // the state root rides the session env so the agent's `record` lands in this tick's healthDir
    const settings = JSON.parse(argv[argv.indexOf('--settings') + 1]);
    expect(settings.env[CONVEYOR_STATE_ROOT_ENV]).toBe('/state');
    const prompt = argv.at(-1);
    expect(prompt).toContain('2026-09-28-lane-starvation-we-1100');
    expect(prompt).toContain(`node ${root}/scripts/conveyor/health-investigate-dispatch.mjs show`);
  });

  it('the tool args survive a caller that passes its own agent args', () => {
    const args = healthInvestigateToolArgs('/w');
    expect(args).toHaveLength(2);
    expect(args.every((a) => a.startsWith('--') && a.includes('='))).toBe(true);
  });
});

// ── 4. whole passes over a temp state dir ────────────────────────────────────────────────────────────────────

describe('runInvestigations — end to end over the ledger', () => {
  let root;
  let dir;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'health-inv-'));
    dir = join(root, '.conveyor', 'health');
    mkdirSync(join(dir, 'episodes'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const smells = [INVESTIGATE, NO_DIAG, ALERT];
  const findings = {
    evidence: [{ command: 'node run.mjs stale-state --json', output: '3 leases held by dead sessions' }],
    recommendation: { whatIsWrong: 'leaked leases starve the pool', productChange: 'reap leases whose session died', nextStep: 'run the lease reaper now' },
  };

  it('dispatch → no second agent → record → stopped and rendered; off by default writes nothing', async () => {
    const e = ep('lane-starvation', 'we');
    const dispatched = [];
    const stopped = [];
    const dispatch = async (t) => { dispatched.push(t); return { session: sessionSlugFor(t.episodeId, HEALTH_INVESTIGATE_KIND), handle: 'h-1' }; };
    const stop = (h) => { stopped.push(h); return { stopped: true }; };

    // off (the default config): nothing happens, no ledger file
    const off = await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, now: NOW, dispatch, stop });
    expect(off.dispatched).toEqual([]);
    expect(existsSync(ledgerPath(dir))).toBe(false);

    const state1 = { episodes: byKey({ ...e }) };
    const t1 = await runInvestigations({ dir, state: state1, smells, config: ON, now: NOW, dispatch, stop });
    expect(t1.dispatched).toHaveLength(1);
    expect(readLedger(dir)[0]).toMatchObject({ status: 'running', handle: 'h-1', deadlineAt: NOW + 20 * MINUTE });
    expect(state1.episodes[e.key].investigationStatus.status).toBe('running');

    // next tick: the same open episode never gets a second agent
    const t2 = await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW + 5 * MINUTE, dispatch, stop });
    expect(t2.dispatched).toEqual([]);
    expect(dispatched).toHaveLength(1);

    // the agent records — wrong session refused, right one accepted once
    expect(() => recordFindings({ dir, episodeId: e.id, session: 'health-other', input: findings })).toThrow(/belongs to session/);
    let out = '';
    const code = main(['record', `--episode=${e.id}`, `--session=${sessionSlugFor(e.id, HEALTH_INVESTIGATE_KIND)}`, `--state-root=${root}`], {
      readStdin: () => JSON.stringify(findings), out: (s) => { out += s; }, err: () => {},
    });
    expect(code).toBe(0);
    expect(out).toMatch(/findings recorded/);
    expect(() => recordFindings({ dir, episodeId: e.id, session: sessionSlugFor(e.id, HEALTH_INVESTIGATE_KIND), input: findings })).toThrow(/already recorded/);

    // next tick: session stopped, episode carries the findings, the report renders them
    const state3 = { episodes: byKey({ ...e }) };
    const t3 = await runInvestigations({ dir, state: state3, smells, config: ON, now: NOW + 8 * MINUTE, dispatch, stop });
    expect(stopped).toEqual(['h-1']);
    expect(t3.stopped[0]).toMatchObject({ why: 'findings-recorded', ok: true });
    expect(readLedger(dir)[0].status).toBe('finished');
    const md = renderEpisodeReport(state3.episodes[e.key], { now: NOW, smell: INVESTIGATE, plan: [] });
    expect(md).toContain('## Agent investigation');
    expect(md).toContain('reap leases whose session died');
    expect(md).toContain('3 leases held by dead sessions');
    // …and a recorded investigation refuses further writes
    expect(() => recordFindings({ dir, episodeId: e.id, session: sessionSlugFor(e.id, HEALTH_INVESTIGATE_KIND), input: findings })).toThrow(/finished|already/);
  });

  it('stops a silent agent at the wall clock (through the injected reaper stop) and never re-dispatches the episode', async () => {
    const e = ep('lane-starvation', 'we');
    const stopped = [];
    const dispatch = async (t) => ({ session: sessionSlugFor(t.episodeId, HEALTH_INVESTIGATE_KIND), handle: 'h-2' });
    const stop = (h) => { stopped.push(h); };
    await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW, dispatch, stop });
    await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW + 10 * MINUTE, dispatch, stop });
    expect(stopped).toEqual([]);
    const t = await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW + 15 * MINUTE, dispatch, stop });
    expect(stopped).toEqual(['h-2']);
    expect(t.stopped[0].why).toBe('wall-clock');
    expect(t.dispatched).toEqual([]);
    expect(readLedger(dir)[0].status).toBe('stopped-wall-clock');
  });

  it('a failed stop keeps the entry running (and holding the slot) with the error, retried next tick', async () => {
    const e = ep('lane-starvation', 'we');
    const dispatch = async (t) => ({ session: sessionSlugFor(t.episodeId, HEALTH_INVESTIGATE_KIND), handle: 'h-3' });
    await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW, dispatch, stop: () => {} });
    const state = { episodes: byKey({ ...e }) };
    await runInvestigations({ dir, state, smells, config: ON, now: NOW + 16 * MINUTE, dispatch, stop: () => { throw new Error('claude stop failed'); } });
    expect(readLedger(dir)[0]).toMatchObject({ status: 'running', lastStopError: 'claude stop failed' });
    expect(state.episodes[e.key].investigationStatus.reason).toMatch(/last stop attempt failed/);
  });

  it('a dispatch failure is recorded as the episode\'s one attempt, never retried every tick', async () => {
    const e = ep('lane-starvation', 'we');
    let calls = 0;
    const dispatch = async () => { calls += 1; throw new Error('claude could not be started (ENOENT)'); };
    const t1 = await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW, dispatch, stop: () => {} });
    expect(t1.failed[0].error).toMatch(/ENOENT/);
    await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW + 5 * MINUTE, dispatch, stop: () => {} });
    expect(calls).toBe(1);
  });

  it('findings for an episode that closed before they landed are appended to its report once', async () => {
    const e = ep('lane-starvation', 'we');
    const dispatch = async (t) => ({ session: sessionSlugFor(t.episodeId, HEALTH_INVESTIGATE_KIND), handle: 'h-4' });
    await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW, dispatch, stop: () => {} });
    writeFileSync(join(dir, 'episodes', `${e.id}.md`), '# closed report\n');
    recordFindings({ dir, episodeId: e.id, session: sessionSlugFor(e.id, HEALTH_INVESTIGATE_KIND), input: findings });
    await runInvestigations({ dir, state: { episodes: {} }, smells, config: ON, now: NOW + 6 * MINUTE, dispatch, stop: () => {} });
    await runInvestigations({ dir, state: { episodes: {} }, smells, config: ON, now: NOW + 11 * MINUTE, dispatch, stop: () => {} });
    const md = readFileSync(join(dir, 'episodes', `${e.id}.md`), 'utf8');
    expect(md.match(/## Agent investigation/g)).toHaveLength(1);
    expect(md).toContain('leaked leases starve the pool');
  });

  it('dry-run decides but performs nothing', async () => {
    const e = ep('lane-starvation', 'we');
    let calls = 0;
    const t = await runInvestigations({ dir, state: { episodes: byKey({ ...e }) }, smells, config: ON, now: NOW, dryRun: true, dispatch: async () => { calls += 1; return {}; }, stop: () => {} });
    expect(t.dispatched[0]).toMatchObject({ dryRun: true });
    expect(calls).toBe(0);
    expect(existsSync(ledgerPath(dir))).toBe(false);
  });
});
