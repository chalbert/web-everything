#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description WE #3478 — the RUNNER-AWARE sibling of `queue.mjs`. Before clearing/un-clearing an item,
 *   resolves which checkout's `.conveyor/queue.json` the LIVE conveyor runner is actually rooted in (via its
 *   runner-singleton lock, {@link ./queue-target.mjs}) and writes there — never wherever the caller happens to
 *   be `cd`'d. `queue.mjs`'s own `resolveQueuePath` ties the sidecar to the SCRIPT's own checkout, which is
 *   silently wrong the moment the live runner is rooted in a DIFFERENT checkout (the incident this item
 *   documents). Reuses `queue-store.mjs`'s pure add/remove/serialize core unchanged (#2613) — only the target
 *   PATH differs from `queue.mjs`.
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]     # clear an item in the LIVE runner's checkout
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]  # un-clear it there
 *
 * REFUSES (never guesses, never silently writes to the caller's own cwd) when:
 *   - no live conveyor runner lock is found                        → `no-live-runner`
 *   - more than one live runner lock is found                      → `ambiguous-runner-lock`
 *   - the live lock has no recorded pid                             → `no-pid-recorded`
 *   - the live runner's pid can't be resolved to a working directory → `runner-cwd-unresolvable`
 * On success it reports back the checkout it actually queued into, so a caller can never again walk away
 * believing a clear succeeded against a sidecar nobody is reading.
 */

import { join } from 'node:path';
import {
  readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas,
} from './queue-store.mjs';
import { resolveLiveRunnerCwd } from './queue-target.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

const REFUSAL_MESSAGE = {
  'no-live-runner': 'no live conveyor runner found (no live runner-singleton lock) — refusing to guess ' +
    'which checkout to queue into; start the runner, or use queue.mjs directly if your cwd IS the runner\'s checkout',
  'ambiguous-runner-lock': 'more than one live runner-singleton lock was found — refusing to guess which one is the real runner',
  'no-pid-recorded': 'the live runner lock has no recorded pid — cannot resolve its checkout',
  'runner-cwd-unresolvable': 'found the live runner\'s pid but could not resolve its working directory (is `lsof` available?)',
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
  const fail = (payload, msg) => {
    if (json) writeAllSync(1, JSON.stringify(payload) + '\n');
    else writeAllSync(2, `${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  if (action !== 'add' && action !== 'remove') {
    fail({ ok: false, error: 'usage' }, 'usage: queue-work.mjs {add|remove} <NNN> [--json]');
  }
  if (num == null || !num) {
    fail({ ok: false, error: 'missing-num' }, `${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);
  }

  const verdict = resolveLiveRunnerCwd();
  if (!verdict.ok) {
    // Spread the full verdict (not just `reason`) — `candidates`/`candidate`/`pid` are exactly the diagnostic
    // detail a caller debugging a refusal needs (which lock owners made it ambiguous, which pid had no cwd).
    fail({ ...verdict }, REFUSAL_MESSAGE[verdict.reason] || verdict.reason);
  }

  const path = join(verdict.cwd, '.conveyor', 'queue.json');
  const before = readQueueFile(path);

  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, runnerCwd: verdict.cwd, path, queue: after },
      already
        ? `${DIM}#${num} was already cleared in the LIVE runner's checkout — no change (${after.length} in queue, ${path})${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue — the LIVE runner's checkout (${path})${RST}`,
    );
  }

  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, runnerCwd: verdict.cwd, path, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue (${path})${RST}`
      : `${DIM}#${num} was not in the queue — no change (${path})${RST}`,
  );
}

main(process.argv.slice(2));
