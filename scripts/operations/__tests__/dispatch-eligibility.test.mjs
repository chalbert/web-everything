import { describe, expect, it, vi } from 'vitest';
import { dispatchPlan, selectClearedRows, clearedNotReady } from '../../readiness/dispatch-plan.mjs';
import { normNum } from '../../conveyor/queue-store.mjs';
import { planTick } from '../../conveyor/tick-core.mjs';
import { createTickReader } from '../dispatch-lane-io.mjs';
import { dispatchLaneOperation, shapeDispatchRead } from '../dispatch-lane.mjs';
import { dispatchEligibilityOperation } from '../dispatch-eligibility.mjs';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning } from '../engine.mjs';
import { runOperationCli } from '../cli-adapter.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { resolveOperation } from '../run.mjs';

// The older dispatch-lane harness has one local, assumed launch row, not a reusable
// queue. This corpus exercises the real build planner as well as the dispatch predicate.
const queue = [
  { num: '9001', deliveryAgent: 'claude' },
  { num: '9002', openBlockers: ['8999'] },
  { num: '9003', deliveryAgent: 'claude' },
  { num: '9004' }, // No deliveryAgent: the real dispatcher does not require it.
].map((row) => ({
  kind: 'story', status: 'open', slug: 'fixture', buildQueued: true,
  scope: [`we:scripts/item-${row.num}.mjs`], openBlockers: [], ...row,
}));
const now = new Date('2026-09-15T12:00:00Z');

function fixture(options = {}, tickOptions = {}) {
  const inputs = { queue, leases: [], freeLanes: [901, 902, 903, 904], ...options };
  const plain = dispatchPlan(inputs);
  const plan = dispatchPlan({ ...inputs, trace: true });
  expect({ launch: plan.launch, held: plan.held }).toEqual(plain);
  const tick = planTick({ state: { queue: inputs.queue }, plan, freeLanes: inputs.freeLanes, ...tickOptions });
  const runNode = vi.fn(() => JSON.stringify(tick));
  const recordLiveness = vi.fn((rows) => rows);
  const readTick = createTickReader({
    runNode, recordLiveness,
    loadItems: () => inputs.queue,
    readText: () => 'Build #{{ITEM_NUM}} on {{LANE}} with {{SCOPE}}',
    checkAlreadyDone: () => ({ done: false, pr: null, checked: true }),
    listInFlightDispatches: (num) => ({
      runs: num === '9003' ? [{ runId: 'prior', handle: 'live-agent', startedAt: now.toISOString() }] : [],
      unreadable: 0,
    }),
    listAgents: () => [{ id: 'live-agent' }],
    now: () => now,
  });
  return { readTick, runNode, recordLiveness };
}

function execute(declaration, input) {
  const registry = createRegistry();
  registry.register(declaration);
  return advanceWhileRunning(startRun({ op: declaration.name, id: 'fixture', input, registry }), { registry });
}

async function cli(readTick, argv) {
  const declaration = dispatchEligibilityOperation({ readTick });
  const registry = createRegistry();
  registry.register(declaration);
  return runOperationCli({ declaration, registry, argv, store: createMemoryRunStore(), sinks: {}, newRunId: () => 'report' });
}

