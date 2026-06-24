/**
 * @file scripts/readiness/reservations.mjs
 * @description Cross-session batch reservation — the selection-tier SOFT hint (backlog #083).
 *
 * The cheap layer that sits ABOVE both the file lock and item-claim: it steers *which items a batch
 * picks*, never file edits. The residual it targets is wasteful, not corrupting — two independent
 * `/batch` sessions both run `check:readiness --select`, get the same ranked pack, and start the SAME
 * items, only diverging when one wins the late `claim`. The seam re-read keeps that correct, but the
 * loser already burned the up-front analysis. So a batch stamps the items it PLANS here at
 * plan-approval, and `--select` DEPRIORITIZES (never excludes) items held by ANOTHER session — a second
 * batch packs around them.
 *
 * Three invariants (the failure modes of any soft reservation), each realized below:
 *   1. Deprioritize, don't exclude — {@link deprioritizeReserved} sinks foreign-held items to the back
 *      of the already-ranked list; they still pack if budget remains. The `open → active` flip at
 *      `claim` stays the only real lock.
 *   2. Release on abandon — {@link removeBySession}/{@link removeNums} let a stopping batch clear its
 *      own holds (and `claim` auto-drops an item it hard-claims), so nothing it never worked stays held.
 *   3. Ignore stale — {@link partitionByTtl} treats an entry older than `ttlMinutes` (or with an
 *      unparseable timestamp) as absent, so a crashed session can't depress priority forever; writes
 *      self-prune via {@link pruneExpired}. This is the selection-tier analogue of the lock's holder
 *      lease (#083 fork 2) and queued-waiter TTL (fork 5).
 *
 * Advisory by design: the cost of ignoring the hint is only redundant analysis (self-correcting at the
 * seam), never corruption — so unlike the file lock (fork 1) it needs NO `PreToolUse` enforcement.
 *
 * This module is PURE — no fs, no process, no `Date` reads. Callers inject `nowMs`/`nowIso` and the
 * file text, so the same logic runs against the live `reservations.json` or an in-memory fixture in
 * tests. The CLIs (`scripts/backlog.mjs` reserve/unreserve, `scripts/check-readiness.mjs --select`)
 * own the fs + clock at their boundary.
 */

/** Default lease before a reservation is ignored. Long enough to outlast a batch, short enough that a
 *  crashed session's holds free within one working block. Overridable via the file's `ttlMinutes`. */
export const DEFAULT_TTL_MINUTES = 120;

/** A fresh, empty reservation state (no file yet, or an unreadable one). */
export function emptyState() {
  return { ttlMinutes: DEFAULT_TTL_MINUTES, held: [] };
}

/**
 * Tolerant parse of `reservations.json` text → normalized `{ ttlMinutes, held: [{num, session, at}] }`.
 * NEVER throws: bad JSON, missing fields, or junk rows degrade to an empty/clean state rather than
 * breaking the CLI that reads it (a corrupt hint must never block selection).
 * @param {string} text
 */
export function parseReservations(text) {
  if (!text || !text.trim()) return emptyState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyState(); }
  const ttlMinutes = Number.isFinite(raw?.ttlMinutes) && raw.ttlMinutes > 0 ? raw.ttlMinutes : DEFAULT_TTL_MINUTES;
  const held = Array.isArray(raw?.held)
    ? raw.held
        .filter((h) => h && h.num != null && h.session && h.at)
        .map((h) => ({ num: String(h.num).padStart(3, '0'), session: String(h.session), at: String(h.at) }))
    : [];
  return { ttlMinutes, held };
}

/** Age in ms of an ISO timestamp relative to `nowMs`; Infinity when unparseable (⇒ treated as expired). */
function ageMs(at, nowMs) {
  const t = Date.parse(at);
  return Number.isFinite(t) ? nowMs - t : Infinity;
}

/**
 * Split held reservations into `live` vs `expired` at `nowMs` (lease = `state.ttlMinutes`). Expired =
 * older than the lease or an unparseable timestamp — invariant 3 (ignore stale).
 * @param {{ttlMinutes:number, held:Array}} state
 * @param {number} nowMs
 */
export function partitionByTtl(state, nowMs) {
  const ttlMs = state.ttlMinutes * 60_000;
  const live = [], expired = [];
  for (const h of state.held) (ageMs(h.at, nowMs) <= ttlMs ? live : expired).push(h);
  return { live, expired };
}

/**
 * Live reservations held by a session OTHER than `mySession` — the set that should deprioritize. A
 * batch never deprioritizes its own held items (it wants to keep working its chain on a top-up
 * `--select`). Pass `mySession = null/undefined` (no session) and every live hold counts as foreign.
 * @returns {Map<string, string>} num → holding session
 */
