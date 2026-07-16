/**
 * Build-queue prioritization engine (#2528) — the pure ordering layer of the autonomous AI build queue
 * (epic #2527), per the ratified design decision #2526.
 *
 * A FIXED SKELETON + a CONFIGURABLE SCORE:
 *   - a coarse `tier` (pinned > normal > someday > won't) — the primary sort key and the human override;
 *   - a between-able `rank` (LexoRank / fractional string) for drag-to-order WITHIN a tier;
 *   - a WSJF-shaped `score = CostOfDelay / JobSize` computed from configurable weighted criteria, with
 *     time-based `aging` folded in so a long-waiting item is not starved WITHIN its tier;
 *   - a HARD readiness gate — only ready items are eligible.
 *
 * `nextToBuild` is a DETERMINISTIC pure function: same items + config + `now` → same pick. It is meant to
 * be evaluated once per build completion (WIP=1, non-preemptive).
 *
 * RATIFIED INVARIANT (#2526): prioritization is strictly DOWNSTREAM of readiness. Nothing here mutates an
 * item's `blockedBy` or readiness — the engine only READS them to filter, and orders the ready set. A
 * change to tier / rank / score / weights re-orders the ready set and can never make a blocked item
 * pullable, nor block a ready one.
 */

// ── Tiers (fixed enum; the primary sort key AND the human override) ─────────────────────────────────
export const TIERS = ['pinned', 'normal', 'someday', "won't"];
export const DEFAULT_TIER = 'normal';
/** `won't` is never built — it is the MoSCoW "won't have"; excluded from the eligible set. */
export const EXCLUDED_TIER = "won't";
const TIER_ORDER = new Map(TIERS.map((t, i) => [t, i])); // lower index = higher priority

/** A sane fallback JobSize for an item with no `size` (never divide by zero). */
const DEFAULT_SIZE = 3;

// ── Default config (WSJF-shaped weighted-scoring engine) ────────────────────────────────────────────
// One versioned config object. Items store raw inputs; this holds the logic. Editing weights re-ranks
// everything. `unblocks` is COMPUTED from the blockedBy graph; value/timeCriticality are human inputs.
export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  // Cost-of-Delay criteria — each reads a numeric input off the item (or the computed graph).
  criteria: [
    { key: 'value', weight: 50, default: 2 }, // business/strategic value, 1–5
    { key: 'timeCriticality', weight: 30, default: 1 }, // deadline / decay, 1–5
    { key: 'unblocks', weight: 20, default: 0 }, // COMPUTED: how many items this unblocks
  ],
  confidenceKey: 'confidence', // 0..1 multiplier (RICE's honest discount); default 1
  jobSizeKey: 'size', // denominator; existing backlog field
  aging: { ratePerDay: 0.5, cap: 10 }, // score points added per day waiting, capped
});

// ── Config validation (#2526: capped so it stays configurable-not-chaotic) ──────────────────────────
const MAX_CRITERIA = 5;
const MAX_SINGLE_WEIGHT = 50;

/** Validate a config object; returns `{ ok, errors }`. Weights must sum to 100, ≤5 criteria, none > 50%. */
export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return { ok: false, errors: ['config is not an object'] };
  const crit = Array.isArray(config.criteria) ? config.criteria : null;
  if (!crit || crit.length === 0) errors.push('criteria must be a non-empty array');
  else {
    if (crit.length > MAX_CRITERIA) errors.push(`too many criteria (${crit.length} > ${MAX_CRITERIA})`);
    const keys = new Set();
    let sum = 0;
    for (const c of crit) {
      if (!c || typeof c.key !== 'string' || !c.key) { errors.push('each criterion needs a string key'); continue; }
      if (keys.has(c.key)) errors.push(`duplicate criterion key "${c.key}"`);
      keys.add(c.key);
      if (typeof c.weight !== 'number' || c.weight < 0) errors.push(`criterion "${c.key}" weight must be ≥ 0`);
      else {
        if (c.weight > MAX_SINGLE_WEIGHT) errors.push(`criterion "${c.key}" weight ${c.weight} exceeds ${MAX_SINGLE_WEIGHT}%`);
        sum += c.weight;
      }
    }
    if (Math.abs(sum - 100) > 1e-9) errors.push(`weights must sum to 100 (got ${sum})`);
  }
  const rate = config.aging?.ratePerDay;
  if (rate != null && (typeof rate !== 'number' || rate < 0)) errors.push('aging.ratePerDay must be ≥ 0');
  return { ok: errors.length === 0, errors };
}

