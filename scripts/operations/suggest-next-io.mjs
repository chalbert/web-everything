/**
 * @file scripts/operations/suggest-next-io.mjs
 * @description THE IO SHELL of the `suggest-next` declaration (#3036, under epic #3029) — the two readers its
 *   `board` step is injected with.
 *
 * WHY IT IS A SEPARATE FILE. {@link ./suggest-next.mjs} is the DECLARATION: what the operation is. This is the
 * only place it touches the world — the same pure-core / io-shell split {@link ./review-pr.mjs} /
 * {@link ./review-pr-io.mjs} use, and what lets the declaration be unit-tested with a fixture array and no
 * loader, no leases and no `gh`.
 *
 * EVERY BINDING HERE CALLS AN EXISTING THING. Nothing in this file decides anything about priority:
 *   - the board is `we:src/_data/backlog.js`, the SINGLE loader (#248/#249) every other readiness surface
 *     reads — required through `createRequire` because it is CommonJS, exactly as `we:scripts/check-readiness.mjs`
 *     and `we:scripts/propose-readiness.mjs` require it;
 *   - the prepare-hold exclusion is `parseHolds` + `heldNums` (`we:scripts/readiness/prepare-hold-state.mjs`)
 *     over the same `prepare-hold.json` the CLI reads;
 *   - the open-PR exclusion is `openPrItemNums` (`we:scripts/lib/open-pr-items.mjs`), fail-soft by
 *     construction: no `gh`, no auth or offline returns `{ nums: [], unavailable: true }` and never throws.
 *
 * THE SHELL DOES NOT SILENTLY WEAKEN THE ANSWER. Each exclusion source reports whether it actually ran, and
 * the declaration carries that straight into the finding. An empty exclusion set because nothing was excluded
 * and an empty one because `gh` was missing are different answers and are reported as such.
 *
 * NO FETCH-FIRST GUARD, DELIBERATELY. `check-readiness.mjs` fetches and fast-forwards before ranking (#2204),
 * because a stale local `main` ranks against wrong item state. This shell does NOT: a read served on request
 * must not mutate the caller's checkout, and an HTTP GET that runs `git fetch` and autostash-fast-forwards a
 * working tree is a side effect hiding inside a safe method. The host is responsible for the freshness of the
 * checkout it serves from; {@link readBoard} reports the loader's item count so a caller can notice a board
 * that looks wrong.
 *
 * IMPURE by construction: `fs`, `require`, and (only when asked) `gh`.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { heldNums, parseHolds, emptyHoldState } from '../readiness/prepare-hold-state.mjs';
import { openPrItemNums } from '../lib/open-pr-items.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION and never by cwd — same reason `run-store.mjs` does it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** Where the prepare-hold token lives — the same path `we:scripts/check-readiness.mjs` reads. */
export const PREPARE_HOLD_PATH = join(REPO_ROOT, '.claude/skills/batch-backlog-items/prepare-hold.json');

/**
 * READ THE BOARD. Returns `{ items }` — the loader's array, untouched. Every derived field the ranking needs
 * (`tier` #249, `batchable`/`leverageScore` #254, `locus`, `epicState`, `preparedDate`) is the loader's; this
 * adds none and recomputes none.
 *
 * @param {string} [root]
 * @returns {{items: Array<object>, root: string, count: number}}
 */
export function readBoard(root = REPO_ROOT) {
  const require = createRequire(import.meta.url);
  const loadBacklog = require(join(root, 'src/_data/backlog.js'));
  const items = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
  if (!Array.isArray(items)) {
    throw new Error(`suggest-next: \`${join(root, 'src/_data/backlog.js')}\` did not produce an array of items`);
  }
  return { items, root, count: items.length };
}

/** The `loadBoard` binding the declaration takes. */
export function createBoardReader({ root = REPO_ROOT } = {}) {
  return () => readBoard(root);
}

/**
 * READ THE EXCLUSIONS the ranked view must be filtered by. Both are HARD excludes at `check-readiness.mjs`'s
 * CLI boundary and both are hard here, for the same reasons:
 *
 *   - `prepare-hold` — a session is preparing the item in a lane (#2219 (b) / #2264). Offering it invites two
 *     sessions into one card. Read offline from a local token, so it is always available.
 *   - `open-pr` — the item's lane already resolved it and is waiting on the drain to land. Re-offering it
 *     hands out work that is done. Needs `gh`; fail-soft and REPORTED when unavailable.
 *
 * @param {object} [o]
 * @param {boolean} [o.scanOpenPrs] - run the `gh` scan. `false` gives a fast, network-free read.
 * @param {number} [o.now] - injected clock, so a lease test is deterministic.
 * @returns {{nums: string[], sources: Array<{id: string, nums: string[], unavailable?: boolean, reason?: string}>}}
 */
export function readExclusions({ scanOpenPrs = true, now = Date.now(), holdPath = PREPARE_HOLD_PATH } = {}) {
  const sources = [];

  let holds;
  try { holds = parseHolds(readFileSync(holdPath, 'utf8')); } catch { holds = emptyHoldState(); }
  const held = heldNums(holds, now);
  sources.push({ id: 'prepare-hold', nums: held });

  if (scanOpenPrs) {
    const pr = openPrItemNums();
    sources.push(pr.unavailable
      ? { id: 'open-pr', nums: [], unavailable: true, reason: pr.reason }
      : { id: 'open-pr', nums: pr.nums });
  } else {
    sources.push({
      id: 'open-pr',
      nums: [],
      unavailable: true,
      reason: 'not scanned — the caller passed `scanOpenPrs=false`, so items already sitting in an open PR are NOT excluded',
    });
  }

  return { nums: [...new Set(sources.flatMap((s) => s.nums))].sort(), sources };
}

/** The `loadExclusions` binding the declaration takes. */
export function createExclusionReader({ holdPath = PREPARE_HOLD_PATH } = {}) {
  return ({ scanOpenPrs = true } = {}) => readExclusions({ scanOpenPrs, holdPath });
}
