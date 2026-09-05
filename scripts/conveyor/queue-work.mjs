#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description The queue-target-SAFE clear-for-build CLI (WE #3478). `queue.mjs` resolves its sidecar
 *   purely from ITS OWN script location — correct only when the caller happens to be invoking it from the
 *   same checkout the live conveyor runner is rooted in. This command resolves the runner's ACTUAL checkout
 *   first ({@link ./runner-checkout.mjs}, reading the runner-singleton lease's pid and deriving its cwd) and
 *   REFUSES rather than silently writing into a sidecar nobody is reading — the exact failure #3478
 *   documents — see that item for the incident this fixes.
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]     # clear an item in the LIVE runner's sidecar
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]  # un-clear it there
 *   node scripts/conveyor/queue-work.mjs list [--json]          # show what's cleared in the LIVE runner's sidecar
 *
 * Every action REFUSES (exit 1, nothing written) when the live runner's checkout can't be resolved:
 *   • no-live-runner   — no live runner lease found; nothing is reading a sidecar right now
 *   • ambiguous        — more than one live runner lease found; the target checkout is not a single answer
 *   • cwd-unresolvable — the runner's pid was found but its working directory could not be read
 */

import { readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas, queuePath } from './queue-store.mjs';
import { resolveLiveRunnerCwd } from './runner-checkout.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

const REFUSAL_MESSAGE = {
  'no-live-runner': 'no live conveyor runner lease found — nothing is reading a sidecar right now; start the runner first',
  ambiguous: 'more than one live conveyor runner lease found — the target checkout is ambiguous',
  'cwd-unresolvable': "found the live runner's pid but could not resolve its working directory",
};

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  const json = flags.has('json');
  const [action, rawNum] = args;
  const num = rawNum == null ? rawNum : String(rawNum).trim().replace(/^#+/, '').trim();

  const emit = (payload, human) => {
    writeAllSync(1, json ? JSON.stringify(payload) + '\n' : human + '\n');
    process.exit(0);
  };
  const fail = (msg, extra = {}) => {
    if (json) writeAllSync(1, JSON.stringify({ ok: false, error: msg, ...extra }) + '\n');
    else process.stderr.write(`${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  if (action !== 'add' && action !== 'remove' && action !== 'list') {
    fail('usage: queue-work.mjs {add|remove|list} <NNN> [--json]');
  }
  if ((action === 'add' || action === 'remove') && (num == null || !num)) {
    fail(`${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);
  }

  const resolved = resolveLiveRunnerCwd();
  if (!resolved.ok) {
    fail(REFUSAL_MESSAGE[resolved.reason] || `could not resolve the live runner's checkout (${resolved.reason})`, {
      reason: resolved.reason,
      ...(resolved.pids ? { pids: resolved.pids } : {}),
    });
    return;
  }

  const path = queuePath(resolved.checkout);

  if (action === 'list') {
    const queue = readQueueFile(path);
    if (json) return emit({ ok: true, verb: 'queue-work', action: 'list', checkout: resolved.checkout, queue });
    if (queue.length === 0) return emit({ ok: true }, `${DIM}conveyor queue is empty ${RST}${DIM}— runner checkout ${resolved.checkout}${RST}`);
    const lines = queue
      .map((e) => `  ${GRN}✓${RST} #${e.num}${e.addedAt ? ` ${DIM}(cleared ${e.addedAt})${RST}` : ''}`)
      .join('\n');
    return emit({ ok: true }, `conveyor queue (${queue.length}) ${DIM}— runner checkout ${resolved.checkout}${RST}\n${lines}`);
  }

  const before = readQueueFile(path);
  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, checkout: resolved.checkout, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue, runner checkout ${resolved.checkout})${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue (runner checkout ${resolved.checkout})${RST}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, checkout: resolved.checkout, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue (runner checkout ${resolved.checkout})${RST}`
      : `${DIM}#${num} was not in the queue — no change${RST}`,
  );
}

main(process.argv.slice(2));
