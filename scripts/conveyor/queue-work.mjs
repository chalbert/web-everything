#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description The RUNNER-AWARE clear-for-build CLI (WE #3478). `queue.mjs add` resolves its sidecar purely
 *   from the CALLER's own cwd/script location and reports success unconditionally — so a caller sitting in a
 *   checkout the live runner is NOT reading from gets a clean `✓ cleared` into a queue nobody ever drains
 *   (caught live, by hand, in the incident this item documents). This CLI closes that gap: before writing
 *   anything, it resolves which checkout the live runner is ACTUALLY rooted in
 *   ({@link ./resolve-runner-checkout.mjs}), then writes into THAT checkout's `.conveyor/queue.json` via the
 *   existing add/remove core ({@link ./queue-store.mjs}) — never wherever the caller happens to be `cd`'d.
 *
 * Refuses (non-zero exit, no write) rather than warns when the runner can't be resolved — `no-live-lock`,
 * `ambiguous`, `no-pid`, `cwd-unresolved`, or `process-mismatch` (a resolved pid whose process no longer looks
 * like the runner — a reused pid) — because writing to a guessed checkout is exactly the silent failure this
 * item exists to close; `queue.mjs` remains the cwd-relative entry point for a caller who already knows it is
 * running the runner's own checkout (e.g. the runner's own process).
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]     # resolve the live runner + clear <NNN> there
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]  # resolve the live runner + un-clear <NNN> there
 */

import { addToQueue, removeFromQueue, queueHas, readQueueFile, writeQueueFile, queuePath } from './queue-store.mjs';
import { resolveRunnerCheckout } from './resolve-runner-checkout.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

const REFUSAL_REASON = {
  'no-live-lock': 'no live conveyor runner is running — nothing to queue into',
  ambiguous: 'more than one live runner lock was found — cannot tell which checkout is authoritative',
  'no-pid': 'the live runner lock has no pid recorded — cannot derive its checkout',
  'cwd-unresolved': 'could not resolve the live runner\'s working directory',
  'process-mismatch': 'the live runner\'s pid resolved to a process that no longer looks like the runner (a reused pid) — not trusted',
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

  if (action !== 'add' && action !== 'remove') {
    fail('usage: queue-work.mjs {add|remove} <NNN> [--json]');
  }
  if (num == null || !num) fail(`${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);

  // resolveRunnerCheckout itself reads CONVEYOR_RUNNER_LOCK_ROOT (parallels CONVEYOR_QUEUE_FILE) when no
  // lockRoot is passed — used by tests to point at a fixture root instead of the machine-global
  // `~/.claude/conveyor-runner-locks`.
  const resolved = resolveRunnerCheckout();
  if (resolved.status !== 'resolved') {
    fail(`refusing to queue — ${REFUSAL_REASON[resolved.status] || resolved.reason}`, { status: resolved.status });
    return;
  }

  const path = queuePath(resolved.cwd);
  const before = readQueueFile(path);

  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, checkout: resolved.cwd, queue: after },
      already
        ? `${DIM}#${num} was already cleared in the runner's checkout — no change (${DIM}${resolved.cwd}${RST})${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue, runner checkout ${resolved.cwd}${RST}`,
    );
  }

  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, checkout: resolved.cwd, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue, runner checkout ${resolved.cwd}${RST}`
      : `${DIM}#${num} was not in the runner's queue — no change${RST}`,
  );
}

main(process.argv.slice(2));
