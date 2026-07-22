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
 */

import { readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas, queuePath } from './queue-store.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  const json = flags.has('json');
  const [action, num] = args;

  const emit = (payload, human) => {
    process.stdout.write(json ? JSON.stringify(payload) + '\n' : human + '\n');
    process.exit(0);
  };
  const fail = (msg) => {
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write(`${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  const path = queuePath();

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
  if (num == null || !String(num).trim()) fail(`${action} needs an item id — e.g. queue.mjs ${action} 2613`);

  const before = readQueueFile(path);
  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue', action: 'add', num: String(num).trim(), already, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue)${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue (session-local, ${path})${RST}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue', action: 'remove', num: String(num).trim(), removed: had, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue${RST}`
      : `${DIM}#${num} was not in the queue — no change${RST}`,
  );
}

main(process.argv.slice(2));
