import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../land-advance-cli.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { readGate, canonicalRoot, primaryCandidates, OPT_IN_FILE } from '../land-advance-gate.mjs';
import { decideMode } from '../land-advance.mjs';
import { setPause, writePauseState, pauseStorePath } from '../../readiness/dispatch-pause.mjs';
let tmp, lockRoot, store;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'la-cli-')); lockRoot = join(tmp, 'locks'); store = createMemoryRunStore(); });
afterEach(() => rmSync(tmp, { recursive: true, force: true }));
const optedIn = (optIn = { prs: true, items: true }) => () => ({ optIn, paused: false });
const base = (extra = {}) => ({ lockRoot, store, canonicalRoot: () => tmp, readGate: optedIn({}), ...extra });
it('defaults to zero-write, zero-dispatch JSON plan', async () => {
  const dispatch = vi.fn(), write = vi.fn(), apply = vi.fn(), stdout = vi.fn(), stderr = vi.fn();
  const code = await main({ argv: ['--json'], deps: base({ readInputs: () => ({ now: 0, freeLanes: 1, prs: [], errors: [] }), apply, dispatch, write, readGate: optedIn() }), stdout, stderr });
  expect(code).toBe(0); expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({ rows: [], proposed: [], capacity: { budget: 1 }, mode: { mode: 'plan' } });
  expect(apply).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(stderr).not.toHaveBeenCalled();
});
it('reports partial source failures and exits 1', async () => {
  const stdout = vi.fn(), stderr = vi.fn();
  expect(await main({ argv: ['--json'], deps: base({ readInputs: () => ({ now: 0, errors: [{ source: 'prs:frontierui', message: 'failed' }] }) }), stdout, stderr })).toBe(1);
  expect(JSON.parse(stdout.mock.calls[0][0]).errors).toHaveLength(1); expect(stderr).toHaveBeenCalledWith('prs:frontierui: failed\n');
});
it('passes explicit apply to its injected port, with the opted-in kinds, and propagates failure', async () => {
  const apply = vi.fn(() => ({ errors: [{ message: 'failed' }] }));
  expect(await main({ argv: ['--apply'], deps: base({ readInputs: () => ({ now: 0 }), apply, readGate: optedIn({ prs: true }) }), stdout: vi.fn(), stderr: vi.fn() })).toBe(1);
  expect(apply).toHaveBeenCalledOnce(); expect(apply.mock.calls[0][1]).toEqual({ prs: true, items: false });
});
// #3720 Done-when 1: `--mode=plan` (the default) dispatches nothing and records a run record.
it('--mode=plan dispatches nothing and records a run record', async () => {
  const apply = vi.fn();
  expect(await main({ argv: ['--mode=plan', '--json', '--caller=test'], deps: base({ readInputs: () => ({ now: 0, freeLanes: 2, prs: [], errors: [] }), apply, readGate: optedIn() }), stdout: vi.fn(), stderr: vi.fn() })).toBe(0);
  expect(apply).not.toHaveBeenCalled();
  const runs = store.list().map((id) => store.read(id));
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ op: 'land-advance', input: { mode: 'plan', caller: 'test' }, verdict: { mode: 'plan', dispatched: 0, queued: 0 } });
});
// #3720 Done-when 1: `--apply` alone is not an opt-in — without the operator's durable file it stays plan-only.
it('--apply without the durable operator opt-in stays plan-only', async () => {
  const apply = vi.fn(), stdout = vi.fn();
  expect(await main({ argv: ['--apply', '--json'], deps: base({ readInputs: () => ({ now: 0, freeLanes: 2, errors: [] }), apply, readGate: () => ({ optIn: {}, paused: false }) }), stdout, stderr: vi.fn() })).toBe(0);
  expect(apply).not.toHaveBeenCalled();
  expect(JSON.parse(stdout.mock.calls[0][0]).mode).toMatchObject({ mode: 'plan', why: expect.stringContaining('opt-in') });
});
// #3720 Done-when 1: two concurrent calls produce exactly one dispatch (the single-flight lease).
it('two concurrent calls produce exactly one dispatch; the other exits busy', async () => {
  const apply = vi.fn(async () => ({ dispatched: [{ target: 'we#1' }], errors: [] }));
  const slow = () => new Promise((r) => setTimeout(() => r({ now: 0, freeLanes: 2, prs: [], errors: [] }), 50));
  const outs = [vi.fn(), vi.fn()];
  const codes = await Promise.all(outs.map((stdout) => main({ argv: ['--mode=dispatch', '--json'], deps: base({ readInputs: slow, apply, readGate: optedIn() }), stdout, stderr: vi.fn() })));
  expect(codes).toEqual([0, 0]);
  expect(apply).toHaveBeenCalledOnce();
  const bodies = outs.map((o) => JSON.parse(o.mock.calls[0][0]));
  expect(bodies.filter((b) => b.busy)).toHaveLength(1);
  // The lease is released afterwards: a third call runs.
  expect(await main({ argv: ['--mode=dispatch', '--json'], deps: base({ readInputs: slow, apply, readGate: optedIn() }), stdout: vi.fn(), stderr: vi.fn() })).toBe(0);
  expect(apply).toHaveBeenCalledTimes(2);
});
// #3720 Done-when 1: a set pause marker, read from the CANONICAL checkout while the caller stands in an empty lane
// clone, forces plan-only. Real files, real `readGate`, real `canonicalRoot` (the runner lookup injected).
it('a pause marker in the canonical checkout forces plan-only even from an empty lane clone', async () => {
  const canonical = join(tmp, 'primary'), lane = join(tmp, 'lane-9');
  mkdirSync(join(canonical, '.conveyor'), { recursive: true }); mkdirSync(lane);
  writeFileSync(join(canonical, '.conveyor', OPT_IN_FILE), JSON.stringify({ prs: true, items: true }));
  writePauseState(setPause({ reason: 'operator hold', by: 'test' }), pauseStorePath(canonical));
  expect(readGate(lane)).toMatchObject({ paused: false, optIn: {} }); // the caller's own clone says "not paused"
  const root = canonicalRoot({ resolveRunner: () => ({ status: 'no-live-lock' }), primary: () => canonical });
  expect(root).toEqual({ root: canonical, source: 'primary' });
  expect(canonicalRoot({ resolveRunner: () => ({ status: 'resolved', cwd: lane }), primary: () => canonical }).source).toBe('runner');
  const apply = vi.fn(), stdout = vi.fn();
  expect(await main({ argv: ['--mode=dispatch', '--json'], deps: { lockRoot, store, canonicalRoot: () => root.root, readInputs: () => ({ now: 0, freeLanes: 2, errors: [] }), apply }, stdout, stderr: vi.fn() })).toBe(0);
  expect(apply).not.toHaveBeenCalled();
  expect(JSON.parse(stdout.mock.calls[0][0]).mode).toMatchObject({ mode: 'plan', why: expect.stringContaining('pause') });
  expect(readGate(canonical)).toMatchObject({ paused: true, optIn: { prs: true, items: true } });
});
it('an unreadable opt-in file is an error, never an opt-in', () => {
  mkdirSync(join(tmp, '.conveyor'), { recursive: true }); writeFileSync(join(tmp, '.conveyor', OPT_IN_FILE), '{nope');
  expect(readGate(tmp)).toMatchObject({ optIn: {}, error: expect.any(String) });
});
it('two existing primary checkouts and no runner: the canonical checkout is ambiguous, so dispatch is refused', () => {
  const a = join(tmp, 'web-everything'), b = join(tmp, 'webeverything');
  mkdirSync(join(a, '.git'), { recursive: true }); mkdirSync(join(b, '.git'), { recursive: true });
  const r = canonicalRoot({ resolveRunner: () => ({ status: 'no-live-lock' }), candidates: () => primaryCandidates({ root: a, primary: () => a }) });
  expect(r).toEqual({ root: a, source: 'primary', ambiguous: [a, b] });
  expect(decideMode({ requested: 'dispatch', gate: { optIn: { prs: true }, ambiguous: r.ambiguous } })).toMatchObject({ mode: 'plan', why: expect.stringContaining('ambiguous') });
  rmSync(b, { recursive: true });
  expect(canonicalRoot({ resolveRunner: () => ({ status: 'no-live-lock' }), candidates: () => primaryCandidates({ root: a, primary: () => a }) })).toEqual({ root: a, source: 'primary' });
});
