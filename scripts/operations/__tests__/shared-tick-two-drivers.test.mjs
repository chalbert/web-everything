/** #3383 — Run the actual shared tick shell with fake effects in two drivers, including real Node processes. */
import { it, expect } from 'vitest';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureDriver, queue } from '../__fixtures__/shared-tick-driver.mjs';
import { createTickCoordination, runTickOnce, writeDriverStatus } from '../../../skills-src/conveyor/runner.mjs';
const fixture = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__/shared-tick-driver.mjs');
const log = (root) => readFileSync(join(root, 'spawn.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const exactlyOnce = (root) => expect(log(root).map((r) => r.id).sort()).toEqual(queue.map((r) => r.id).sort());
it('two in-process drivers race over several rounds; only the winner emits and dispatches', async () => {
  const root = process.env.WE_COORDINATION_ROOT;
  let emitted = 0;
  const a = fixtureDriver(root, 'test:a:one', { onEmit: () => emitted++ });
  const b = fixtureDriver(root, 'test:b:two', { onEmit: () => emitted++ });
  for (let i = 0; i < 4; i++) {
    const results = await Promise.all([a(), b()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok).reason).toBe('busy');
  }
  expect(emitted).toBe(4);
  exactlyOnce(root);
});
it('two real Node processes share the mutex, action records and history', async () => {
  const root = process.env.WE_COORDINATION_ROOT;
  const children = ['host:child:a', 'host:child:b'].map((id) => fork(fixture, [id], { env: { ...process.env, WE_COORDINATION_ROOT: root }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }));
  try {
    await Promise.all(children.map((c) => once(c, 'message')));
    for (let round = 0; round < 20; round++) {
      const results = await Promise.all(children.map(async (c) => { const message = once(c, 'message'); c.send('tick'); return (await message)[0]; }));
      expect(results.some((r) => r.ok), JSON.stringify(results.map(({ ok, reason, error }) => ({ ok, reason, error })))).toBe(true);
      expect(results.every((r) => r.ok || r.reason === 'busy')).toBe(true);
    }
    // Give both drivers one uncontended tick so trace attribution is asserted for both identities.
    for (const c of children) { const message = once(c, 'message'); c.send('tick'); expect((await message)[0].ok).toBe(true); }
    exactlyOnce(root);
    const entries = readdirSync(join(root, 'trace')).flatMap((p) => readFileSync(join(root, 'trace', p), 'utf8').trim().split('\n').map(JSON.parse));
    expect(new Set(entries.map((e) => e.driverId)).size).toBe(2);
    expect(new Set(entries.map((e) => e.tickId)).size).toBe(entries.length);
  } finally {
    await Promise.all(children.map(async (c) => { const exited = once(c, 'exit'); c.send('stop'); await exited; }));
  }
});
it('a fresh driver reconstructs guards and attempts; status cannot regress on a backwards clock', async () => {
  const root = process.env.WE_COORDINATION_ROOT;
  await fixtureDriver(root, 'test:a:one', { now: () => 2_000 })();
  const persisted = JSON.parse(readFileSync(join(root, 'tick-bookkeeping.json'))).bookkeeping;
  let reconstructed;
  const out = await fixtureDriver(root, 'test:b:two', { now: () => 1_000, onRead: (b) => { reconstructed = b; } })();
  expect(out.ok).toBe(true);
  expect(reconstructed).toEqual(persisted);
  exactlyOnce(root);
  const status = JSON.parse(readFileSync(join(root, 'driver-status.json')));
  expect(status.at).toBe(new Date(2_000).toISOString());
  expect(status.driverId).toBe('test:a:one');
  expect(status.tickId).toMatch(/^test:a:one#/);
});
it('corrupt bookkeeping refuses the complete tick, including emit and both passes', async () => {
  const root = process.env.WE_COORDINATION_ROOT;
  writeFileSync(join(root, 'tick-bookkeeping.json'), '{');
  let calls = 0;
  const effect = () => { calls++; };
  const result = await runTickOnce({ coordination: createTickCoordination({ root }), effects: { tickOnce: effect, emit: effect, mechanicalPasses: effect, dispatchPass: effect } });
  expect(result).toMatchObject({ ok: false, reason: 'bookkeeping-unavailable' });
  expect(calls).toBe(0);
});
it('stops before dispatch and save if a mechanical pass loses the tick lease', async () => {
  let alive = true, dispatches = 0, saves = 0, released = 0;
  const result = await runTickOnce({
    coordination: { acquire: () => ({ ok: true, handle: { heartbeat: () => alive, release: () => released++ } }),
      loadBookkeeping: () => ({ ok: true, fresh: true }), saveBookkeeping: () => saves++ },
    effects: { tickOnce: () => ({ decisions: {}, nextState: {} }), mechanicalPasses: () => { alive = false; }, dispatchPass: () => dispatches++ },
  });
  expect(result.reason).toBe('lease-lost');
  expect([dispatches, saves, released]).toEqual([0, 0, 1]);
});
