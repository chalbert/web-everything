/**
 * @file scripts/operations/file-item-io.mjs
 * @description THE IO SHELL of the `file-item` declaration — reuses `we:scripts/operations/scaffold-io.mjs`'s
 *   reader and write sink verbatim, and adds the one new sink `file-item.mjs` declares: clearing the freshly
 *   scaffolded card for the conveyor via `we:scripts/conveyor/queue-store.mjs`'s pure core.
 *
 * THE QUEUE SINK REACHES `queue-store.mjs` DIRECTLY, never `queue.mjs` as a subprocess — same shape as every
 * other operation's io shell (`dispatch-lane-io.mjs` reaches the conveyor's own modules directly rather than
 * shelling a CLI). `queue-store.mjs`'s own header says its sidecar path resolves by SCRIPT LOCATION, never
 * cwd, specifically so "the writer and readers can never diverge" — importing it here inherits that property
 * for free; a subprocess shell-out would not.
 *
 * LIVE-RUNNER RESOLUTION (bug found live 2026-09-07, filed as this item's own card, `we:backlog/xtwondy-*`):
 *   a SCRIPT-LOCATION sidecar path is exactly right when the writer and every READER share one script
 *   location, which is `queue-store.mjs`'s own stated invariant for `we:scripts/conveyor/queue.mjs`'s
 *   CLI path — but the actual reader that matters is the LIVE conveyor runner, which may be rooted in a
 *   DIFFERENT checkout than whichever clone this operation happens to run from (a lane clone, a scratch
 *   dispatcher checkout, …). WE #3478 (resolved, PR #1950) already built the fix for `queue.mjs`'s own CLI
 *   path — `we:scripts/conveyor/resolve-runner-checkout.mjs#resolveRunnerCheckout` + the runner-aware
 *   `we:scripts/conveyor/queue-work.mjs` sibling of `queue.mjs` — but `file-item-io.mjs` called
 *   `queue-store.mjs`'s pure core directly and never adopted it, so a card filed from a non-runner checkout
 *   silently queued into THAT checkout's own throwaway sidecar, invisible to the runner, with no sweep-back.
 *   This sink now resolves the live runner FIRST (reusing `resolveRunnerCheckout`, not re-deriving pid→cwd
 *   resolution) and targets ITS `.conveyor/queue.json` — falling back to the old script-location default only
 *   when no live runner can be resolved at all, so a card filed with the conveyor not running still gets some
 *   sidecar entry rather than none (see `planQueueing`'s neighboring "one effect or zero, never refused"
 *   invariant in `we:scripts/operations/file-item.mjs` — this sink must never halt the run over an unresolved
 *   runner, only do its best to target the right sidecar).
 *
 * IMPURE by construction: `fs` (+ the `lsof`/`ps` shell-outs `resolveRunnerCheckout` makes on our behalf).
 */

import { createScaffoldReader, createScaffoldSinks, REPO_ROOT } from './scaffold-io.mjs';
import {
  readQueueFile, writeQueueFile, addToQueue, resolveQueuePath, queuePath as queueStorePath,
} from '../conveyor/queue-store.mjs';
import { resolveRunnerCheckout } from '../conveyor/resolve-runner-checkout.mjs';
import { FILE_ITEM_QUEUE_EFFECT } from './file-item.mjs';

export { REPO_ROOT };

/** The reader `file-item`'s `read` step is injected with. IDENTICAL to `scaffold`'s own — no new fact needed. */
export const createFileItemReader = createScaffoldReader;

/**
 * BUILD THE SINK MAP for `file-item`'s two effects: `scaffold`'s own write (reused verbatim from
 * `scaffold-io.mjs`) plus the new queue-clear.
 *
 * THE QUEUE-CLEAR IS IDEMPOTENT BY CONSTRUCTION: `addToQueue` no-ops on an id already present (first
 * `addedAt` wins), so a replayed effect after a crash between `pending` and `applied` writes the identical
 * sidecar it would have on the first attempt.
 *
 * @param {object} [opts]
 * @param {string} [opts.root] - the write sink's repo root (unchanged — `scaffold-io.mjs`'s own knob).
 * @param {Function} [opts.write] - the write sink's injected writer (unchanged — `scaffold-io.mjs`'s own knob).
 * @param {Function} [opts.queuePath] - EXPLICIT override, same contract as before: a zero-arg `() => path`
 *   that wins outright over live-runner resolution (tests use this to point at a fixture sidecar). Leave
 *   unset in production.
 * @param {Function} [opts.resolveRunner] - injectable for tests; defaults to the real
 *   `resolveRunnerCheckout` (real `lsof`/`ps` shell-outs). Only consulted when `queuePath` is not given.
 */
export function createFileItemSinks({
  root = REPO_ROOT, write, queuePath, resolveRunner = resolveRunnerCheckout,
} = {}) {
  // No explicit override → resolve the LIVE conveyor runner's checkout on every call and target ITS sidecar,
  // never this process's own script location. Falls back to the old script-location default only when no
  // runner can be resolved (no-live-lock / ambiguous / no-pid / cwd-unresolved / process-mismatch / any
  // future refusal reason) — the sink must still produce SOME entry, per the header above.
  const resolvePath = queuePath || (() => {
    const resolved = resolveRunner();
    return resolved.status === 'resolved' ? queueStorePath(resolved.cwd) : resolveQueuePath();
  });

  return {
    ...createScaffoldSinks({ root, write }),
    [FILE_ITEM_QUEUE_EFFECT]: async (payload) => {
      const path = resolvePath();
      const before = readQueueFile(path);
      const already = before.some((e) => String(e.num) === String(payload.num));
      const after = addToQueue(before, payload.num, new Date().toISOString());
      if (!already) writeQueueFile(after, path);
      return { num: payload.num, queued: true, alreadyQueued: already, path };
    },
  };
}