export function foreignHolds(state, nowMs, mySession) {
  const { live } = partitionByTtl(state, nowMs);
  const m = new Map();
  for (const h of live) if (h.session !== mySession) m.set(h.num, h.session);
  return m;
}

/**
 * The session currently holding `num`, or `null`. The `reserve` step stamped each planned item with its
 * `--session` here, so `claim` can recover that session for the #952 gate baseline even when the claim
 * itself omits `--session` (the loop runs `claim <NNN>` without it) — making `--scope=<slug>` no longer
 * silently inert (#1723). Pure read; tolerates a `num` given padded or unpadded.
 * @param {{held: Array<{num:string, session:string, at:string}>}} state
 * @param {string|number} num
 * @returns {string|null}
 */
export function sessionForNum(state, num) {
  const padded = String(num).padStart(3, '0');
  const hold = (state.held ?? []).find((h) => h.num === padded);
  return hold ? hold.session : null;
}

/**
 * Deprioritize (NOT exclude) foreign-reserved items in an already-ranked list: a stable partition so
 * unreserved items keep their order up front and reserved items sink to the back (also in original
 * relative order). Each reserved item is annotated with `reservedBy` (the holding session). Pure —
 * returns a NEW array, same length (invariant 1: nothing is dropped, so a small pool isn't starved).
 * @param {Array<object>} ranked  Items carrying a `num`.
 * @param {Map<string,string>} foreign  From {@link foreignHolds}.
 */
export function deprioritizeReserved(ranked, foreign) {
  if (!foreign || foreign.size === 0) return ranked;
  const free = [], held = [];
  for (const it of ranked) {
    const by = foreign.get(String(it.num).padStart(3, '0'));
    if (by) held.push({ ...it, reservedBy: by });
    else free.push(it);
  }
  return [...free, ...held];
}

// ── State mutation (for backlog.mjs reserve/unreserve) — pure transforms on `state` ──

/**
 * Add holds for `nums` under `session`, stamped `nowIso`. First-holder-wins: a num already held by a
 * DIFFERENT session is left untouched (an advisory hint shouldn't let a latecomer silently steal it);
 * a re-reserve by the SAME session refreshes its timestamp (extends the lease). Returns new state.
 */
export function addHolds(state, nums, session, nowIso) {
  const want = nums.map((n) => String(n).padStart(3, '0'));
  const held = state.held.map((h) => ({ ...h }));
  for (const num of want) {
    const i = held.findIndex((h) => h.num === num);
    if (i === -1) held.push({ num, session, at: nowIso });
    else if (held[i].session === session) held[i] = { num, session, at: nowIso }; // refresh my own lease
    // else: held by another session — leave it (first holder wins; advisory)
  }
  return { ...state, held: held.sort((a, b) => a.num.localeCompare(b.num)) };
}

/** Drop every hold owned by `session` — invariant 2 (a stopping batch clears its own holds). */
export function removeBySession(state, session) {
  return { ...state, held: state.held.filter((h) => h.session !== session) };
}

/** Drop holds for specific `nums` (any session) — used to release individual items + clear-on-claim. */
export function removeNums(state, nums) {
  const set = new Set(nums.map((n) => String(n).padStart(3, '0')));
  return { ...state, held: state.held.filter((h) => !set.has(h.num)) };
}

/** Drop expired holds (invariant 3) — applied on every write so the file self-prunes over time. */
export function pruneExpired(state, nowMs) {
  return { ...state, held: partitionByTtl(state, nowMs).live };
}

/** Serialize state back to `reservations.json` text (with the self-documenting `_doc` header). */
export function serialize(state) {
  return JSON.stringify(
    {
      _doc:
        'Cross-session batch reservations (backlog #083 selection-tier soft hint). A batch stamps the items it PLANS here at plan-approval (`backlog.mjs reserve <NNN...> --session=<batch-slug>`); `check:readiness --select` DEPRIORITIZES (never excludes) items held by ANOTHER session, so a second concurrent batch packs around them. Advisory only — the real lock is the status:open→active flip at `claim`. Entries older than ttlMinutes are ignored (a crashed session cannot depress priority forever) and pruned on the next write. A batch clears its own holds on stop via `backlog.mjs unreserve --session=<slug>`, and `claim` auto-drops an item it hard-claims.',
      ttlMinutes: state.ttlMinutes,
      held: state.held,
    },
    null,
    2,
  ) + '\n';
}