// ── Readiness gate (READ-ONLY mirror of the canonical definition) ───────────────────────────────────
// Ready = open + every blockedBy target resolved + not parked. The engine NEVER writes these; it reads
// them to filter. `byId` maps num/id → item so blockedBy edges can be resolved.
export function isReady(item, byId) {
  if (!item || item.status !== 'open') return false;
  if (item.tier === EXCLUDED_TIER) return false; // MoSCoW "won't" — never built
  const blockers = Array.isArray(item.blockedBy) ? item.blockedBy : [];
  for (const b of blockers) {
    const dep = byId.get(String(b));
    // An unknown or unresolved blocker means NOT ready (fail closed — never pull a maybe-blocked item).
    if (!dep || dep.status !== 'resolved') return false;
  }
  return true;
}

/** Index items by their `num` and `id` so blockedBy edges resolve regardless of which form was used. */
export function indexItems(items) {
  const byId = new Map();
  for (const it of items) {
    if (it.num != null) byId.set(String(it.num), it);
    if (it.id != null) byId.set(String(it.id), it);
  }
  return byId;
}

/**
 * How many OTHER *pending* items this item unblocks — the computed `unblocks` criterion input. Only counts
 * dependents that are still waiting (not resolved, not `won't`); a resolved or won't dependent is not work
 * this item would free, so it must not inflate Cost-of-Delay.
 */
function unblocksCount(item, items) {
  const keys = new Set([item.num, item.id].filter((x) => x != null).map(String));
  let n = 0;
  for (const other of items) {
    if (other === item) continue;
    if (other.status === 'resolved' || other.tier === EXCLUDED_TIER) continue;
    const bb = Array.isArray(other.blockedBy) ? other.blockedBy : [];
    if (bb.some((b) => keys.has(String(b)))) n++;
  }
  return n;
}

// ── Scoring ─────────────────────────────────────────────────────────────────────────────────────────
function criterionInput(item, criterion, ctx) {
  if (criterion.key === 'unblocks') return ctx.unblocks ?? criterion.default ?? 0;
  // numOr guards NaN too (an explicit `NaN` field must not poison the score).
  return numOr(item[criterion.key], criterion.default ?? 0);
}

/** Base WSJF score = CostOfDelay × confidence / JobSize (no aging). Pure. */
export function computeScore(item, config, ctx = {}) {
  let costOfDelay = 0;
  for (const c of config.criteria) costOfDelay += (c.weight / 100) * criterionInput(item, c, ctx);
  const confidence = clamp01(numOr(item[config.confidenceKey], 1));
  const jobSize = Math.max(numOr(item[config.jobSizeKey], DEFAULT_SIZE), 0.5);
  return (costOfDelay * confidence) / jobSize;
}

/** Days item has been waiting, from `dateOpened` to `now` (never negative). */
function ageDays(item, now) {
  const opened = Date.parse(item.dateOpened ?? '');
  if (Number.isNaN(opened) || Number.isNaN(now)) return 0;
  return Math.max(0, (now - opened) / 86_400_000);
}

/**
 * Effective score with aging folded in. Aging only reorders WITHIN a tier (tier is the primary sort key),
 * so a long-waiting item cannot leapfrog a higher tier — it just stops being starved by fresher work in
 * its own tier. Prevents within-tier starvation (#2526).
 */
export function effectiveScore(item, config, now, ctx = {}) {
  const base = computeScore(item, config, ctx);
  const rate = config.aging?.ratePerDay ?? 0;
  const cap = config.aging?.cap ?? Infinity;
  const bonus = Math.min(cap, rate * ageDays(item, now));
  return base + bonus;
}

// ── Ordering ─────────────────────────────────────────────────────────────────────────────────────────
function tierRank(item) {
  const idx = TIER_ORDER.get(item.tier ?? DEFAULT_TIER);
  return idx == null ? TIER_ORDER.get(DEFAULT_TIER) : idx;
}

