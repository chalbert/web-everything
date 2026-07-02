/**
 * @file scripts/readiness/queued-state.mjs
 * @description Ready-to-merge (queued) state — the local, offline signal for #2138's deferred merge
 *   queue (Fork 4, ruled: option a). The primitive `claim`/`release`/closeout read to tell a *queued*
 *   item (a lane pushed + waiting to be drained) apart from an *abandoned* one.
 *
 * WHY (#2138 Fork 4): under deferred landing a lane's `active→resolved` flip rides the WE lane commit
 * and lands only when the drain merges it — so while an item sits **queued** it is still `status: active`
 * on `main`. A naive status read would treat that `active` as either re-claimable or, worse, abandoned:
 * the closeout reconcile (#2072) flips *unlanded active* items back to `open` via `backlog.mjs release`,
 * which would wrongly reopen a queued item and drop its ready-to-merge state. The fix is a durable local
 * marker the producing session writes at lane-push and the drain deletes at landing; `claim`/`release`/
 * closeout read it **offline** (Rule #105 — no network `ls-remote`, no working-tree read, no second
 * main-write) and treat a queued item as neither claimable nor abandoned.
 *
 * WHO WRITES IT: the producing session at lane-push (`backlog.mjs queue <NNN>`), the drain at landing
 * (`backlog.mjs unqueue <NNN>` after the couple's resolve is confirmed reachable — a single clear point).
 * The lane-push / drain call-sites are wired by the drain/monitor command (#2162, which owns the relocated
 * push+land flow); THIS item ships the primitive + the offline READ guards in `claim`/`release`.
 *
 * This module is PURE — no fs, no process, no `Date` reads. Callers inject the file text (and, for adds,
 * an ISO stamp), so the same logic runs against the live `queued.json` or an in-memory fixture in tests.
 * The CLI (`scripts/backlog.mjs` queue/unqueue + the `claim`/`release` guards) owns the fs at its
 * boundary. No TTL: unlike a soft reservation, a queued item is a durable ready-to-merge signal cleared
 * only by the drain at landing (or an explicit `unqueue` / a `--force` release) — a lease that silently
 * expired would reopen the very re-claim window this exists to close.
 */

/** A fresh, empty queued state (no file yet, or an unreadable one). */
export function emptyQueuedState() {
  return { queued: [] };
}

/**
 * Tolerant parse of `queued.json` text → normalized `{ queued: [{num, at, lane?, batchSlug?}] }`. NEVER
 * throws: bad JSON, missing fields, or junk rows degrade to an empty state rather than breaking the CLI
 * that reads it on the ownership hot path (a corrupt token must never wedge a claim/release).
 * @param {string} text
 */
export function parseQueued(text) {
  if (!text || !text.trim()) return emptyQueuedState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyQueuedState(); }
  const queued = Array.isArray(raw?.queued)
    ? raw.queued
        .filter((q) => q && q.num != null)
        .map((q) => ({
          num: String(q.num).padStart(3, '0'),
          at: q.at ? String(q.at) : null,
          ...(q.lane ? { lane: String(q.lane) } : {}),
          ...(q.batchSlug ? { batchSlug: String(q.batchSlug) } : {}),
        }))
    : [];
  return { queued };
}

/** Padded-tolerant membership test — is `num` marked ready-to-merge? Pure read (used offline on the
 *  claim/release/closeout ownership path). Accepts `num` padded or unpadded. */
export function isQueued(state, num) {
  const padded = String(num).padStart(3, '0');
  return (state?.queued ?? []).some((q) => q.num === padded);
}

/** The set of queued item numbers (padded). */
export function queuedNums(state) {
  return (state?.queued ?? []).map((q) => q.num);
}

/**
 * Mark `nums` queued (ready-to-merge), stamped `nowIso` with optional `{lane, batchSlug}` metadata.
 * Idempotent: re-queuing an already-queued num refreshes its stamp/metadata rather than duplicating it.
 * Returns new state. Pure.
 */
export function addQueued(state, nums, nowIso, meta = {}) {
  const want = nums.map((n) => String(n).padStart(3, '0'));
  const queued = state.queued.map((q) => ({ ...q }));
  for (const num of want) {
    const entry = {
      num,
      at: nowIso ?? null,
      ...(meta.lane ? { lane: String(meta.lane) } : {}),
      ...(meta.batchSlug ? { batchSlug: String(meta.batchSlug) } : {}),
    };
    const i = queued.findIndex((q) => q.num === num);
    if (i === -1) queued.push(entry);
    else queued[i] = entry; // refresh
  }
  return { ...state, queued: queued.sort((a, b) => a.num.localeCompare(b.num)) };
}

/** Clear the queued mark for specific `nums` (the drain's single clear point at landing). Idempotent. */
export function removeQueued(state, nums) {
  const set = new Set(nums.map((n) => String(n).padStart(3, '0')));
  return { ...state, queued: state.queued.filter((q) => !set.has(q.num)) };
}

/** Serialize state back to `queued.json` text (with the self-documenting `_doc` header). */
export function serializeQueued(state) {
  return JSON.stringify(
    {
      _doc:
        'Ready-to-merge (queued) items for the #2138 deferred merge queue (Fork 4). A lane-producing session marks an item here at lane-push (`backlog.mjs queue <NNN>`); the drain clears it at landing (`backlog.mjs unqueue <NNN>`, after the resolve is confirmed reachable on main — a single clear point). `claim` and `release` read this OFFLINE (Rule #105) and refuse a queued item: it is neither re-claimable nor abandoned, just waiting to be drained. No TTL — a durable signal, cleared explicitly by the drain (or `--force`). The lane-push/drain call-sites are wired by the drain command (#2162); this file + the claim/release guards are #2161.',
      queued: state.queued,
    },
    null,
    2,
  ) + '\n';
}
