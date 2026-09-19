import { describe, it, expect, vi } from 'vitest';
import { runnerActivityOperation } from '../runner-activity.mjs';
import { collectRunnerActivity, createRunnerActivityReader, READ_TIMEOUT_MS } from '../runner-activity-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { runOperationCli } from '../cli-adapter.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';

const NOW = '2026-09-15T12:00:00.000Z';
const fresh = '2026-09-15T11:59:00.000Z';
const old = '2026-09-15T10:00:00.000Z';
const lease = { owner: 'host:42:conveyor-runner', pid: 42, heartbeatAt: fresh };
const tick = { tick: 7, at: fresh, stalled: [], dispatch: {}, statusLine: 'quiet' };

function fixture({ lock = lease, status = tick, records = [], agents = [], dead = false } = {}) {
  const store = { list: vi.fn(() => records.map((r) => r.id)), read: vi.fn((id) => records.find((r) => r.id === id)),
    write: vi.fn(() => { throw new Error('unexpected write'); }), delete: vi.fn(() => { throw new Error('unexpected delete'); }) };
  const io = {
    env: {}, now: () => new Date(NOW), storeFor: vi.fn(() => store),
    readText: vi.fn((path) => path.endsWith('lock.json') ? lock && JSON.stringify(lock) : status && JSON.stringify(status)),
    exec: vi.fn(() => {
      if (dead) throw Object.assign(new Error('no process'), { status: 1, stderr: '' });
      return 'node /driver/skills-src/conveyor/runner.mjs';
    }),
    listAgents: vi.fn(() => agents),
  };
  const readActivity = (input) => collectRunnerActivity(input, io);
  return { io, store, readActivity };
}

async function report(f, argv = ['--json']) {
  const declaration = runnerActivityOperation({ readActivity: f.readActivity });
  const registry = createRegistry();
  registry.register(declaration);
  const out = await runOperationCli({ declaration, registry, store: createMemoryRunStore(),
    argv, sinks: {}, newRunId: () => 'activity-test' });
  return { ...out, payload: JSON.parse(out.lines.join('\n')) };
}

function dispatch(id, status = 'in-flight', extra = {}) {
  return { id, effects: [{ key: `${id}:dispatch:0`, step: 'dispatch', type: DISPATCH_EFFECT,
    status, handle: ' SESSION-A ', startedAt: old, expectedBy: old,
    payload: { num: '123', launchKind: 'prepare-decision' }, ...extra }] };
}