/**
 * The full ordered build queue: every READY item, in the deterministic order the builder would pull them.
 * Sort keys, in order: tier (pinned first) → effectiveScore (desc) → rank (asc, the manual override) →
 * dateOpened (asc, FIFO tie-break) → num (asc, total-order guarantee).
 */
export function orderQueue(items, config = DEFAULT_CONFIG, now = Date.now()) {
  const byId = indexItems(items);
  const ready = items
    .filter((it) => isReady(it, byId))
    .map((it) => ({
      item: it,
      tier: tierRank(it),
      score: effectiveScore(it, config, now, { unblocks: unblocksCount(it, items) }),
      rank: it.rank ?? '',
      opened: item_dateKey(it),
      // `num` is a string on disk — coerce to a number so the tie-break is a real total order
      // (NaN/undefined → Infinity, sorted last). Bug caught in review: numOr(string) fell through to Infinity.
      num: numOr(Number(it.num), Infinity),
    }));
  ready.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.score - a.score ||
      cmp(a.rank, b.rank) ||
      cmp(a.opened, b.opened) ||
      a.num - b.num,
  );
  return ready.map((r) => r.item);
}

/** The single next item the builder should build, or `null` if the ready set is empty. Deterministic. */
export function nextToBuild(items, config = DEFAULT_CONFIG, now = Date.now()) {
  return orderQueue(items, config, now)[0] ?? null;
}

// ── LexoRank (fractional string ranking; O(1) drag-reorder) ──────────────────────────────────────────
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const digit = (ch) => DIGITS.indexOf(ch);

/**
 * A rank string strictly between `lo` and `hi` (lexicographically). `lo=''` means "before everything",
 * `hi=''` means "after everything". Requires lo < hi when both are set. A drag rewrites ONE item's rank.
 */
export function rankBetween(lo = '', hi = '') {
  if (hi && lo >= hi) throw new Error(`rankBetween needs lo < hi, got "${lo}" / "${hi}"`);
  let prefix = '';
  let i = 0;
  let result;
  while (result === undefined) {
    const a = i < lo.length ? digit(lo[i]) : 0; // pad lo with '0'
    const b = i < hi.length ? digit(hi[i]) : BASE; // pad hi one past max
    if (a === b) { prefix += DIGITS[a]; i++; continue; }
    const mid = Math.floor((a + b) / 2);
    if (mid > a) { result = prefix + DIGITS[mid]; break; }
    // adjacent digits: take lo's digit, then find the smallest suffix strictly above lo's tail
    // (hi no longer constrains — prefix is already < hi at this position).
    result = prefix + DIGITS[a] + tailAbove(lo.slice(i + 1));
  }
  // Safety net: when `hi` is `lo` followed by only zeros (e.g. between "a" and "a0") NO key exists —
  // padding lo with '0' matches hi's zeros and the tail runs past hi. Fail loudly rather than return a
  // key that isn't strictly between (review-caught latent bug for externally-supplied zero-tail keys).
  if (result <= lo || (hi && result >= hi)) {
    throw new Error(`rankBetween: no key exists strictly between "${lo}" and "${hi}"`);
  }
  return result;
}

/** Smallest string strictly greater than `lo` (with no upper bound). */
function tailAbove(lo) {
  let prefix = '';
  for (let i = 0; i < lo.length; i++) {
    const a = digit(lo[i]);
    if (a + 1 < BASE) return prefix + DIGITS[Math.floor((a + BASE) / 2)];
    prefix += DIGITS[a];
  }
  return prefix + DIGITS[Math.floor(BASE / 2)];
}

/** N strictly-ascending rank strings — the initial ranks for a fresh ordering. */
export function initialRanks(n) {
  const out = [];
  let prev = '';
  for (let k = 0; k < n; k++) { prev = rankBetween(prev, ''); out.push(prev); }
  return out;
}

/** Re-space a list of ranks evenly (a rebalance, if keys ever drift long). Returns ascending ranks. */
export function rebalance(count) {
  return initialRanks(count);
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────
function numOr(v, fallback) { return typeof v === 'number' && !Number.isNaN(v) ? v : fallback; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function item_dateKey(it) { return String(it.dateOpened ?? ''); }
