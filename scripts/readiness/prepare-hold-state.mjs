/**
 * @file scripts/readiness/prepare-hold-state.mjs
 * @description Prepare-hold state — the local, offline, HARD-excluding hold that guarantees the
 *   prepare-window concurrency the #2138-Fork-4 queued token guarantees for landing (build arm of the
 *   ratified #2219 rider, item #2264). While a session prepares a decision fork (research + author its
 *   options in a lane), the item is `status: open` on `main` — so a naive selection would re-offer it and
 *   a concurrent `claim` could steal it mid-prep. This token closes that window HARD: `--select` skips a
 *   held item and `claim` refuses it (a hard lock, unlike the soft `reserve` deprioritize).
 *
 * WHY a token, not the `reserve` soft-hold: `reserve` (#083) only DEPRIORITIZES (TTL 120 min) — a second
 * session can still claim a reserved item. A prepare in a lane can outlast 120 min and must not be
 * stealable, so the guarantee is re-homed into this strengthened token that HARD-excludes (the #2219 (b)
 * flow). It carries a LEASE (`leaseUntil`) longer than a real prepare — refreshed by re-holding across the
 * session — so a crashed holder cannot block the item forever (an expired hold is ignored, like a crashed
 * reservation), while a live prepare is protected for its whole duration.
 *
 * WHO WRITES IT: the preparing session at prepare-start (`backlog.mjs prepare-hold <NNN>`), refreshes it by
 * re-holding, and clears it at prepare-end (`backlog.mjs prepare-release <NNN>`) once its one lane→PR is
 * landed. `--select` (selection) and `claim` READ it OFFLINE (Rule #105 — no network, no tree read).
 *
 * This module is PURE — no fs, no process, no `Date` reads. Callers inject the file text, the holder, and
 * `nowMs`/`leaseUntil` stamps, so the same logic runs against the live `prepare-hold.json` or an in-memory
 * fixture in tests. The CLI (`scripts/backlog.mjs` prepare-hold/stamp/release + the `claim` guard;
 * `scripts/check-readiness.mjs --select`) owns the fs + clock at its boundary.
 */

/** Default lease: longer than a real prepare (the #083 reserve TTL is 120 min — this must outlast it), and
 *  refreshed on each re-hold across the session. A crashed holder's stale hold expires after this. */
export const DEFAULT_LEASE_MINUTES = 480; // 8h — outlasts a real prepare; re-hold to extend.

/** A fresh, empty hold state (no file yet, or an unreadable one). */
export function emptyHoldState() {
  return { holds: [] };
}

/**
 * Tolerant parse of `prepare-hold.json` text → normalized `{ holds: [{num, holder, leaseUntil}] }`. NEVER
 * throws: bad JSON, missing fields, or junk rows degrade to an empty state rather than breaking the CLI
 * that reads it on the selection / claim hot path (a corrupt token must never wedge a claim/select).
 * @param {string} text
 */
export function parseHolds(text) {
  if (!text || !text.trim()) return emptyHoldState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyHoldState(); }
  const holds = Array.isArray(raw?.holds)
    ? raw.holds
        .filter((h) => h && h.num != null)
        .map((h) => ({
          num: String(h.num).padStart(3, '0'),
          holder: h.holder != null ? String(h.holder) : null,
          leaseUntil: h.leaseUntil ? String(h.leaseUntil) : null,
        }))
    : [];
  return { holds };
}

/** Is `hold` still live at `nowMs`? A missing/invalid `leaseUntil` is treated as EXPIRED (a hold with no
 *  parseable lease can't be trusted to block work) so a corrupt row never wedges selection forever. */
function leaseLive(hold, nowMs) {
  if (!hold.leaseUntil) return false;
  const until = Date.parse(hold.leaseUntil);
  return Number.isFinite(until) && until > nowMs;
}

/**
 * Is `num` prepare-held with a LIVE lease at `nowMs`? Pure read (used offline on the select/claim path).
 * Accepts `num` padded or unpadded. An expired hold returns false (ignored, like a crashed reservation).
 */
export function isHeld(state, num, nowMs) {
  const padded = String(num).padStart(3, '0');
  return (state?.holds ?? []).some((h) => h.num === padded && leaseLive(h, nowMs));
}

/** The session holding `num` with a live lease at `nowMs`, or `null`. */
export function heldBy(state, num, nowMs) {
  const padded = String(num).padStart(3, '0');
  const h = (state?.holds ?? []).find((x) => x.num === padded && leaseLive(x, nowMs));
  return h ? h.holder : null;
}

/** The set (padded nums) of items with a LIVE prepare-hold at `nowMs` — selection's hard-exclude set. */
export function heldNums(state, nowMs) {
  return (state?.holds ?? []).filter((h) => leaseLive(h, nowMs)).map((h) => h.num);
}

/**
 * Place/refresh a hold on `num` by `holder`, live until `leaseUntilIso`. Idempotent: re-holding an already-
 * held num refreshes its holder + lease (the session extends its own hold) rather than duplicating it.
 * Returns new state. Pure.
 */
export function addHold(state, num, holder, leaseUntilIso) {
  const padded = String(num).padStart(3, '0');
  const holds = state.holds.map((h) => ({ ...h }));
  const entry = { num: padded, holder: holder != null ? String(holder) : null, leaseUntil: leaseUntilIso ?? null };
  const i = holds.findIndex((h) => h.num === padded);
  if (i === -1) holds.push(entry);
  else holds[i] = entry; // refresh (extend lease / re-home holder)
  return { ...state, holds: holds.sort((a, b) => a.num.localeCompare(b.num)) };
}

/** Clear the hold for specific `nums` (prepare-release / the deliberate steal). Idempotent. */
export function removeHold(state, nums) {
  const set = new Set(nums.map((n) => String(n).padStart(3, '0')));
  return { ...state, holds: state.holds.filter((h) => !set.has(h.num)) };
}

/** Drop every expired hold at `nowMs` (housekeeping applied on each write so the token self-prunes). */
export function pruneExpired(state, nowMs) {
  return { ...state, holds: state.holds.filter((h) => leaseLive(h, nowMs)) };
}

/** Compute an ISO lease-until stamp `leaseMinutes` after `nowMs` — the CLI's clock boundary helper. */
export function leaseUntilIso(nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  return new Date(nowMs + leaseMinutes * 60_000).toISOString();
}

/** Serialize state back to `prepare-hold.json` text (with the self-documenting `_doc` header). */
export function serializeHolds(state) {
  return JSON.stringify(
    {
      _doc:
        'Prepare-hold tokens (#2219 (b) flow, build arm #2264). A session preparing a decision fork places a HARD hold here at prepare-start (`backlog.mjs prepare-hold <NNN>`), refreshes it by re-holding, and clears it at prepare-end (`backlog.mjs prepare-release <NNN>`) once its one lane→PR lands. `check:readiness --select` SKIPS a held item and `claim` REFUSES it (a hard lock, unlike the soft `reserve` deprioritize). Each hold carries a `leaseUntil` (default 8h, longer than a real prepare) so a crashed holder cannot block the item forever — an expired hold is ignored and self-pruned on the next write. Read OFFLINE (Rule #105).',
      holds: state.holds,
    },
    null,
    2,
  ) + '\n';
}