describe('runner-activity through the declared CLI adapter', () => {
  it('reports down with no runner and no durable data', async () => {
    const f = fixture({ lock: null, status: null });
    const out = await report(f);
    expect(out.code).toBe(0);
    expect(out.payload.verdict).toMatchObject({ state: 'down', stalled: false, dispatching: false,
      runner: { pid: null, alive: false }, lastTick: { number: null, at: null } });
    expect(f.io.exec).not.toHaveBeenCalled();
    expect(f.io.listAgents).not.toHaveBeenCalled();
    expect(f.store.write).not.toHaveBeenCalled();
    expect(f.store.delete).not.toHaveBeenCalled();
    expect(out.payload.applied).toEqual([]);
  });

  it('keeps alive-and-idle distinct from a stalled runner', async () => {
    const out = await report(fixture());
    expect(out.payload.verdict).toMatchObject({ state: 'alive-and-idle', stalled: false,
      runner: { pid: 42, alive: true, heartbeatAt: fresh }, lastTick: { number: 7, at: fresh, proxy: false } });
    expect(out.payload.verdict.stalledReason).toMatch(/Quiet work is not a stall/);
    expect(out.payload.verdict.checkout).toBe('/driver');
  });

  it.each([
    ['/elsewhere', '../driver/skills-src/conveyor/runner.mjs'],
    ['/driver/skills-src', 'conveyor/runner.mjs'],
  ])('resolves a live relative invocation from %s: %s', async (cwd, script) => {
    const f = fixture();
    f.io.exec.mockImplementation((file) => file === 'ps' ? `node ${script}` : `p42\nn${cwd}\n`);
    f.io.readText.mockImplementation((path) => path.endsWith('lock.json') ? JSON.stringify(lease)
      : path === '/driver/.conveyor/driver-status.json' ? JSON.stringify(tick) : null);
    const out = await report(f);
    expect(out.payload.verdict).toMatchObject({
      state: 'alive-and-idle', checkout: '/driver', runner: { alive: true },
      lastTick: { number: 7, at: fresh },
    });
    expect(f.io.storeFor).toHaveBeenCalledWith('/driver');
  });

  it('reports alive-and-stalled when the existing heartbeat window expires', async () => {
    const out = await report(fixture({ lock: { ...lease, heartbeatAt: old }, status: { ...tick, at: old } }));
    expect(out.payload.verdict).toMatchObject({ state: 'alive-and-stalled', stalled: true });
    expect(out.payload.verdict.stalledReason).toMatch(/lease window/);
  });

  it('uses the tick core held-work diagnosis even with a fresh heartbeat', async () => {
    const out = await report(fixture({ status: { ...tick, stalled: [{ num: '123', reason: 'scope blocked', ticks: 3 }] } }));
    expect(out.payload.verdict.stalled).toBe(true);
    expect(out.payload.verdict.stalledReason).toContain('#123: scope blocked');
  });

  it('reports alive-and-dispatching independently of driver health, reusing normalized session liveness', async () => {
    const f = fixture({ records: [dispatch('live')], agents: [{ sessionId: 'session-a' }] });
    const out = await report(f);
    expect(out.payload.verdict).toMatchObject({ state: 'alive-and-idle', stalled: false, dispatching: true,
      dispatchLiveness: 'claude-agents' });
    expect(out.payload.verdict.inFlightDispatches[0]).toMatchObject({ launchKind: 'prepare-decision',
      live: true, ageMs: 7_200_000, holds: true });
    expect(f.io.listAgents).toHaveBeenCalledTimes(1);
    expect(f.store.write).not.toHaveBeenCalled();
  });

  it('distinguishes dead from down even when the lease is still fresh', async () => {
    expect((await report(fixture({ dead: true }))).payload.verdict.state).toBe('dead');
    const f = fixture();
    f.io.exec.mockReturnValue('node unrelated.mjs');
    expect((await report(f)).payload.verdict.state).toBe('dead');
  });

  it('does not call a missing first tick stalled while the lease is fresh', async () => {
    const out = await report(fixture({ status: null }));
    expect(out.payload.verdict).toMatchObject({ state: 'alive-and-idle', lastTick: { at: null, number: null } });
    expect(out.payload.verdict.stalledReason).toMatch(/no completed tick/i);
  });

  it('does not confuse planned launches or absent sessions with real work', async () => {
    const out = await report(fixture({ records: [dispatch('gone')], status: { ...tick, dispatch: { builds: [{ num: '999' }] } } }));
    expect(out.payload.verdict.dispatching).toBe(false);
    expect(out.payload.verdict.inFlightDispatches[0]).toMatchObject({ live: false, holds: false });
  });

  it('keeps an unreadable listing unknown; never persists a last-seen stamp', async () => {
    const f = fixture({ records: [dispatch('unknown')] });
    f.io.listAgents.mockImplementation(() => { throw new Error('timeout'); });
    const out = await report(f);
    expect(out.payload.verdict.dispatchLiveness).toBe('unreadable');
    expect(out.payload.verdict.inFlightDispatches[0].live).toBe(null);
    expect(f.store.write).not.toHaveBeenCalled();
  });

  it('returns the last N terminal effects with outcome and honest timestamp provenance', async () => {
    const older = dispatch('older', 'failed', { lastAttemptAt: old, error: 'spawn refused' });
    const newer = { ...dispatch('newer', 'applied', { result: { resolvedBy: 'pr-merged' } }),
      stepTimings: [{ step: 'dispatch', finishedAt: fresh }] };
    const f = fixture({ records: [newer, dispatch('still-live'), older, { id: 'no-launch', effects: [] }] });
    const out = await report(f, ['--json', '--limit=1']);
    expect(out.payload.verdict.completedAvailable).toBe(2);
    expect(out.payload.verdict.completedDispatches).toEqual([expect.objectContaining({ runId: 'newer',
      outcome: 'applied', at: fresh, timestampSource: 'run.stepTimings.finishedAt' })]);
    const all = (await report(f)).payload.verdict.completedDispatches;
    expect(all[1]).toMatchObject({ outcome: 'failed', error: 'spawn refused', timestampSource: 'last-attempt-proxy' });
  });

  it('reports partial history and refuses failed required reads instead of claiming down', async () => {
    const f = fixture({ records: [dispatch('corrupt')] });
    f.store.read.mockImplementation(() => { throw new Error('corrupt'); });
    expect((await report(f)).payload.verdict.unreadableRunRecords).toBe(1);
    f.store.list.mockImplementation(() => { throw new Error('unreadable store'); });
    expect((await report(f)).code).toBe(1);
    const bad = fixture();
    bad.io.readText.mockReturnValue('{');
    expect((await report(bad)).code).toBe(1);
    const timeout = fixture();
    timeout.io.exec.mockImplementation(() => { throw Object.assign(new Error('timeout'), { signal: 'SIGKILL' }); });
    expect((await report(timeout)).code).toBe(1);
  });

  it('validates N before making any external read', async () => {
    const f = fixture();
    for (const limit of ['-1', '1.5', '1001']) expect((await report(f, ['--json', `--limit=${limit}`])).code).toBe(1);
    expect(f.io.readText).not.toHaveBeenCalled();
  });
});

describe('hard read deadlines', () => {
  it('bounds the entire snapshot, including synchronous store/file reads, with SIGKILL', () => {
    const run = vi.fn(() => JSON.stringify({ sentinel: true }));
    expect(createRunnerActivityReader({ run })({ limit: 3 })).toEqual({ sentinel: true });
    expect(run.mock.calls[0][1].slice(-2)).toEqual(['--snapshot', '{"limit":3}']);
    expect(run.mock.calls[0][2]).toMatchObject({ timeout: READ_TIMEOUT_MS, killSignal: 'SIGKILL' });
    run.mockImplementation(() => { throw new Error('deadline'); });
    expect(() => createRunnerActivityReader({ run })({})).toThrow('deadline');
  });

  it('bounds process identity reads inside the snapshot', () => {
    const f = fixture();
    f.readActivity({ limit: 10 });
    expect(f.io.exec.mock.calls[0][2]).toMatchObject({ timeout: 2000, killSignal: 'SIGKILL' });
  });

  it('bounds the existing agent listing even when the environment requests an unbounded read', () => {
    const f = fixture({ records: [dispatch('live')] });
    const exec = vi.fn((file) => file === 'ps' ? 'node /driver/skills-src/conveyor/runner.mjs' : '[]');
    collectRunnerActivity({}, { ...f.io, listAgents: undefined, exec,
      env: { WE_DISPATCH_LIST_TIMEOUT_MS: '0' } });
    expect(exec.mock.calls.find(([file]) => file === 'claude')[2]).toMatchObject({ timeout: 2000, killSignal: 'SIGKILL' });
  });
});
