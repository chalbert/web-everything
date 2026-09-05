#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description The RUNNER-TARGETED sibling of {@link ./queue.mjs} (WE #3478). `queue.mjs` writes into
 *   whatever checkout its own script file happens to live in, with no check that the LIVE conveyor runner is
 *   actually rooted there — a caller running it from the wrong checkout gets a clean `✓ cleared` against a
 *   sidecar the runner never reads (the exact incident this item documents). This CLI instead:
 *
 *   1. Resolves the live runner's checkout via {@link ./runner-target.mjs} (the runner-singleton lock's
 *      `pid` → its process's actual `cwd`, never the caller's own cwd or script location).
 *   2. REFUSES — a non-zero exit, no sidecar write at all — when no live runner lock is found, or when more
 *      than one live lock is found and which one is real is ambiguous.
 *   3. Writes into (or lists/removes from) *that* resolved checkout's `.conveyor/queue.json`, via the SAME
 *      `queue-store.mjs` add/remove/read/write core `queue.mjs` uses — never a reimplementation.
 *   4. Reports back which checkout it actually queued into, so a caller can never again walk away believing a
 *      `queue add` succeeded against a queue nobody is reading.
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs list [--json]
 *
 * `CONVEYOR_RUNNER_LOCK_ROOT` overrides the runner-lock root (mirrors `queue.mjs`'s `CONVEYOR_QUEUE_FILE` —
 * used by tests / an out-of-tree lock root, never needed in normal use).
 */

import { join } from 'node:path';
import { resolveLiveRunnerCheckout } from './runner-target.mjs';
import { readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas } from './queue-store.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

// One human-readable line per refusal reason `resolveLiveRunnerCheckout` can return — never a bare code.
const REASON_MESSAGES = {
  'no-live-runner': 'no LIVE conveyor runner lock was found under the runner-singleton lock root — start the runner first, or run queue.mjs directly from the checkout you know it is rooted in',
  'ambiguous': 'more than one LIVE conveyor runner lock was found — refusing rather than guessing which one is the real runner',
  'pid-unknown': "the live runner's lock entry has no recorded pid — cannot resolve its checkout",
  'cwd-unresolvable': "found the live runner's pid but could not resolve its working directory (is `lsof` installed and runnable?)",
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
  // A failure (JSON or plain) always goes to STDERR — deliberately, unlike `queue.mjs`'s `fail`, which puts a
  // `--json` failure on stdout. `queue-work.mjs`'s failures are refusals to touch anything at all (no sidecar
  // resolved), so keeping them off stdout means a caller piping stdout expecting a queue/checkout payload never
  // mistakes a refusal for one; check the exit code / stderr, not stdout shape, to detect failure here.
  const fail = (msg, reason = null) => {
    if (json) writeAllSync(2, JSON.stringify({ ok: false, error: msg, reason }) + '\n');
    else writeAllSync(2, `${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  if (action !== 'add' && action !== 'remove' && action !== 'list') {
    fail('usage: queue-work.mjs {add|remove|list} <NNN> [--json]');
    return;
  }
  if (action !== 'list' && (num == null || !num)) {
    fail(`${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);
    return;
  }

  const lockRoot = process.env.CONVEYOR_RUNNER_LOCK_ROOT;
  const target = resolveLiveRunnerCheckout(lockRoot ? { lockRoot } : {});
  if (!target.ok) {
    fail(`refusing to touch any sidecar — ${REASON_MESSAGES[target.reason] || `could not resolve the live runner (${target.reason})`}`, target.reason);
    return;
  }

  // Residual TOCTOU: the runner could exit in the gap between the pid→cwd probe above and the sidecar write
  // below, landing a write against a checkout whose runner just died. Far narrower than the bug this item
  // fixes (a permanently-wrong target vs. a milliseconds-wide race) and left unmitigated as an accepted risk.
  const path = join(target.checkoutRoot, '.conveyor', 'queue.json');
  const where = `${DIM}— live runner's checkout: ${target.checkoutRoot} (pid ${target.pid})${RST}`;

  if (action === 'list') {
    const queue = readQueueFile(path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'list', checkoutRoot: target.checkoutRoot, pid: target.pid, queue },
      queue.length === 0
        ? `${DIM}conveyor queue is empty${RST} ${where}`
        : `conveyor queue (${queue.length}) ${where}\n${queue.map((e) => `  ${GRN}✓${RST} #${e.num}${e.addedAt ? ` ${DIM}(cleared ${e.addedAt})${RST}` : ''}`).join('\n')}`,
    );
  }

  const before = readQueueFile(path);
  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, checkoutRoot: target.checkoutRoot, pid: target.pid, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue)${RST} ${where}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue${RST} ${where}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, checkoutRoot: target.checkoutRoot, pid: target.pid, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue${RST} ${where}`
      : `${DIM}#${num} was not in the queue — no change${RST} ${where}`,
  );
}

main(process.argv.slice(2));
