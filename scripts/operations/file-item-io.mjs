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
 * IMPURE by construction: `fs`.
 */

import { createScaffoldReader, createScaffoldSinks, REPO_ROOT } from './scaffold-io.mjs';
import { readQueueFile, writeQueueFile, addToQueue, resolveQueuePath } from '../conveyor/queue-store.mjs';
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
 */
export function createFileItemSinks({ root = REPO_ROOT, write, queuePath = resolveQueuePath } = {}) {
  return {
    ...createScaffoldSinks({ root, write }),
    [FILE_ITEM_QUEUE_EFFECT]: async (payload) => {
      const path = queuePath();
      const before = readQueueFile(path);
      const already = before.some((e) => String(e.num) === String(payload.num));
      const after = addToQueue(before, payload.num, new Date().toISOString());
      if (!already) writeQueueFile(after, path);
      return { num: payload.num, queued: true, alreadyQueued: already, path };
    },
  };
}
