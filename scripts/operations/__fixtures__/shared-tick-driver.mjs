/** #3383 — Local two-process fixture. Every effect is fake; the only side effect is a temp spawn log. */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTickCoordination, runTickOnce, writeDriverStatus, appendDecisionTrace } from '../../../skills-src/conveyor/runner.mjs';
import { createActionStore } from '../action-store.mjs';
import { actionResource } from '../action-record.mjs';
import { guardedDispatch } from '../action-dispatch.mjs';
export const queue = [
  { id: 'xone', type: 'item', kind: 'build' }, { id: 'xtwo', type: 'item', kind: 'prepare' },
  { id: '101', type: 'pr', kind: 'fix' }, { id: '102', type: 'pr', kind: 'review' },
];
export function fixtureDriver(root, driverId, { now = Date.now, onRead = () => {}, onEmit = () => {} } = {}) {
  const actions = createActionStore({ root, now });
  const coordination = createTickCoordination({ root, now, actions, postconditionHolds: () => false });
  const effects = {
    tickOnce: ({ bookkeeping = {} }) => {
      onRead(bookkeeping);
      const tick = (bookkeeping.tick ?? 0) + 1;
      return { decisions: { decisionTrace: [{ reason: 'fixture' }] }, nextState: { ...bookkeeping, tick,
        buildGuards: bookkeeping.buildGuards ?? [{ num: 'xone', lane: 1, spawnedTick: tick }],
        prepareGuards: bookkeeping.prepareGuards ?? [{ num: 'xtwo', lane: 2, spawnedTick: tick }],
        fixGuards: bookkeeping.fixGuards ?? [{ num: 'xthree', lane: 3, spawnedTick: tick }],
        ciHealGuards: [], fixAttempts: { xthree: 1 }, ciHealAttempts: {}, watched: ['101'], launchedNums: ['xone', 'xtwo'], heldStall: {} } };
    },
    emit: (surface, ctx) => {
      onEmit(ctx);
      writeDriverStatus(join(root, 'driver-status.json'), ctx, surface);
      appendDecisionTrace(join(root, 'trace'), ctx, surface.decisionTrace);
    },
    mechanicalPasses: ({ heartbeat }) => heartbeat(),
    dispatchPass: async ({ out }) => {
      for (const item of queue) await guardedDispatch({ resource: actionResource('we', item), kind: item.kind, owner: driverId, actions, now,
        effect: () => { appendFileSync(join(root, 'spawn.jsonl'), JSON.stringify(item) + '\n'); return `agent-${item.id}`; } });
      return { nextState: out.nextState };
    },
  };
  return () => runTickOnce({ effects, coordination, driverId, now });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tick = fixtureDriver(process.env.WE_COORDINATION_ROOT, process.argv[2]);
  process.on('message', async (message) => {
    if (message === 'stop') { process.disconnect(); return; }
    try { process.send(await tick()); } catch (e) { process.send({ error: e.message }); }
  });
  process.send({ ready: true });
}
