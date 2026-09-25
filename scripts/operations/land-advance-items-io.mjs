/**
 * @file land-advance-items-io.mjs
 * The item-pull reader and sink (#3720). READ: `conveyor-state` names what is in flight (a leased lane's item, an
 * open lane PR's item, plus the canonical conveyor queue); the Priority order is read at the cached tracker ref
 * (plan never fetches); the surviving lines go, in list order, to `dispatch-plan --queue-file`, which applies every
 * hold (blocked, epic, decision, no scope, overlap, free lanes, cap, pause). Both children read the canonical
 * checkout's pause marker and queue through their env overrides, never the caller's clone.
 * SINK: an item is QUEUED into the canonical conveyor sidecar (idempotent `addToQueue`); the runner's tick then
 * launches it through dispatch-lane with its in-flight guards, lane lease and claim. land-advance never spawns a build.
 */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readQueueFile, writeQueueFile, addToQueue, queuePath, normNum } from '../conveyor/queue-store.mjs';
import { pauseStorePath } from '../readiness/dispatch-pause.mjs';
import { parsePriorityRows } from '../lib/prototype-tracker-compact.mjs';
import { REFUSAL_KINDS } from '../conveyor/reconcile-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TRACKER_REF = 'origin/lane/mechanical-dispatcher';
export const TRACKER_PATH = 'backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md';
/**
 * The queue source: epic #3383's `## Priority order`, read with the gate's own row reader (`parsePriorityRows`, over
 * `parsePriorityOrder`), never a second parser. PURE. Operator rule 1 skips claimed, design-first (band B), operator
 * (band C, decision), needs-operator-fast-forward and in-flight lines; the rest keep list order.
 */
export function priorityQueue(trackerText, { inFlight = [] } = {}) {
  const { found, ordered, claimed } = parsePriorityRows(trackerText);
  if (!found) throw new Error('the tracker card has no "## Priority order" section');
  const busy = new Set(inFlight.map(String)), queue = [], skipped = claimed.map((c) => ({ num: c.id, rank: null, reason: 'claimed' }));
  for (const r of ordered) {
    const reason = r.size === 'decision' ? 'operator-decision' : /needs-operator-fast-forward/i.test(r.why) ? 'needs-operator-fast-forward'
      : r.band === 'C' ? 'needs-operator' : r.band !== 'A' ? 'design-first' : busy.has(r.id) ? 'in-flight' : null;
    if (reason) skipped.push({ num: r.id, rank: r.rank, reason }); else queue.push({ num: r.id, rank: r.rank });
  }
  return { queue, skipped };
}
/**
 * reconcile-pass refusals → the dispatch kinds each one holds (#3720: "a refusal is reported, never overridden").
 * PURE. `no-findings` holds only a fix: it is reconcile's reason a PR is owed a review rather than a fixer.
 */
export function reconcileHolds(refusals = []) {
  return Object.fromEntries(refusals.filter((r) => REFUSAL_KINDS.includes(r.kind))
    .map((r) => [`we#${r.prNumber}`, { kind: r.kind, why: r.why, holds: r.kind === 'no-findings' ? ['fix'] : ['review', 'fix'] }]));
}
const runDefault = (program, args, { env } = {}) => String(execFileSync(program, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
export function createItemReader({ run = runDefault, root, trackerRef = TRACKER_REF, io = fs } = {}) {
  if (!root) throw new TypeError('land-advance item reader needs the canonical checkout root');
  return function readItems() {
    const env = { ...process.env, WE_DISPATCH_PAUSE_FILE: pauseStorePath(root), CONVEYOR_QUEUE_FILE: queuePath(root) };
    const state = JSON.parse(run('node', ['scripts/readiness/conveyor-state.mjs', '--json'], { env }));
    const queued = readQueueFile(queuePath(root)).map((e) => normNum(e.num));
    const inFlight = [...new Set([...(state.lanes ?? []).map((l) => l.num), ...(state.prs ?? []).map((p) => p.num), ...queued]
      .filter((n) => n != null && n !== '').map(String))];
    const { queue, skipped } = priorityQueue(run('git', ['show', `${trackerRef}:${TRACKER_PATH}`]), { inFlight });
    const dir = io.mkdtempSync(join(tmpdir(), 'land-advance-queue-'));
    try {
      const file = join(dir, 'queue.json');
      io.writeFileSync(file, JSON.stringify(queue.map((q) => q.num)));
      const itemPlan = JSON.parse(run('node', ['scripts/readiness/dispatch-plan.mjs', '--json', `--queue-file=${file}`], { env }));
      return { queue, skipped, itemPlan, inFlight, trackerRef };
    } finally { io.rmSync(dir, { recursive: true, force: true }); }
  };
}
export function queueItemInto(root, num, now = Date.now) {
  const path = queuePath(root);
  writeQueueFile(addToQueue(readQueueFile(path), String(num), new Date(now()).toISOString()), path);
}