describe('dispatch-eligibility agrees with the live admission path', () => {
  it('runs the real dispatcher and report over the same queue, including all four required cases', () => {
    const { readTick, runNode } = fixture();
    const report = execute(dispatchEligibilityOperation({ readTick }), {}).verdict.items;
    expect(runNode).toHaveBeenCalledTimes(1); // one snapshot, not one scheduler run per item
    expect(report.map((row) => row.num)).toEqual(queue.map((row) => row.num));
    for (const row of report) {
      const dispatch = execute(dispatchLaneOperation({ readTick }), { num: row.num });
      expect(row.eligible).toBe(dispatch.verdict.dispatching);
      expect(row.gates).toEqual(dispatch.findings.read.gates);
      expect(row.eligible).toBe(shapeDispatchRead(readTick({ num: row.num }), { num: row.num }).dispatching);
    }
    expect(report.map((row) => row.eligible)).toEqual([true, false, false, true]);
    expect(report.map((row) => row.firstBlockingGate)).toEqual([null, 'blockedBy', 'in-flight-dispatch', null]);
    expect(report[0].gates.map((gate) => gate.name)).toEqual([
      'in-flight-dispatch', 'already-done', 'blockedBy', 'tick-launch', 'assigned-lane', 'item-spec', 'scope',
    ]);
    expect(report[1].gates.at(-1)).toEqual({ name: 'blockedBy', pass: false, observed: ['8999'] });
    expect(report[2].gates).toHaveLength(1); // no invented passes after a short-circuit
    expect(report[3].markers.deliveryAgent).toBeNull();
  });

  it.each([
    [{ freeLanes: [] }, 'lane-capacity'],
    [{ leases: [{ lane: 800, scope: queue[0].scope }] }, 'scope-overlap-lease'],
    [{ dispatchPaused: true }, 'dispatch-paused'],
    [{ driftBlockedScope: queue[0].scope }, 'branch-drift'],
  ])('carries the actual planner gate and observations for %j', (options, blocking) => {
    const { readTick } = fixture(options);
    const row = execute(dispatchEligibilityOperation({ readTick }), { item: '9001' }).verdict.items[0];
    expect(row.eligible).toBe(false);
    expect(row.firstBlockingGate).toBe(blocking);
    expect(row.buildAdmission.gates.at(-1)).toMatchObject({ name: blocking, pass: false });
    expect(row.gates.at(-1).observed.admission).toEqual(row.buildAdmission);
  });


  it.each([false, true])('reports the actual prepare route when an open PR exists: %s', (hasPr) => {
    const items = [{ ...queue[0], scope: [] }];
    const prs = hasPr ? [{ num: '9001', pr: 123, state: 'OPEN', labels: [] }] : [];
    const { readTick } = fixture({ queue: items }, { state: { queue: items, unshaped: items, prs } });
    const row = execute(dispatchEligibilityOperation({ readTick }), { item: '9001' }).verdict.items[0];
    const dispatch = execute(dispatchLaneOperation({ readTick }), { num: '9001' });
    expect(row.eligible).toBe(dispatch.verdict.dispatching);
    expect(row.eligible).toBe(!hasPr);
    expect(row.buildAdmission.gates.at(-1)).toMatchObject({ name: 'scope', pass: false });
    if (hasPr) {
      expect(row.firstBlockingGate).toBe('existing-PR');
      expect(row.buildAdmission.prepare.gates.at(-1)).toMatchObject({ name: 'existing-PR', pass: false, observed: prs[0] });
    } else {
      expect(row.firstBlockingGate).toBeNull();
      expect(row.launchKind).toBe('prepare');
    }
  });

  it('uses the generated JSON envelope and successful-held exit convention', async () => {
    const { readTick } = fixture();
    const result = await cli(readTick, ['--item=09002', '--json']);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.lines.join('\n'));
    expect(payload).toMatchObject({ op: 'dispatch-eligibility', stopped: 'complete', applied: [], inFlight: [] });
    expect(payload.verdict.items).toHaveLength(1);
    expect(payload.verdict.items[0]).toMatchObject({ num: '9002', eligible: false, firstBlockingGate: 'blockedBy' });
  });

  it('reports read failures as errors and a genuinely empty queue as empty', async () => {
    expect((await cli(() => { throw new Error('reader unavailable'); }, ['--json'])).code).toBe(1);
    const empty = await cli(() => [], ['--json']);
    expect(empty.code).toBe(0);
    expect(JSON.parse(empty.lines[0]).verdict.items).toEqual([]);
  });

  it('keeps a cleared-but-not-ready item in the whole-queue report', async () => {
    const sidecar = [{ num: '9004' }];
    const selection = [];
    const held = clearedNotReady(sidecar, [], normNum, (num, gate) => selection.push({ num, gates: [gate] }))
      .map((num) => ({ num, reason: 'cleared-but-not-ready' }));
    const plan = { ...dispatchPlan({ queue: [], trace: true }), held, cleared: sidecar, selection };
    const { readTick } = fixture({}, { state: { queue: [] }, plan });
    const result = await cli(readTick, ['--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.lines[0]).verdict.items).toEqual([
      expect.objectContaining({ num: '9004', eligible: false, firstBlockingGate: 'readiness' }),
    ]);
  });


  it('records readiness and queue membership from the existing selection predicates', () => {
    const observed = [];
    const observe = (num, gate) => observed.push({ num, ...gate });
    const ready = [{ num: '9001' }, { num: '9004' }];
    const sidecar = [{ num: '#09001' }, { num: '9002' }];
    expect(selectClearedRows(ready, new Set(sidecar.map((r) => normNum(r.num))), normNum, observe))
      .toEqual([{ num: '9001' }]);
    expect(clearedNotReady(sidecar, ready, normNum, observe)).toEqual(['9002']);
    expect(observed).toEqual([
      { num: '9001', name: 'queue-membership', pass: true, observed: { cleared: true } },
      { num: '9004', name: 'queue-membership', pass: false, observed: { cleared: false } },
      { num: '#09001', name: 'readiness', pass: true, observed: { inReadyBuildQueue: true } },
      { num: '9002', name: 'readiness', pass: false, observed: { inReadyBuildQueue: false } },
    ]);
  });

  it('is registered as compute-only with no dispatch sinks', () => {
    const { declaration, sinks } = resolveOperation('dispatch-eligibility');
    expect(declaration.steps.every(({ step }) => step.kind === 'compute')).toBe(true);
    expect(sinks).toEqual({});
  });
});
