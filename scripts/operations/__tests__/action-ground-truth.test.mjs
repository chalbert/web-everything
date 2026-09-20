/** #3383 — Ground truth and default wiring, with no real gh/claude or network. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createGroundTruthPorts, defaultGroundTruth } from '../action-ground-truth.mjs';
import { createActionStore } from '../action-store.mjs';
import { actionResource, ABSENCE_GRACE_MS } from '../action-record.mjs';
import { guardedDispatch, reconcileActions } from '../action-dispatch.mjs';
import { createTickCoordination } from '../../../skills-src/conveyor/runner.mjs';
import { dispatchReview, dispatchReviewCli } from '../review-dispatch.mjs';
import { dispatchReviewWrapperCli, dispatchReviewMechanical } from '../review-dispatch-wrapper.mjs';
import { dispatchFix } from '../../conveyor/reconcile-fix-dispatch.mjs';

const resource = actionResource('we', { type: 'pr', id: 77 });
let clock, actions, pr, sessions, listingError, ghError, savedPath;
const shellPath = () => join(process.env.WE_COORDINATION_ROOT, 'ground-truth.json');
const syncShell = () => writeFileSync(shellPath(), JSON.stringify({ pr, sessions, listingError: !!listingError, ghError: !!ghError }));
const shellCalls = () => {
  const p = join(process.env.WE_COORDINATION_ROOT, 'calls.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse) : [];
};
const now = () => clock;
const listing = vi.fn(() => { if (listingError) throw listingError; return sessions; });
const run = vi.fn((cmd, args) => {
  expect(cmd).toBe('gh');
  expect(args).toEqual(['pr', 'view', '77', '--repo', 'chalbert/web-everything', '--json', 'state,labels']);
  if (ghError) throw ghError;
  return JSON.stringify(pr);
});
const ports = () => createGroundTruthPorts({ run, listAgentsFn: listing, now, isPidAlive: () => false });
const dispatch = (extra = {}) => { syncShell(); return guardedDispatch({ resource, kind: 'review', owner: 'a', actions, now,
  effect: () => ({ handle: 'review-pr-123' }), ...extra }); };
const aged = (extra = {}) => { const r = dispatch(extra).record; clock += ABSENCE_GRACE_MS + 1; return r; };
beforeEach(() => {
  vi.clearAllMocks();
  clock = Date.now() - 2 * ABSENCE_GRACE_MS;
  actions = createActionStore({ now });
  pr = { state: 'OPEN', labels: [{ name: 'review:pending' }] };
  sessions = []; listingError = null; ghError = null;
  savedPath = process.env.PATH;
  const root = process.env.WE_COORDINATION_ROOT;
  for (const cmd of ['gh', 'claude']) writeFileSync(join(root, cmd), `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ground-truth.json'), 'utf8'));
const cmd = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, 'calls.jsonl'), JSON.stringify({ cmd, args }) + '\\n');
const expected = cmd === 'gh' ? ['pr', 'view', '77', '--repo', 'chalbert/web-everything', '--json', 'state,labels'] : ['agents', '--json', '--all'];
if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error('unexpected argv');
if (cmd === 'gh' ? data.ghError : data.listingError) throw new Error('offline');
process.stdout.write(JSON.stringify(cmd === 'gh' ? data.pr : data.sessions));
`, { mode: 0o755 });
  process.env.PATH = `${root}:${savedPath}`;
  syncShell();
});

afterEach(() => { process.env.PATH = savedPath; });

describe('ground-truth ports', () => {
  it('review settles only after review:pending disappears', async () => {
    const r = aged();
    expect(ports().postconditionHolds(r)).toBe(false);
    pr.labels = [{ name: 'review:changes' }];
    expect(ports().postconditionHolds(r)).toBe(true);
    expect((await reconcileActions({ actions, ...ports(), now }))[0].record.outcome).toBe('settled');
  });
  it.each(['MERGED', 'CLOSED'])('%s PR settles even with its old review label', (state) => {
    const r = aged(); pr.state = state;
    expect(ports().postconditionHolds(r)).toBe(true);
  });
  it('fix needs both label removal and handle absence, using the existing prefix matcher', () => {
    const r = aged({ kind: 'fix', effect: () => 'aabbccdd' });
    pr.labels = [{ name: 'review:changes' }];
    expect(ports().postconditionHolds(r)).toBe(false);
    pr.labels = [];
    sessions = [{ sessionId: 'aabbccdd-1234', name: 'fix-77', state: 'working' }];
    expect(ports().postconditionHolds(r)).toBe(false);
    sessions = [];
    expect(ports().postconditionHolds(r)).toBe(true);
  });
  it.each(['done', 'failed', 'stopped'])('historical %s sessions remain evidence, but do not keep an aged handle live', (state) => {
    const r = dispatch({ kind: 'fix', evidence: { sessionSlug: 'fix-77' }, effect: () => 'aabbccdd' }).record;
    pr.labels = [];
    sessions = [{ sessionId: 'aabbccdd-1234', name: 'fix-77', state }];
    expect(ports().listAgents()).toEqual([{ ...sessions[0], handle: 'aabbccdd-1234' }]);
    expect(ports().findEffect(r)).toEqual({ found: true, handle: 'aabbccdd-1234' });
    expect(ports().postconditionHolds(r)).toBe(false);
    clock += 10 * 60_000;
    expect(ports().postconditionHolds(r)).toBe(true);
    pr.labels = [{ name: 'review:changes' }];
    expect(ports().postconditionHolds(r)).toBe(false);
  });
  it('unknown session state remains live', () => {
    const r = aged({ kind: 'fix', effect: () => 'aabbccdd' }); pr.labels = [];
    sessions = [{ sessionId: 'aabbccdd-1234', name: 'fix-77' }];
    expect(ports().postconditionHolds(r)).toBe(false);
  });
  it('closing a PR still needs its applicable handle signal', () => {
    const r = aged({ kind: 'fix', effect: () => 'aabbccdd' });
    pr.state = 'CLOSED'; sessions = [{ sessionId: 'aabbccdd', state: 'working' }];
    expect(ports().postconditionHolds(r)).toBe(false);
    sessions = [];
    expect(ports().postconditionHolds(r)).toBe(true);
  });
  it.each(['pid:44', 'detached:44'])('checks %s with the pid reader and listing, plus label rule', (handle) => {
    const r = aged({ kind: 'fix', effect: () => handle }); pr.labels = [];
    const isPidAlive = vi.fn(() => true);
    const p = createGroundTruthPorts({ run, listAgentsFn: listing, isPidAlive, now });
    expect(p.postconditionHolds(r)).toBe(false);
    expect(isPidAlive).toHaveBeenCalledWith(44);
    isPidAlive.mockReturnValue(false);
    expect(p.postconditionHolds(r)).toBe(true);
    listingError = new Error('offline');
    expect(() => p.postconditionHolds(r)).toThrow('offline');
  });
  it('empty listing cannot settle a fresh dispatch, even after heartbeats change updatedAt', () => {
    const r = dispatch({ effect: () => 'aabbccdd' }).record; pr.labels = [];
    clock += 10 * 60_000 - 1;
    expect(ports().postconditionHolds(r)).toBe(false);
    clock++;
    actions.heartbeat(resource, 1, r.ownerToken);
    expect(ports().postconditionHolds(actions.read(resource, 1))).toBe(true);
  });
  it('uses handle completion for item and non-review/fix PR kinds', () => {
    const r = aged({ kind: 'ci-heal', effect: () => 'aabbccdd' });
    expect(ports().postconditionHolds(r)).toBe(true);
    expect(ports().postconditionHolds({ ...r, subject: { type: 'item', id: 'xone' } })).toBe(true);
    expect(ports().postconditionHolds({ ...r, handle: null, subject: { type: 'item', id: 'xone' } })).toBe(false);
  });
  it.each(['gh', 'listing'])('%s failure holds even a very old observed record', async (reader) => {
    aged({ kind: 'fix', effect: () => 'aabbccdd' }); pr.labels = [];
    clock += 2 * 24 * 60 * 60_000;
    if (reader === 'gh') ghError = new Error('offline'); else listingError = new Error('offline');
    expect((await reconcileActions({ actions, ...ports(), now }))[0].reason).toBe('held:indeterminate');
    expect(actions.read(resource, 1).state).toBe('observed');
  });
  it.each([null, {}, { state: 'OPEN' }, { state: 'OPEN', labels: [null] }])('refuses unreadable PR evidence: %j', (data) => {
    const r = aged(); pr = data;
    expect(() => ports().postconditionHolds(r)).toThrow();
  });
  it('normalizes sessions, preserves state, and finds positive slug evidence only', () => {
    sessions = [{ sessionId: 'aabbccdd-1234', name: 'review-77', state: 'blocked', extra: true }];
    syncShell();
    const p = defaultGroundTruth();
    expect(p.listAgents()).toEqual([{ sessionId: 'aabbccdd-1234', handle: 'aabbccdd-1234', name: 'review-77', state: 'blocked' }]);
    expect(p.findEffect({ evidence: { sessionSlug: 'review-77' } })).toEqual({ found: true, handle: 'aabbccdd-1234' });
    expect(p.findEffect({ evidence: { sessionSlug: 'review-78' } })).toEqual({ found: false });
    listingError = new Error('unreadable'); syncShell();
    expect(() => p.findEffect({ evidence: {} })).toThrow();
  });
  it.each([null, {}, [null], [{ name: 'review-77' }]])('rejects malformed listings: %j', (data) => {
    sessions = data;
    expect(() => ports().findEffect({ evidence: {} })).toThrow('Unreadable agent listing');
  });
  it('supports async injected readers and rejected promises', async () => {
    const r = aged({ kind: 'fix', effect: () => 'aabbccdd' }); pr.labels = [];
    const p = createGroundTruthPorts({ run: async (...args) => run(...args), listAgentsFn: async () => listing(), now });
    expect(await p.postconditionHolds(r)).toBe(true);
    listingError = new Error('offline');
    expect((await actions.reconcile(r, p)).reason).toBe('held:indeterminate');
  });
});

describe('unwedging defaults and retries', () => {
  it('reconcileActions settles a completed review; the same PR gets attempt 2 automatically', async () => {
    aged(); pr.labels = [];
    expect((await reconcileActions({ actions, ...ports(), now }))[0].record.outcome).toBe('settled');
    expect(dispatch().record).toMatchObject({ state: 'observed', attempt: 2 });
  });
  it('default claim-time ports settle an expired observed action without a separate tick', () => {
    aged(); pr.labels = [];
    expect(dispatch().record).toMatchObject({ attempt: 2, state: 'observed' });
    expect(actions.read(resource, 1).outcome).toBe('settled');
    expect(shellCalls().some((c) => c.cmd === 'gh')).toBe(true);
  });
  it('default tick ports settle observed records; explicit ports win', async () => {
    aged(); pr.labels = [];
    const explicit = createTickCoordination({ actions, now, postconditionHolds: () => false });
    expect((await explicit.reconcileActions())[0].reason).toBe('held');
    expect(run).not.toHaveBeenCalled();
    syncShell();
    expect((await createTickCoordination({ actions, now }).reconcileActions())[0].record.outcome).toBe('settled');
  });
  it('tick defaults adopt slug evidence, while explicit absence ports take precedence', async () => {
    aged({ effect: () => null, evidence: { sessionSlug: 'review-77' } });
    sessions = [{ sessionId: 'aabbccdd-1234', name: 'review-77', state: 'working' }]; syncShell();
    expect((await createTickCoordination({ actions, now }).reconcileActions())[0].record)
      .toMatchObject({ state: 'observed', handle: 'aabbccdd-1234' });
    expect(shellCalls().filter((c) => c.cmd === 'claude')).toHaveLength(2);
    const record = actions.claim({ resource: actionResource('we', { type: 'pr', id: 78 }), kind: 'review', owner: 'a' }).record;
    actions.transition(record.resource, record.attempt, { token: record.ownerToken, from: 'intent', to: 'dispatching', patch: { dispatchingSince: now() } });
    clock += ABSENCE_GRACE_MS + 1;
    const listing = vi.fn(() => []), findEffect = vi.fn(() => ({ found: false }));
    const results = await createTickCoordination({ actions, now, listAgents: listing, findEffect, postconditionHolds: () => false }).reconcileActions();
    expect(results.find((r) => r.record.resource === record.resource).record.outcome).toBe('abandoned-absent');
    expect(listing).toHaveBeenCalledTimes(1);
    expect(findEffect).toHaveBeenCalledTimes(1);
  });
  it('expiry releases nothing before grace; positive absence after grace allows attempt 2', () => {
    dispatch({ effect: () => null });
    clock += 10 * 60_000 + 1;
    expect(dispatch()).toMatchObject({ held: true, reason: 'held:indeterminate' });
    clock += 5 * 60_000;
    expect(dispatch().record.attempt).toBe(2);
    expect(actions.read(resource, 1).outcome).toBe('abandoned-absent');
  });
  it('failed listing keeps expired dispatching held; recovering the listing permits retry', () => {
    aged({ effect: () => null }); listingError = new Error('offline');
    expect(dispatch()).toMatchObject({ held: true, reason: 'held:indeterminate' });
    expect(actions.read(resource, 1).state).toBe('dispatching');
    listingError = null;
    expect(dispatch().record.attempt).toBe(2);
  });
  it('an explicit reconcile port wins over the default', async () => {
    aged({ effect: () => null });
    const reconcile = vi.fn(async (record) => ({ ok: false, reason: 'custom', record }));
    expect(await dispatch({ reconcile })).toMatchObject({ held: true, reason: 'custom' });
    expect(shellCalls()).toEqual([]);
  });
  it('async absence reconciliation supports retry through guardedDispatch', async () => {
    aged({ effect: () => null });
    expect((await dispatch({ reconcile: (r) => actions.reconcile(r, {
      listAgents: async () => [], findEffect: async () => ({ found: false }),
    }) })).record.attempt).toBe(2);
  });
  it('manual review and fix entry points stay synchronous through default reconciliation', () => {
    aged(); pr.labels = [];
    syncShell();
    const review = dispatchReview({ pr: 77, repo: 'we', actions, now, root: '/fake-primary',
      spawnAgent: () => 'backgrounded · aabbccdd · review-77', readBrief: () => '# review', checkStaleness: () => ({ fresh: true }) });
    expect(review.agentId).toBe('aabbccdd');
    clock += ABSENCE_GRACE_MS + 1;
    syncShell();
    const fix = dispatchFix({ pr: 77, itemNum: 'xone', lane: 1, laneRef: 'lane/xone', scope: ['we:scripts/'] }, {
      actions, now, root: '/fake-primary', spawnAgent: () => 'backgrounded · eeff1122 · fix-77', readBrief: () => '# fix',
    });
    expect(fix.agentId).toBe('eeff1122');
    expect(actions.read(resource, 3).state).toBe('observed');
  });
});

it.each([
  ['ENOENT', undefined, 'dispatching'], ['EACCES', 'open', 'dispatching'],
  ['ENOENT', 'spawn claude', 'terminal'], ['EACCES', 'spawn', 'terminal'],
])('preSpawn %s / %s retains or frees only on proof', (code, syscall, state) => {
  expect(() => dispatch({ effect: () => { throw Object.assign(new Error('failure'), { code, syscall }); } })).toThrow('failure');
  expect(actions.read(resource, 1).state).toBe(state);
  if (state === 'terminal') expect(dispatch().record.attempt).toBe(2);
});
it('explicit notStarted effect preserves value and frees the resource', () => {
  const result = { notStarted: true, value: { why: 'no lane' } };
  expect(dispatch({ effect: () => result })).toMatchObject({ dispatched: true, notStarted: true, result,
    record: { state: 'terminal', outcome: 'not-started' } });
  expect(dispatch().record.attempt).toBe(2);
});

it.each(['review', 'wrapper'])('%s CLI frees a blocked mechanical review and preserves successful run ids', (entry) => {
  const output = [], errors = [];
  const fakeRun = vi.fn((cmd, args) => {
    expect(cmd).toBe('node');
    if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
    if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return '';
    throw new Error(`unexpected command: ${cmd} ${args}`);
  });
  const dispatchMechanical = vi.fn((params) => dispatchReviewMechanical(params, { run: fakeRun, newActorId: () => 'actor' }));
  const cli = entry === 'review' ? (args, io) => dispatchReviewCli(args, io).code : dispatchReviewWrapperCli;
  const invoke = () => { syncShell(); return cli(['--pr=77', '--repo=chalbert/web-everything'], {
    actions, now, dispatchMechanical, write: (s) => output.push(s), writeErr: (s) => errors.push(s),
  }); };
  expect(invoke()).toBe(1);
  expect([...output, ...errors].join('')).toContain('could NOT review');
  expect(actions.read(resource, 1)).toMatchObject({ state: 'terminal', outcome: 'not-started' });
  dispatchMechanical.mockReturnValue({ repo: 'chalbert/web-everything', pr: 77, sessionSlug: 'review-77',
    classified: { outcome: 'auto-cleared', runId: 'review-pr-done' } });
  expect(invoke()).toBe(0);
  expect(actions.read(resource, 2)).toMatchObject({ state: 'observed', handle: 'review-pr-done' });
  clock += ABSENCE_GRACE_MS + 1; pr.labels = [];
  expect(invoke()).toBe(0);
  expect(actions.read(resource, 2).outcome).toBe('settled');
  expect(actions.read(resource, 3).state).toBe('observed');
});
