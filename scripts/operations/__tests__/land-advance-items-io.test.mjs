import { it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { withBareOrigin, withNarrowClone } from './helpers/real-repo.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createItemReader, queueItemInto, TRACKER_REF, TRACKER_PATH } from '../land-advance-items-io.mjs';
import { readQueueFile, queuePath } from '../../conveyor/queue-store.mjs';
import { pauseStorePath } from '../../readiness/dispatch-pause.mjs';
// NOTE (#3865): the branch's full io test also covered `createLandAdvanceApplier` from `land-advance-io.mjs`
// (#3856's own module, not yet on main) — that case is deferred to #3856, which owns that file. Every case
// below exercises ONLY this item's own module, land-advance-items-io.mjs.
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
// THE REAL MECHANISM (#2949 fidelity): the tracker is read with a real `git show <ref>:<path>` in a real clone, and the
// in-flight read and the queue sink use a real sidecar file. Only the two node children are answered by the wrapper.
const realRun = (clone) => (program, args) => program === 'git' ? String(execFileSync('git', args, { cwd: clone, encoding: 'utf8', stdio: 'pipe' }))
  : args[0].endsWith('conveyor-state.mjs') ? '{"lanes":[],"prs":[]}' : JSON.stringify({ launch: [], held: [] });
it('real clone: reads the Priority order off the cached tracker ref, and a queued item reads as in flight', async () => {
  await withBareOrigin(async ({ clone, seedOriginBranch, git }) => {
    seedOriginBranch('lane/mechanical-dispatcher', { [TRACKER_PATH]: TRACKER });
    git(['fetch', '--quiet', 'origin']);
    queueItemInto(root, '3674', () => 0);
    const out = createItemReader({ run: realRun(clone), root })();
    expect(out.queue.map((q) => q.num)).toEqual(['3653', '3486']);
    expect(out.skipped).toEqual([{ num: '3674', rank: 2, reason: 'in-flight' }]);
  });
});
it('real narrow clone: the tracker ref is missing, so the read throws instead of planning an empty queue', async () => {
  await withNarrowClone(async ({ clone, seedOriginBranch, git }) => {
    seedOriginBranch('lane/mechanical-dispatcher', { [TRACKER_PATH]: TRACKER });
    git(['fetch', '--quiet', 'origin']);
    expect(() => createItemReader({ run: realRun(clone), root })()).toThrow(/invalid object name|does not exist|unknown revision|bad revision/i);
  });
});
