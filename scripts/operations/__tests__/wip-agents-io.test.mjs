/** File-backed evidence and process-boundary failures, with no live agent launches. */
import { it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createWipAgentsReader } from '../wip-agents-io.mjs';
import { main } from '../wip-agents-cli.mjs';
import { classifyAgents, renderTable } from '../wip-agents.mjs';
import { CODEX_MODEL } from '../../codex-direct-task.mjs';
import { createMemoryRunStore, createFileRunStore, validateRunRecord } from '../run-store.mjs';
import { createRegistry, op } from '../registry.mjs';
import { effect } from '../step-kinds.mjs';
import { startRun, advanceWhileRunning } from '../engine.mjs';
import { inFlight, applyPendingEffects } from '../effect-executor.mjs';
import { createDispatchSinks, inFlightDispatchesFor } from '../dispatch-lane-io.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
const dirs = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function setup() {
  const home = mkdtempSync(join(tmpdir(), 'wip-agents-')); dirs.push(home);
  const project = join(home, '.claude/projects/-Users-x-workspace--operations-jobs'); mkdirSync(project, { recursive: true });
  const fixture = resolve('scripts/operations/__fixtures__/wip-agents');
  const agents = JSON.parse(readFileSync(join(fixture, 'agents.json'), 'utf8'));
  for (let i = 0; i < 5; i++) copyFileSync(join(fixture, `session-${i}.jsonl`), join(project, `session-${i}.jsonl`));
  return { home, project, agents };
}
it('reads fixture transcripts, versions once, missing evidence and all live sessions', () => {
  const { home, agents } = setup(), calls = [];
  const data = createWipAgentsReader({ homeDir: home, listAgents: () => agents, pidAlive: () => true, readDispatchRecords: () => new Map(), cliVersion: (p) => { calls.push(p); return '0.155.1'; }, now: () => 0 })();
  const rows = classifyAgents(data);
  expect(rows).toHaveLength(7);
  expect(rows.find((r) => r.id === 'missing')).toMatchObject({ supervisor: { model: 'unknown' }, executor: { source: 'unknown' }, state: 'waiting' });
  expect(rows.find((r) => r.id === '2').executor.providers[0].model).toBe(CODEX_MODEL);
  const table = renderTable(rows);
  expect(table).toContain('Codex (explicit, cli 0.155.1)');
  expect(table).toContain('Gemini (g2, cli 0.155.1)');
  expect(table).toContain('Gemini (unknown, cli 0.155.1)');
  expect(table).toContain('| none |');
  expect(calls).toEqual(['Codex', 'Gemini']);
});
it('falls back across project dirs and isolates an unreadable session and store', () => {
  const { home, agents } = setup(); agents[0].cwd = '/moved';
  const reader = createWipAgentsReader({ homeDir: home, listAgents: () => agents, readDispatchRecords: () => { throw Error('bad store'); }, cliVersion: () => { throw Error('missing cli'); } });
  expect(classifyAgents(reader()).find((r) => r.id === '0').supervisor.model).toBe('claude-exact');
  const broken = createWipAgentsReader({ homeDir: home, listAgents: () => agents, readDispatchRecords: () => new Map(), readTranscript: (_file, agent) => { if (agent.id === '0') throw Error('denied'); return { transcriptModel: 'claude-ok' }; } });
  const rows = classifyAgents(broken());
  expect(rows.find((r) => r.id === '0').supervisor.model).toBe('unknown');
  expect(rows.find((r) => r.id === '1').supervisor.model).toBe('claude-ok');
});
it('joins records by normalized full, prefix and independent short ids', () => {
  const { home, agents } = setup();
  for (const handle of [' SESSION-1 ', 'session-1', '1']) {
    const data = createWipAgentsReader({ homeDir: home, listAgents: () => agents, cliVersion: () => null, readDispatchRecords: () => new Map([[handle, { supervisorModel: 'claude-dispatch', executor: { provider: 'Codex', model: 'dispatch-model' } }]]) })();
    expect(classifyAgents(data).find((r) => r.id === '1')).toMatchObject({ supervisor: { model: 'claude-dispatch' }, executor: { source: 'dispatch', providers: [{ model: 'dispatch-model' }] } });
  }
});
it('scans at most the last 64 MB, and no-hit does not mean none', () => {
  const { home, project, agents } = setup();
  writeFileSync(join(project, 'session-0.jsonl'), ('x'.repeat(1023) + '\n').repeat(65 * 1024));
  const started = Date.now();
  const data = createWipAgentsReader({ homeDir: home, listAgents: () => [agents[0]], readDispatchRecords: () => new Map() })();
  expect(classifyAgents(data)[0].executor.source).toBe('unknown');
  expect(Date.now() - started).toBeLessThan(5000);
}, 10000);
it('preserves dispatch metadata through validated persistence and the in-flight reader', async () => {
  const registry = createRegistry();
  registry.register(op('wip-dispatch-test', { input: {}, go: effect({ reads: [], effects: () => [{ type: DISPATCH_EFFECT, payload: { num: '7' }, dispatch: true }] }) }));
  const run = advanceWhileRunning(startRun({ id: 'wip-roundtrip', op: 'wip-dispatch-test', input: {}, registry }), { registry });
  const store = createMemoryRunStore();
  const dispatch = { supervisorModel: 'claude-exact', launchKind: 'build', route: 'claude-bg', executor: { provider: 'Codex', model: CODEX_MODEL } };
  const result = await applyPendingEffects(run, { store, sinks: { [DISPATCH_EFFECT]: () => inFlight({ handle: 'session-1', dispatch }) } });
  expect(result.error).toBeNull();
  expect(validateRunRecord(store.read(run.id)).ok).toBe(true);
  expect(inFlightDispatchesFor('7', { store }).runs[0].dispatch).toEqual(dispatch);
  const { home, agents } = setup();
  vi.stubEnv('OPERATION_RUNS_DIR', join(home, 'runs'));
  mkdirSync(join(home, 'runs'));
  const fileStore = createFileRunStore();
  const persisted = store.read(run.id);
  persisted.effects[0].status = 'applied';
  fileStore.write(persisted);
  const data = createWipAgentsReader({ homeDir: home, listAgents: () => agents, cliVersion: () => null })();
  expect(classifyAgents(data).find((r) => r.id === '1').supervisor.source).toBe('dispatch');
  expect(inFlight({ handle: 's' })).not.toHaveProperty('dispatch');
  expect(inFlight({ handle: 's', dispatch: null }).dispatch).toBeNull();
  const cyclic = {}; cyclic.self = cyclic;
  for (const invalid of [[], new Date(), { f: () => {} }, { n: NaN }, cyclic, { n: 1n }]) expect(() => inFlight({ handle: 's', dispatch: invalid })).toThrow(TypeError);
});
it.each([['--model=sonnet'], ['-m', 'claude-exact'], ['--model', 'opus']])('records supervisor launch arguments and actual route: %j', async (...args) => {
  // Vitest expands array cases into positional arguments.
  const extraArgs = args;
  const sink = createDispatchSinks({ root: '/tmp/wip-primary', provider: () => 'pid:123', extraArgs });
  const result = await sink[DISPATCH_EFFECT]({ launchKind: 'build' });
  expect(result.dispatch.route).toBe('detached');
  expect(result.dispatch.supervisorModel).toBe(extraArgs.length === 1 ? 'sonnet' : extraArgs[1]);
  expect(result.dispatch.executor).toBeNull();
});
it('real CLI exits zero for odd sessions, emits JSON, and fails only on listing error', () => {
  const { home } = setup();
  const bin = join(home, 'bin'); mkdirSync(bin);
  const claude = join(bin, 'claude');
  const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`, OPERATION_RUNS_DIR: join(home, 'runs') };
  const cli = resolve('scripts/operations/wip-agents-cli.mjs');
  writeFileSync(claude, '#!/bin/sh\nprintf \'[{"kind":"odd","sessionId":"odd"}]\'\n'); chmodSync(claude, 0o755);
  let result = spawnSync(process.execPath, [cli, '--json'], { env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout).rows).toHaveLength(1);
  // Registration must work with the real synchronous operation engine too.
  result = spawnSync(process.execPath, [resolve('scripts/operations/run.mjs'), 'wip-agents', '--json'], { env, encoding: 'utf8' });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).verdict.rows).toHaveLength(1);
  writeFileSync(claude, '#!/bin/sh\nexit 7\n');
  result = spawnSync(process.execPath, [cli], { env, encoding: 'utf8' });
  expect(result.status).toBe(1); expect(result.stderr).toContain('claude agents --json failed'); expect(result.stdout).toBe('');
});

it('reads a transcript from the actual checkout cwd slug with the real-repo harness', async () => {
  await withRealRepo(({ root, tmp }) => {
    const cwd = join(root, '.operations', 'jobs');
    mkdirSync(cwd, { recursive: true });
    const project = join(tmp, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, 'fixture-session.jsonl'), JSON.stringify({ type: 'assistant', message: { model: 'claude-fixture', content: [] } }) + '\n');
    const readAgents = createWipAgentsReader({ homeDir: tmp,
      listAgents: () => [{ id: 'fixture', sessionId: 'fixture-session', cwd, kind: 'interactive', status: 'idle' }],
      readDispatchRecords: () => new Map(), cliVersion: () => null });
    expect(classifyAgents(readAgents())[0]).toMatchObject({ supervisor: { model: 'claude-fixture' }, executor: { source: 'transcript', providers: [] } });
  });
});

it('isolates process, transcript and mtime failures, including done sessions and missing files', () => {
  const { home, agents } = setup();
  agents.push({ sessionId: 'done-live', state: 'done', pid: 99 });
  delete agents[5].pid;
  const data = createWipAgentsReader({ homeDir: home, listAgents: () => agents, readDispatchRecords: () => new Map(), cliVersion: () => null,
    pidAlive: (pid) => { if (pid === 123) throw Error('probe failed'); return true; },
    statTranscript: (_file, a) => { if (a.id === '0') throw Error('stat failed'); return 100; },
    readTranscript: (_file, a) => { if (a.id === '1') throw Error('read failed'); return { transcriptModel: 'claude-ok', transcriptScan: { status: 'none' } }; },
    readDrainHistory: () => { throw Error('denied'); }, readDrainAlerts: () => [], now: () => 99 })();
  const rows = classifyAgents(data);
  expect(rows.find((r) => r.id === '0')).toMatchObject({ pidAlive: false, transcriptAgeMs: null });
  expect(rows.find((r) => r.id === '1')).toMatchObject({ transcriptAgeMs: 0, executor: { source: 'unknown' }, supervisor: { model: 'unknown' } });
  expect(rows.find((r) => r.id === 'missing')).toMatchObject({ liveness: 'dead-record', pid: null, pidAlive: null, transcriptAgeMs: null, executor: { source: 'unknown' }, supervisor: { model: 'unknown' } });
  expect(renderTable(rows)).not.toContain('done (process still alive)');
  expect(renderTable(rows)).toContain('Finished, not yet reaped: 1 (`unknown`)');
  expect(data.drain).toEqual({ passes: null, alerts: [] });
});
it('default process probe accepts EPERM and rejects dead or invalid pids', () => {
  const { home } = setup();
  const kill = vi.spyOn(process, 'kill').mockImplementation((pid) => { if (pid === 2) throw Object.assign(Error(), { code: 'EPERM' }); if (pid === 3) throw Object.assign(Error(), { code: 'ESRCH' }); return true; });
  const agents = [1, 2, 3, 0, -1, 1.2, '1', null].map((pid, i) => ({ sessionId: `s${i}`, pid }));
  agents.push({ sessionId: 'absent' });
  const { facts } = createWipAgentsReader({ homeDir: home, listAgents: () => agents, readDispatchRecords: () => new Map() })();
  expect(Object.values(facts).map((f) => f.pidAlive)).toEqual([true, true, false, false, false, false, false, false, null]);
  expect(kill).toHaveBeenCalledTimes(3);
});
it('reads bounded drain tails, skips partial and malformed lines, supports the directory override', () => {
  const { home } = setup(), dir = join(home, 'workspace/plateau-app/.drain-daemon'); mkdirSync(dir, { recursive: true });
  const pass = { at: '2026-09-19T10:54:00Z', deferredDetail: [{ num: 2072, item: 3140, waitOn: ['couple-carrier:unknown'] }] };
  writeFileSync(join(dir, 'history.jsonl'), JSON.stringify({ old: true }) + '\n' + 'x'.repeat(512 * 1024) + '\nbroken\n' + JSON.stringify(pass) + '\n');
  writeFileSync(join(dir, 'alerts.jsonl'), 'invalid\n' + JSON.stringify({ at: pass.at, health: 'stuck', signature: 'stuck' }));
  const read = createWipAgentsReader({ homeDir: home, listAgents: () => [], readDispatchRecords: () => new Map() });
  expect(read().drain).toEqual({ passes: [pass], alerts: [{ at: pass.at, health: 'stuck', signature: 'stuck' }] });
  vi.stubEnv('WIP_DRAIN_DIR', join(home, 'override')); mkdirSync(join(home, 'override'));
  writeFileSync(join(home, 'override/history.jsonl'), JSON.stringify(pass));
  expect(read().drain).toEqual({ passes: [pass], alerts: null });
});
it('CLI JSON retains all dead records while stdout groups them and appends drain health', async () => {
  const agents = Array.from({ length: 30 }, (_, i) => ({ name: `dead-${i}`, sessionId: `s${i}`, state: 'working' }));
  const readAgents = () => ({ agents, facts: {}, now: 0, drain: { passes: null, alerts: null } });
  let output = '';
  expect(await main({ argv: ['--json'], readAgents, stdout: (s) => { output = s; } })).toBe(0);
  expect(JSON.parse(output).rows.map((r) => r.name)).toEqual(agents.map((a) => a.name));
  expect(JSON.parse(output).drain.readable).toBe(false);
  expect(await main({ argv: [], readAgents, stdout: (s) => { output = s; } })).toBe(0);
  expect(output).toContain('dead-record (was working) ×30');
  expect(output).toContain('+24 more (see --json)');
  expect(output).toContain('\n\nWork in flight (not agents):\ndrain: unknown (history.jsonl unreadable)');
});

it('CLI table prints two rows and one finished line for the not-reaped fixture, while --json keeps all five sessions', async () => {
  const data = JSON.parse(readFileSync(resolve('scripts/operations/__fixtures__/wip-agents/finished-not-reaped.json'), 'utf8'));
  const readAgents = async () => ({ ...data, drain: { passes: [], alerts: [] } });
  let output = '';
  expect(await main({ argv: [], readAgents, stdout: (s) => { output = s; } })).toBe(0);
  expect(output.split('\n').filter((l) => l.startsWith('| `'))).toHaveLength(2);
  expect(output.match(/^Finished, not yet reaped: .*$/gm)).toEqual(['Finished, not yet reaped: 3 (`conveyor-11`, `conveyor-12`, `review-13`)']);
  expect(output).not.toContain('process still alive');
  expect(await main({ argv: ['--json'], readAgents, stdout: (s) => { output = s; } })).toBe(0);
  const json = JSON.parse(output);
  expect(json.rows).toHaveLength(5);
  expect(json.rows.filter((r) => r.liveness === 'done')).toHaveLength(3);
});
