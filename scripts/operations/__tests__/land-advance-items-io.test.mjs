import { it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createItemReader, queueItemInto, TRACKER_REF, TRACKER_PATH } from '../land-advance-items-io.mjs';
import { createLandAdvanceApplier } from '../land-advance-io.mjs';
import { readQueueFile, queuePath } from '../../conveyor/queue-store.mjs';
import { pauseStorePath } from '../../readiness/dispatch-pause.mjs';
let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'la-items-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
const TRACKER = ['## Priority order', '', '1. #3653 · 3 · A · Clears: CI.', '2. #3674 · 3 · A · Clears: more CI.', '3. #3486 · 3 · A · Graduation slice.', ''].join('\n');
it('reads the Priority order at the tracker ref, drops in-flight items, and plans them through dispatch-plan against the canonical sidecars', () => {
  const calls = [];
  const run = (program, args, { env } = {}) => {
    calls.push({ program, args, env });
    if (args[0] === 'show') return TRACKER;
    if (args[0].endsWith('conveyor-state.mjs')) return JSON.stringify({ lanes: [{ lane: 4, num: 3674 }], prs: [{ num: null }, { num: '3486' }] });
    if (args[0].endsWith('dispatch-plan.mjs')) {
      const file = args.find((a) => a.startsWith('--queue-file=')).slice(13);
      return JSON.stringify({ launch: JSON.parse(readFileSync(file, 'utf8')).map((num, i) => ({ num, lane: 30 + i })), held: [] });
    }
    throw new Error(`unexpected ${program} ${args.join(' ')}`);
  };
  const out = createItemReader({ run, root })();
  expect(calls[0]).toMatchObject({ program: 'node', args: ['scripts/readiness/conveyor-state.mjs', '--json'] });
  expect(calls[1]).toMatchObject({ program: 'git', args: ['show', `${TRACKER_REF}:${TRACKER_PATH}`] });
  expect(out.inFlight.sort()).toEqual(['3486', '3674']);
  expect(out.queue).toEqual([{ num: '3653', rank: 1 }]);
  expect(out.itemPlan.launch).toEqual([{ num: '3653', lane: 30 }]);
  for (const c of [calls[0], calls[2]]) expect(c.env).toMatchObject({ WE_DISPATCH_PAUSE_FILE: pauseStorePath(root), CONVEYOR_QUEUE_FILE: queuePath(root) });
});
it('already-queued items in the canonical sidecar count as in flight', () => {
  queueItemInto(root, '3653', () => 0);
  const run = (program, args) => args[0] === 'show' ? TRACKER : args[0].endsWith('conveyor-state.mjs') ? '{}' : JSON.stringify({ launch: [], held: [] });
  expect(createItemReader({ run, root })().skipped).toEqual([{ num: '3653', rank: 1, reason: 'in-flight' }]);
});
// #3720: the run-record guard half of "two calls, one dispatch" — queueing is idempotent, so a second apply of the
// same plan adds nothing; and item queueing happens only when the item opt-in allows it.
it('applies items by queueing them into the canonical conveyor sidecar, idempotently, only when opted in', async () => {
  const plan = { errors: [], rows: [], proposed: [], escalations: [], capacity: { budget: 2 }, items: { proposed: [{ num: '3653', lane: 30 }] } };
  const apply = createLandAdvanceApplier({ canonicalRoot: root, now: () => Date.parse('2026-09-21T00:00:00Z') });
  expect((await apply(plan, { prs: true, items: false })).queued).toEqual([]);
  expect(readQueueFile(queuePath(root))).toEqual([]);
  expect((await apply(plan, { prs: false, items: true })).queued).toEqual(['3653']);
  await apply(plan, { prs: false, items: true });
  expect(readQueueFile(queuePath(root)).map((e) => e.num)).toEqual(['3653']);
});
