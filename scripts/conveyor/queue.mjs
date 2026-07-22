#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue.mjs
 * @description The operator's CLEAR-FOR-BUILD CLI for the conveyor (WE #2613, epic #2612). Adds / removes /
 *   lists item ids in the SESSION-LOCAL conveyor queue sidecar (`.conveyor/queue.json`, gitignored). This is
 *   the command the /conveyor skill tells the operator to run from the MAIN session to clear (or un-clear)
 *   work for the conveyor to pull.
 *
 *   It is NOT a card mutation — it never touches backlog frontmatter and never calls `writeBacklogMd`, so it
 *   is NOT policed by the no-override lane guard (backlog.mjs, #2302/#104/#2219/#2339) and runs fine from the
 *   primary/main checkout. That is the entire point: clearing work is session-local operator intent, so it
 *   goes through a sidecar the guard does not police, never through `build-queue add` (which the guard blocks
 *   from primary). See {@link ./queue-store.mjs} for the store + the pure core.
 *
 * USAGE:
 *   node scripts/conveyor/queue.mjs add <NNN> [--json]     # clear an item for the conveyor to pull (idempotent)
 *   node scripts/conveyor/queue.mjs remove <NNN> [--json]  # un-clear it (no-op if it was not cleared)
 *   node scripts/conveyor/queue.mjs list [--json]          # print the current session queue
 *
 * The id may be typed with or without a leading `#` (`add 2613` ≡ `add '#2613'`). Clear the id the tooling
 * CURRENTLY shows: a sidecar entry can go stale across JIT-numbering — an item cleared as a `xHASH` won't match
 * once it lands as `#NNN` (and vice-versa) — so if a cleared id stops matching, `remove` it and re-`add` the
 * current id. (#2613 review, finding 3 — JIT-hash ↔ landed-number drift.)
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas, resolveQueuePath, normNum,
} from './queue-store.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const YEL = '\x1b[33m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKLOG_CLI = join(HERE, '..', 'backlog.mjs');

/**
 * Is `num` CURRENTLY a ready build-queue row? Best-effort — shells `backlog.mjs build-queue --json` (the same
 * ready set the dispatcher pulls from). Returns `{ checked, ready }`: `checked:false` when the lookup could not
 * run (never blocks the add). Skipped entirely when `CONVEYOR_NO_READY_CHECK` is set (tests / offline use).
 */
function readinessOf(num) {
  if (process.env.CONVEYOR_NO_READY_CHECK) return { checked: false, ready: false };
  try {
    const out = execFileSync('node', [BACKLOG_CLI, 'build-queue', '--json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
    });
    const q = JSON.parse(out);
    const rows = Array.isArray(q?.queue) ? q.queue : [];
    const key = normNum(num);
    return { checked: true, ready: rows.some((r) => normNum(r?.num) === key) };
  } catch {
    return { checked: false, ready: false };
  }
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  const json = flags.has('json');
  const [action, rawNum] = args;
  // Strip a leading `#` sigil (UI/`list` render ids as `#NNN`) so `add '#2613'` stores `2613` and matches the
  // build-queue row — defense-in-depth with normNum, which also tolerates a stored `#` on the membership side.
  const num = rawNum == null ? rawNum : String(rawNum).trim().replace(/^#+/, '').trim();

  const emit = (payload, human) => {
    process.stdout.write(json ? JSON.stringify(payload) + '\n' : human + '\n');
    process.exit(0);
  };
  const fail = (msg) => {
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write(`${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  const path = resolveQueuePath();

  if (action === 'list') {
    const queue = readQueueFile(path);
    if (json) return emit({ ok: true, verb: 'queue', action: 'list', queue });
    if (queue.length === 0) return emit({ ok: true }, `${DIM}conveyor queue is empty${RST}`);
    const lines = queue
      .map((e) => `  ${GRN}✓${RST} #${e.num}${e.addedAt ? ` ${DIM}(cleared ${e.addedAt})${RST}` : ''}`)
      .join('\n');
    return emit({ ok: true }, `conveyor queue (${queue.length}) ${DIM}— session-local, ${path}${RST}\n${lines}`);
  }

  if (action !== 'add' && action !== 'remove') {
    fail('usage: queue.mjs {add|remove|list} <NNN> [--json]');
  }
  if (num == null || !num) fail(`${action} needs an item id — e.g. queue.mjs ${action} 2613`);

  const before = readQueueFile(path);
  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    // Feedback so a clear never silently vanishes (#2613 review, required 2a): a cleared id that is NOT a ready
    // build-queue row (blocked / resolved / typo / unknown) is STILL added — a temporarily-blocked item should
    // auto-arm when its blocker lands — but we WARN rather than lie with a bare "✓ cleared".
    const { checked, ready } = readinessOf(num);
    const notReady = checked && !ready;
    const warn = notReady
      ? ` — but #${num} is not currently ready (blocked / resolved / unknown); it will dispatch once it becomes ready, or \`remove\` it`
      : '';
    return emit(
      { ok: true, verb: 'queue', action: 'add', num, already, ready: checked ? ready : null, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue)${RST}${notReady ? `\n${YEL}⚠${RST}${warn}` : ''}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue (session-local, ${path})${RST}${notReady ? `\n${YEL}⚠${RST}${warn}` : ''}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue', action: 'remove', num, removed: had, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue${RST}`
      : `${DIM}#${num} was not in the queue — no change${RST}`,
  );
}

main(process.argv.slice(2));
