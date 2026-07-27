#!/usr/bin/env node
/**
 * @file scripts/readiness/conveyor-instrument.mjs
 * @description The CONVEYOR WALL-CLOCK INSTRUMENT (WE #2680, epic #2612 / program #2606). Measures WHERE
 *   per-item conveyor wall-clock actually goes — per item AND in aggregate — BEFORE any latency lever is spent on
 *   it. The parent goal is delivery THROUGHPUT (#2606); this instrument tells us which term binds so the B/E/D
 *   go/no-go is MEASURED, not asserted (`we:reports/2026-07-26-conveyor-per-item-latency.md`, Lever 0). Scripted
 *   per platform-decisions.md#deterministic-core-thin-judgment: the phase math is a deterministic, tested pure
 *   core; the /conveyor skill and the future console both SHELL its `--json`, never re-derive it (one impl, two
 *   shells).
 *
 * THE FIVE PHASES (the terms the design record names):
 *   • authoring          — dispatch → first-commit. The LLM producing the diff (the record's pick for the likely
 *                          dominant term). Round-4: this span is NOT pure authoring — it also holds lane-clone
 *                          setup / env boot / context load, so when a `setupDoneAt` mid-span mark is present it is
 *                          DECOMPOSED into `setup` + `authoringNet`. Without that decomposition the regime verdict
 *                          REFUSES to finger authoring (returns `authoring-bound-ambiguous`), so a coarse span can
 *                          never fire the wrong lever — the load-bearing round-4 guard.
 *   • firstCi            — first-CI start → CI green. Already runs in PARALLEL across lanes, so it moves LATENCY,
 *                          and only moves THROUGHPUT if it is the binding term.
 *   • pollGap            — the ≤ `intervalSec` daemon re-sweep wait once an item is land-eligible (bounded by the
 *                          resident drain daemon's poll interval).
 *   • landSerialization  — land-eligible → merged, MINUS the poll gap: the queue wait behind the single serial
 *                          sole-writer daemon. The term Lever C would attack — but only worth it if THIS binds.
 *   • poolSaturation     — an AGGREGATE, not a per-item phase: the fraction of the observation window during which
 *                          every lane was occupied (queueing on the fixed lane-pool WIDTH). Neither authoring nor
 *                          pool width has a lever in A–E, so if this binds the throughput fix is OUT of portfolio.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from conveyor-state.mjs #2611):
 *   • The PURE core (every `phase*` / `derive*` / `classify*` fn and {@link instrumentConveyor}) has NO fs, git,
 *     `Date`, `child_process`, or `gh` — it takes ALREADY-PARSED item/PR/lane records (timestamps injected as ISO
 *     strings) plus config and returns the per-item + aggregate breakdown. Unit-tested directly against plain
 *     objects, with zero git/network/gh (the item spec's "unit-tested with plain objects").
 *   • The IO SHELL (the `main()` CLI, gated on `import.meta.url === pathToFileURL(process.argv[1]).href`) owns all
 *     side effects: it gathers records from the SAME standard verbs the lane board reads (`plateau:src/backlog-view/
 *     lane-board-data.ts`) — the backlog loader + `gh` PR timestamps — plus an OPTIONAL gitignored dispatch-signal
 *     sidecar (`.conveyor/dispatch-log.json`, the "small signal, not a durable store" the round-2 review put in
 *     scope). NO parallel/durable state store (the standard-verbs-only rule, #2612). Every read is GUARDED — a
 *     failing collector degrades to a null/empty section, never a crash.
 *
 * NO FABRICATED PRECISION (the round-2 acceptance criterion): authoring is NOT cleanly derivable from `gh` PR
 *   timestamps (a PR is created AFTER authoring, so `createdAt` already excludes the authoring span). Isolating it
 *   needs a real dispatch → first-commit span, whose dispatch boundary is NOT durably recorded today. So the shell
 *   reads it from the dispatch-signal sidecar when present; when ABSENT the per-item `authoring` phase is `null`
 *   with `reason:'no-dispatch-signal'` and the aggregate flags `needsDispatchInstrumentation` — the instrument
 *   SURFACES the ambiguity it exists to remove rather than inventing a number. `mark-dispatch --item=NNN` appends
 *   one dispatch stamp to the sidecar (the capture verb the conveyor dispatch path calls at spawn); `mark-setup`
 *   appends the mid-span setup-done mark that enables the authoring/setup decomposition.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, writeSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
// Compose, never reinvent (#96): the PR→item-num map and the CI-rollup distiller are already the tested contract
// in conveyor-state.mjs — the IO shell reuses them so the two conveyor reads can never disagree on what a lane ref
// means or when a PR's CI is green. Both are PURE (no side effects at import); importing does NOT run its IO shell.
import { itemNumFromRef, ciRollup } from './conveyor-state.mjs';

/** Normalize an item id to the dispatch-log key form: a numeric run via `String(Number())` (drops leading zeros);
 *  a JIT `x…` slug LOWER-CASED. Used by BOTH the sidecar writer/reader and the record lookup so a mixed-case ref
 *  from `itemNumFromRef` (which preserves case) still finds its lowercased sidecar entry (review nit). */
export function normItemKey(num) {
  const s = String(num ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s.toLowerCase();
}

// ── PURE CORE (no fs / git / Date / child_process / gh — every input is passed IN) ───────────────────────────

/** The default daemon re-sweep interval (s): the resident drain daemon's `DEFAULTS.intervalSec=60`. A land-eligible
 *  item waits AT MOST this long for the daemon's next pass (the poll gap); any land wait beyond it is queue wait
 *  behind the serial writer (land-serialization). Exported so a caller/test can override it. */
export const DEFAULT_POLL_INTERVAL_S = 60;

/** The default pool-saturation threshold: an observation window saturated (every lane busy) at least this fraction
 *  of the time reads as pool-WIDTH-bound — throughput capped by lane count, a regime with no lever in A–E. */
export const DEFAULT_SATURATION_THRESHOLD = 0.5;

/**
 * Milliseconds between two ISO timestamps `a → b`, or `null` when EITHER is missing / unparseable, OR when the
 * span is negative (`b` before `a` — clock skew or a mis-paired boundary; never a negative duration). This is the
 * ONE span primitive every phase uses, so a missing boundary uniformly yields a `null` phase (never a `0` that
 * would understate an aggregate or a `NaN` that would poison a sum).
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {number|null}
 */
export function spanMs(a, b) {
  if (a == null || b == null) return null;
  const ta = Date.parse(String(a));
  const tb = Date.parse(String(b));
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  const d = tb - ta;
  return d < 0 ? null : d;
}

/**
 * The AUTHORING phase for one item: dispatch → first-commit, optionally decomposed into `setup` (dispatch →
 * setup-done) + `authoringNet` (setup-done → first-commit) when a `setupDoneAt` mid-span mark is present. Returns
 * a phase object `{ ms, decomposed, setup, authoringNet, reason }`:
 *   • No `dispatchedAt` → `{ ms:null, decomposed:false, reason:'no-dispatch-signal' }` — the honest ambiguity: a
 *     PR's `createdAt` is AFTER authoring, so without a real dispatch stamp authoring is not derivable (round-2).
 *   • No `firstCommitAt` → `{ ms:null, decomposed:false, reason:'no-first-commit' }`.
 *   • Both present, no `setupDoneAt` → `{ ms, decomposed:false, reason:'undecomposed' }` — a span, but the regime
 *     classifier will NOT finger authoring off an undecomposed span (round-4 wrong-lever guard).
 *   • All three present → `{ ms, decomposed:true, setup, authoringNet, reason:null }`.
 * @param {{dispatchedAt?:string|null, setupDoneAt?:string|null, firstCommitAt?:string|null}} rec
 * @returns {{ms:(number|null), decomposed:boolean, setup:(number|null), authoringNet:(number|null), reason:(string|null)}}
 */
export function phaseAuthoring(rec = {}) {
  const { dispatchedAt = null, setupDoneAt = null, firstCommitAt = null } = rec;
  if (dispatchedAt == null) return { ms: null, decomposed: false, setup: null, authoringNet: null, reason: 'no-dispatch-signal' };
  if (firstCommitAt == null) return { ms: null, decomposed: false, setup: null, authoringNet: null, reason: 'no-first-commit' };
  const ms = spanMs(dispatchedAt, firstCommitAt);
  if (setupDoneAt == null) return { ms, decomposed: false, setup: null, authoringNet: null, reason: 'undecomposed' };
  const setup = spanMs(dispatchedAt, setupDoneAt);
  const authoringNet = spanMs(setupDoneAt, firstCommitAt);
  // A decomposition is only VALID when all three spans are real — a null on any (clock skew, or a setup mark
  // outside the [dispatch, first-commit] window) means we can't trust the split, so fall back to undecomposed
  // rather than count a bogus half-split toward `authoringDecomposedN`.
  if (ms == null || setup == null || authoringNet == null) {
    return { ms, decomposed: false, setup: null, authoringNet: null, reason: 'undecomposed' };
  }
  return { ms, decomposed: true, setup, authoringNet, reason: null };
}

/**
 * The LAND phase for one item, split at the daemon poll interval: `landWait` = land-eligible (`readyAt`) → merged;
 * of that, up to `intervalS` seconds is the daemon's poll re-sweep (`pollGap`) and any excess is queue wait behind
 * the serial sole-writer daemon (`landSerialization`). A `null` landWait (missing boundary) yields all-null.
 * @param {{readyAt?:string|null, mergedAt?:string|null}} rec
 * @param {number} intervalS  the daemon re-sweep interval in seconds (poll gap ceiling)
 * @returns {{landWait:(number|null), pollGap:(number|null), landSerialization:(number|null)}}
 */
export function phaseLand(rec = {}, intervalS = DEFAULT_POLL_INTERVAL_S) {
  const landWait = spanMs(rec?.readyAt, rec?.mergedAt);
  if (landWait == null) return { landWait: null, pollGap: null, landSerialization: null };
  const cap = Math.max(0, Number(intervalS) || 0) * 1000;
  const pollGap = Math.min(landWait, cap);
  const landSerialization = Math.max(0, landWait - cap);
  return { landWait, pollGap, landSerialization };
}

/**
 * The full per-item phase breakdown: `authoring`, `firstCi`, and the land split (`pollGap` / `landSerialization`),
 * plus the raw `landWait`. Every phase is `null` when its boundary timestamps are absent — a partial record never
 * throws, it just under-populates. `total` sums only the NON-null, NON-overlapping phases (authoring + firstCi +
 * landWait) — landWait already contains pollGap+landSerialization, so they are NOT re-added.
 * @param {object} rec  one item/PR record (injected ISO timestamps)
 * @param {{intervalS?:number}} [cfg]
 * @returns {{num:*, authoring:object, firstCi:(number|null), pollGap:(number|null), landSerialization:(number|null), landWait:(number|null), total:(number|null)}}
 */
export function phaseBreakdown(rec = {}, { intervalS = DEFAULT_POLL_INTERVAL_S } = {}) {
  const authoring = phaseAuthoring(rec);
  const firstCi = spanMs(rec?.ciStartedAt, rec?.ciCompletedAt);
  const land = phaseLand(rec, intervalS);
  const parts = [authoring.ms, firstCi, land.landWait].filter((v) => v != null);
  const total = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
  return {
    num: rec?.num != null ? String(rec.num) : null,
    authoring,
    firstCi,
    pollGap: land.pollGap,
    landSerialization: land.landSerialization,
    landWait: land.landWait,
    total,
  };
}

/**
 * Pool-saturation from lane occupancy INTERVALS: each item occupies a lane for `[start, end]` (dispatch → merge).
 * Given the pool `width` and the occupancy intervals, compute peak concurrency and the fraction of the observation
 * window during which ALL `width` lanes were busy (a queueing-on-width signal). Uses a sweep over interval
 * endpoints — pure, O(n log n). A missing/invalid width (≤ 0) or empty intervals → a null-ish verdict (no signal),
 * never a divide-by-zero.
 * @param {{width?:number, intervals?:Array<{start?:string|null, end?:string|null}>}} input
 * @returns {{width:(number|null), windowMs:(number|null), peakConcurrency:number, saturatedMs:number, saturatedFraction:(number|null), samples:number}}
 */
export function poolSaturation({ width = null, intervals = [] } = {}) {
  const w = Number(width);
  const rows = (Array.isArray(intervals) ? intervals : [])
    .map((i) => ({ s: Date.parse(String(i?.start)), e: Date.parse(String(i?.end)) }))
    .filter((i) => !Number.isNaN(i.s) && !Number.isNaN(i.e) && i.e > i.s);
  const base = { width: Number.isFinite(w) && w > 0 ? w : null, windowMs: null, peakConcurrency: 0, saturatedMs: 0, saturatedFraction: null, samples: rows.length };
  if (rows.length === 0 || base.width == null) return base;
  // Build a delta-sweep: +1 at each start, −1 at each end; walk in time order tracking concurrency, accumulating
  // time-at-each-level between consecutive events.
  const events = [];
  for (const r of rows) { events.push({ t: r.s, d: +1 }); events.push({ t: r.e, d: -1 }); }
  events.sort((a, b) => a.t - b.t || a.d - b.d); // ends (−1) before starts (+1) at an exact tie → no phantom overlap
  const windowStart = Math.min(...rows.map((r) => r.s));
  const windowEnd = Math.max(...rows.map((r) => r.e));
  let cur = 0;
  let peak = 0;
  let saturatedMs = 0;
  let prevT = events[0].t;
  for (const ev of events) {
    const dt = ev.t - prevT; // time spent at the CURRENT concurrency level, before applying this event's delta
    if (dt > 0 && cur >= base.width) saturatedMs += dt;
    cur += ev.d;
    if (cur > peak) peak = cur;
    prevT = ev.t;
  }
  const windowMs = windowEnd - windowStart;
  return {
    width: base.width,
    windowMs,
    peakConcurrency: peak,
    saturatedMs,
    saturatedFraction: windowMs > 0 ? saturatedMs / windowMs : null,
    samples: rows.length,
  };
}

/**
 * Sum a per-item phase field across the breakdowns, ignoring `null`s. `field` is a dotted path into a breakdown
 * (`authoring.ms`, `firstCi`, `landSerialization`, …). Returns `{ sum, n }` — the total and how many items
 * contributed (so an aggregate reader knows a small sum from few samples from a small sum from many).
 * @param {object[]} breakdowns
 * @param {string} field
 * @returns {{sum:number, n:number}}
 */
export function sumPhase(breakdowns, field) {
  let sum = 0;
  let n = 0;
  for (const b of Array.isArray(breakdowns) ? breakdowns : []) {
    const v = field.split('.').reduce((o, k) => (o == null ? o : o[k]), b);
    if (typeof v === 'number' && !Number.isNaN(v)) { sum += v; n += 1; }
  }
  return { sum, n };
}

/**
 * Classify the BINDING regime from the aggregate — the whole point of the instrument (the B/E/D go/no-go). The
 * dispatch→first-commit span is DECOMPOSED into two DISTINCT binding candidates that route to DIFFERENT
 * out-of-portfolio fixes (round-4): `setup` (lane-clone / env boot / context load → clone/pool provisioning) and
 * `authoringNet` (the LLM producing the diff → authoring-time reduction). They are ranked SEPARATELY — never as a
 * fused `authoring` term, which would let a setup-heavy span masquerade as authoring-bound and fire the wrong
 * lever. Precedence:
 *   1. `pool-saturation-bound` — if the pool was saturated ≥ `saturationThreshold` of the window, WIDTH caps
 *      throughput no matter how small the per-item phases are (a structural bound; no A–E lever).
 *   2. AMBIGUITY GUARD (round-4): the UNDECOMPOSED authoring mass (`undecomposedAuthoringSum` — coarse spans with
 *      no setup-done mark) could resolve ENTIRELY to setup or authoringNet, so it JOINS the larger out-of-portfolio
 *      bucket. When a would-be in-portfolio winner could be overtaken by that join (`coarse + max(setup,
 *      authoringNet) >= maxV`), we cannot confidently fire an in-portfolio lever → `authoring-bound-ambiguous` +
 *      `needsDispatchInstrumentation`. This covers the fully-undecomposed case, the partial case where one coarse
 *      span dominates, AND the straddle where the coarse mass only flips the ranking once added to authoringNet.
 *   3. else the LARGEST of {setup, authoringNet, firstCi, landSerialization}:
 *      • setup → `setup-bound` (out of portfolio: clone/env provisioning).
 *      • authoringNet → `authoring-bound` (out of portfolio: authoring-time reduction).
 *      • firstCi → `latency-bound` (Lever E, then D; in portfolio).
 *      • landSerialization → `land-serialization-bound` (Lever C's premise; in portfolio).
 *   4. No non-null term anywhere → `insufficient-data` (or ambiguous if a dispatch signal was missing).
 * A measured non-authoring term (firstCi / landSerialization) that wins while authoring was NEVER measured
 * (`authoringMeasuredN === 0`, items lacked a dispatch signal) is flagged PROVISIONAL — authoring could dominate
 * unseen — so `needsDispatchInstrumentation` is set (the round-2 "don't rule out authoring unmeasured" guard).
 * @param {{sums:{setup:number, authoringNet:number, firstCi:number, landSerialization:number}, undecomposedAuthoringSum?:number, authoringMeasuredN?:number, authoringMissingN?:number, saturation:object, saturationThreshold?:number}} input
 * @returns {{regime:string, binding:(string|null), inPortfolio:boolean, needsDispatchInstrumentation:boolean, note:string}}
 */
export function classifyRegime({ sums = {}, undecomposedAuthoringSum = 0, authoringMeasuredN = 0, authoringMissingN = 0, saturation = {}, saturationThreshold = DEFAULT_SATURATION_THRESHOLD } = {}) {
  const frac = saturation?.saturatedFraction;
  if (typeof frac === 'number' && frac >= saturationThreshold) {
    return { regime: 'pool-saturation-bound', binding: 'poolSaturation', inPortfolio: false, needsDispatchInstrumentation: false,
      note: `pool saturated ${(frac * 100).toFixed(0)}% of the window (≥ ${(saturationThreshold * 100).toFixed(0)}%) — throughput is capped by lane WIDTH; no A–E lever addresses this (out of portfolio).` };
  }
  // The four actionable candidates, each routing to its own lever / out-of-portfolio fix.
  const candidates = [
    { key: 'setup', v: Number(sums.setup) || 0, regime: 'setup-bound', inPortfolio: false,
      note: 'setup (lane-clone / env boot / context load) is the largest term — the throughput fix is out of the A–E portfolio (clone/pool provisioning), NOT authoring or CI.' },
    { key: 'authoringNet', v: Number(sums.authoringNet) || 0, regime: 'authoring-bound', inPortfolio: false,
      note: 'authoringNet (dispatch→first-commit net of setup) is the largest term — the throughput fix is out of the A–E portfolio (authoring-time reduction).' },
    { key: 'firstCi', v: Number(sums.firstCi) || 0, regime: 'latency-bound', inPortfolio: true,
      note: 'first-CI is the largest term — Lever E (shard the full run), then D only if E leaves enough. CI runs in parallel, so this is a latency win first.' },
    { key: 'landSerialization', v: Number(sums.landSerialization) || 0, regime: 'land-serialization-bound', inPortfolio: true,
      note: 'land-serialization (queue wait behind the serial sole-writer daemon) is the largest term — Lever C\'s premise holds (decision #xwysuk4).' },
  ];
  const maxV = Math.max(0, ...candidates.map((c) => c.v));
  const coarse = Number(undecomposedAuthoringSum) || 0;
  // The larger out-of-portfolio bucket the undecomposed mass could join (it resolves ENTIRELY to setup OR
  // authoringNet — both out of portfolio). This is what makes the ambiguity guard account for the JOIN, not just
  // the coarse mass alone (re-review should-fix).
  const bestOutOfPortfolio = Math.max(Number(sums.setup) || 0, Number(sums.authoringNet) || 0);

  if (maxV <= 0) {
    // Nothing actionable measured. An undecomposed authoring mass OR a missing dispatch signal both mean the same
    // thing: capture the span before ruling anything (in) out.
    if (coarse > 0 || authoringMissingN > 0) {
      const why = coarse > 0
        ? 'the only measured mass is UNDECOMPOSED authoring (no setup-done mark) — it may be lane/env setup or genuine authoring'
        : `${authoringMissingN} item(s) lack a dispatch signal`;
      return { regime: 'authoring-bound-ambiguous', binding: coarse > 0 ? 'authoring' : null, inPortfolio: false, needsDispatchInstrumentation: true,
        note: `no actionable phase measured, and ${why} — capture dispatch → first-commit before ruling out authoring (round-4 guard).` };
    }
    return { regime: 'insufficient-data', binding: null, inPortfolio: false, needsDispatchInstrumentation: false,
      note: 'no non-null phase across the sample — nothing to bind on.' };
  }

  const winner = candidates.find((c) => c.v === maxV);
  // AMBIGUITY GUARD (round-4): an in-portfolio winner (firstCi / landSerialization) is only trustworthy if the
  // UNDECOMPOSED coarse mass — which could resolve entirely to setup or authoringNet — cannot lift an
  // out-of-portfolio bucket to/over it. If `coarse + bestOutOfPortfolio >= maxV`, the true binding term MIGHT be
  // out of portfolio, so we must NOT confidently fire an in-portfolio lever. (An out-of-portfolio winner is
  // unaffected: the go/no-go is already "out of portfolio", and the coarse mass only shuffles setup vs authoringNet
  // — harmless to the lever call.)
  if (winner.inPortfolio && coarse > 0 && coarse + bestOutOfPortfolio >= maxV) {
    return { regime: 'authoring-bound-ambiguous', binding: 'authoring', inPortfolio: false, needsDispatchInstrumentation: true,
      note: `a measured in-portfolio term (${winner.key}) is largest, but an UNDECOMPOSED authoring mass could join setup/authoringNet and overtake it — the binding term might be out of portfolio. Capture the setup boundary before firing a lever (round-4 guard).` };
  }
  const verdict = { regime: winner.regime, binding: winner.key, inPortfolio: winner.inPortfolio, needsDispatchInstrumentation: false, note: winner.note };
  // PROVISIONAL: a measured NON-authoring term wins, but authoring was never measured at all (all missing signal) —
  // it could be the unseen binding term. Flag so the reader knows to capture the dispatch span before trusting it.
  const authoringUnseen = authoringMeasuredN === 0 && authoringMissingN > 0;
  if (authoringUnseen && winner.key !== 'setup' && winner.key !== 'authoringNet') {
    return { ...verdict, needsDispatchInstrumentation: true,
      note: `${verdict.note} CAVEAT: authoring was NOT measured (${authoringMissingN} item(s) lack a dispatch signal), so this ranks only the MEASURED terms — capture dispatch → first-commit to rule authoring in or out.` };
  }
  return verdict;
}

/**
 * The top-level PURE composer: per-item records (+ pool-occupancy intervals + config) → the whole instrument
 * report — the per-item phase breakdowns, the aggregate per-phase sums, the pool-saturation verdict, and the
 * binding-regime classification. The IO shell gathers the raw records and calls this; a test drives it directly
 * with plain objects (the item spec's "unit-tested with plain objects").
 * @param {{
 *   records?:object[], pool?:{width?:number, intervals?:object[]}|null,
 *   intervalS?:number, saturationThreshold?:number,
 * }} input
 * @returns {object}
 */
export function instrumentConveyor({ records = [], pool = null, intervalS = DEFAULT_POLL_INTERVAL_S, saturationThreshold = DEFAULT_SATURATION_THRESHOLD } = {}) {
  const recs = Array.isArray(records) ? records : [];
  const breakdowns = recs.map((r) => phaseBreakdown(r, { intervalS }));
  const sums = {
    authoring: sumPhase(breakdowns, 'authoring.ms'),
    setup: sumPhase(breakdowns, 'authoring.setup'),
    authoringNet: sumPhase(breakdowns, 'authoring.authoringNet'),
    firstCi: sumPhase(breakdowns, 'firstCi'),
    pollGap: sumPhase(breakdowns, 'pollGap'),
    landSerialization: sumPhase(breakdowns, 'landSerialization'),
    landWait: sumPhase(breakdowns, 'landWait'),
  };
  const authoringDecomposedN = breakdowns.filter((b) => b.authoring.decomposed).length;
  const authoringMissingN = breakdowns.filter((b) => b.authoring.reason === 'no-dispatch-signal').length;
  // The authoring mass we CANNOT split into setup vs authoringNet — coarse spans (a dispatch stamp + first commit
  // but no setup-done mark). Fed to the classifier's ambiguity guard so an undecomposed span that could dominate
  // never gets mis-attributed to a specific lever.
  const undecomposedAuthoringSum = breakdowns
    .filter((b) => !b.authoring.decomposed && typeof b.authoring.ms === 'number')
    .reduce((a, b) => a + b.authoring.ms, 0);
  const saturation = poolSaturation(pool || {});
  const regime = classifyRegime({
    sums: { setup: sums.setup.sum, authoringNet: sums.authoringNet.sum, firstCi: sums.firstCi.sum, landSerialization: sums.landSerialization.sum },
    undecomposedAuthoringSum,
    authoringMeasuredN: sums.authoring.n,
    authoringMissingN,
    saturation,
    saturationThreshold,
  });
  return {
    generatedFor: recs.length,
    config: { intervalS, saturationThreshold },
    perItem: breakdowns,
    aggregate: {
      sums,
      authoringDecomposedN,
      authoringMissingN,
      undecomposedAuthoringSum,
    },
    poolSaturation: saturation,
    regime,
  };
}

// ── IO SHELL (runs only as a CLI — owns all git / child_process / gh / fs / clock) ───────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..'); // scripts/readiness → repo root
// The dispatch-signal sidecar: a GITIGNORED, EPHEMERAL "small signal, not a durable store" (round-2). It records
// dispatch (and optional setup-done) stamps the `gh`/backlog verbs cannot: authoring is the span BEFORE the PR
// exists. Mirrors the `.conveyor/` sidecar convention (`queue.json`, `learnings/`) the lane guard does not police.
const DISPATCH_LOG_PATH = process.env.CONVEYOR_DISPATCH_LOG || join(ROOT, '.conveyor', 'dispatch-log.json');

// stdout = machine payload ONLY; ALL logs / human text → stderr.
const log = (m) => process.stderr.write(m + '\n');

/**
 * Write a line to a fd SYNCHRONOUSLY and completely, then return — `process.stdout.write` is ASYNC to a pipe and
 * `process.exit()` drops the unflushed tail, silently TRUNCATING a large `--json` payload for an `execFileSync`
 * consumer. A synchronous `writeSync` fully drains BEFORE `process.exit`. Mirrors conveyor-state.mjs's writeAllSync.
 */
function writeAllSync(fd, line) {
  const buf = Buffer.from(String(line) + '\n', 'utf8');
  let off = 0;
  while (off < buf.length) {
    try { off += writeSync(fd, buf, off, buf.length - off); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EPIPE') break; throw e; }
  }
}

/** Hand-rolled `--k=v` flag parsing. */
function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Read + JSON-parse a file, or return `fallback` (never throws — a missing/corrupt file is a soft miss). */
function readJsonFile(path, fallback = null) {
  try {
    const obj = JSON.parse(readFileSync(path, 'utf8'));
    return obj ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Parse the dispatch-signal sidecar into `{ [num]: { dispatchedAt, setupDoneAt } }`. Tolerant: an ARRAY of
 * `{ num, dispatchedAt, setupDoneAt }` OR a `{ log: [...] }` wrapper both parse; the LAST stamp for a num wins (a
 * re-dispatch overwrites). A missing/corrupt sidecar → `{}` (no dispatch signal; authoring degrades honestly).
 * @param {string} path
 * @returns {Record<string, {dispatchedAt:(string|null), setupDoneAt:(string|null)}>}
 */
function readDispatchLog(path) {
  const raw = readJsonFile(path, []);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.log) ? raw.log : [];
  const out = {};
  for (const r of rows) {
    if (!r || r.num == null) continue;
    const key = normItemKey(r.num);
    out[key] = {
      dispatchedAt: r.dispatchedAt != null ? String(r.dispatchedAt) : (out[key]?.dispatchedAt ?? null),
      setupDoneAt: r.setupDoneAt != null ? String(r.setupDoneAt) : (out[key]?.setupDoneAt ?? null),
    };
  }
  return out;
}

/** Append one entry to the dispatch-signal sidecar (create dirs as needed, atomic rename). The `mark-dispatch` /
 *  `mark-setup` capture verbs — the "small signal" the conveyor dispatch path calls so authoring is measurable. */
function appendDispatchLog(path, entry) {
  const raw = readJsonFile(path, []);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.log) ? raw.log : [];
  rows.push(entry);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(rows, null, 2) + '\n');
  renameSync(tmp, path);
}

/** The earliest commit timestamp from a `gh pr view --json commits` payload. Prefers `authoredDate` — it is
 *  REBASE-STABLE (the drain rebases a lane at land, which rewrites `committedDate` but preserves `authoredDate`),
 *  so it stays the honest "authoring produced a diff" proxy. The FIRST commit's timestamp is that proxy. null when
 *  there are no commits / no dates. */
function firstCommitAt(commits) {
  const rows = Array.isArray(commits) ? commits : [];
  let best = null;
  for (const c of rows) {
    const t = c?.authoredDate ?? c?.committedDate ?? null;
    if (t && (best === null || String(t) < best)) best = String(t);
  }
  return best;
}

/** The CI window from a `statusCheckRollup`: the EARLIEST `startedAt` and the LATEST `completedAt` across checks.
 *  `{ ciStartedAt, ciCompletedAt }` (either null when absent). Only COMPLETED checks bound the end; a still-running
 *  check leaves `ciCompletedAt` at the latest completed one (an unfinished item simply under-reports firstCi). */
function ciWindow(statusCheckRollup) {
  const roll = Array.isArray(statusCheckRollup) ? statusCheckRollup : [];
  let started = null;
  let completed = null;
  for (const c of roll) {
    const s = c?.startedAt ?? null;
    const e = c?.completedAt ?? null;
    if (s && (started === null || String(s) < started)) started = String(s);
    if (e && (completed === null || String(e) > completed)) completed = String(e);
  }
  return { ciStartedAt: started, ciCompletedAt: completed };
}

/** Run `gh` and JSON-parse its stdout, or return `fallback` + push a message to `errors` on any failure. */
function gh(args, { errors, label, fallback = null } = {}) {
  try {
    const out = execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out || 'null');
  } catch (e) {
    if (errors) errors.push(`${label}: ${String(e.message || e).split('\n')[0]}`);
    return fallback;
  }
}

/**
 * Gather the per-item records from the SAME standard verbs the lane board reads: merged `gh` PRs (their commit /
 * CI / label / merge timestamps) joined by lane-ref item-num to the backlog item, enriched with the dispatch
 * signal from the sidecar. A limit / since window bounds the `gh` cost. Every read is guarded; a failure degrades
 * a field to null and logs to `errors`.
 * @returns {{records:object[], errors:string[]}}
 */
function gatherRecords(flags, errors) {
  const limit = String(flags.limit ?? '40');
  const dispatch = readDispatchLog(DISPATCH_LOG_PATH);
  // 1. The merged PR list (recent window) — number + head ref (→ item num) + created/merged stamps.
  const listArgs = ['pr', 'list', '--state', 'merged', '--limit', limit, '--json', 'number,headRefName,createdAt,mergedAt'];
  if (typeof flags.search === 'string') listArgs.push('--search', flags.search);
  const prs = gh(listArgs, { errors, label: 'gh pr list', fallback: [] }) || [];
  const records = [];
  for (const pr of prs) {
    const num = itemNumFromRef(pr?.headRefName);
    if (num == null) continue; // a non-lane PR (not a conveyor item) — skip
    // 2. Per-PR detail: commits (→ first-commit) + CI rollup (→ ci window + green verdict).
    const view = gh(['pr', 'view', String(pr.number), '--json', 'commits,statusCheckRollup'], { errors, label: `gh pr view #${pr.number}`, fallback: null });
    const commits = view?.commits ?? null;
    const { ciStartedAt, ciCompletedAt } = ciWindow(view?.statusCheckRollup);
    // land-eligible ≈ CI-green: for a CLEAN conveyor PR (ready-to-merge, no human), CI-green IS the land trigger,
    // so `readyAt` = when CI completed green. A review-PARKED PR's true land-eligible moment is later (after the
    // human accept) — a documented limitation: this measures the transport wait, not the human-review wait.
    const readyAt = ciRollup(view?.statusCheckRollup) === 'pass' ? ciCompletedAt : null;
    const sig = dispatch[normItemKey(num)] || {};
    records.push({
      num,
      prNumber: pr.number,
      dispatchedAt: sig.dispatchedAt ?? null,
      setupDoneAt: sig.setupDoneAt ?? null,
      firstCommitAt: firstCommitAt(commits),
      prCreatedAt: pr?.createdAt ?? null,
      ciStartedAt,
      ciCompletedAt,
      readyAt,
      mergedAt: pr?.mergedAt ?? null,
    });
  }
  return { records, errors };
}

/** The pool-occupancy intervals: each record occupies a lane from its dispatch (or PR-created, when no dispatch
 *  signal) to its merge. Pairs with the pool `--width` flag (the provisioned lane count) for the saturation math. */
function poolFromRecords(records, width) {
  const intervals = records
    .map((r) => ({ start: r.dispatchedAt ?? r.prCreatedAt ?? null, end: r.mergedAt ?? null }))
    .filter((i) => i.start && i.end);
  return { width: width != null ? Number(width) : null, intervals };
}

/** The IO shell: gather every raw record, compose the pure report, emit it. */
function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = parseFlags(cmd && cmd.startsWith('--') ? argv : rest);

  // Capture verbs — the "small signal, not a durable store" that makes authoring measurable (round-2). They WRITE
  // the dispatch-signal sidecar; the conveyor dispatch path calls `mark-dispatch` at spawn and `mark-setup` once
  // the lane clone + claim + context load are done (the setup-done boundary that decomposes authoring).
  if (cmd === 'mark-dispatch' || cmd === 'mark-setup') {
    const item = flags.item;
    if (item == null || item === true) { log('mark needs --item=NNN'); process.exit(2); }
    const at = typeof flags.at === 'string' ? flags.at : new Date().toISOString();
    const key = cmd === 'mark-dispatch' ? 'dispatchedAt' : 'setupDoneAt';
    appendDispatchLog(DISPATCH_LOG_PATH, { num: String(item), [key]: at });
    log(`  ${cmd} ${item} @ ${at} → ${DISPATCH_LOG_PATH}`);
    process.exit(0);
  }

  const errors = [];
  const { records } = gatherRecords(flags, errors);
  const intervalS = flags['interval-s'] != null ? Number(flags['interval-s']) : DEFAULT_POLL_INTERVAL_S;
  const saturationThreshold = flags['saturation-threshold'] != null ? Number(flags['saturation-threshold']) : DEFAULT_SATURATION_THRESHOLD;
  const pool = poolFromRecords(records, flags.width);
  const report = instrumentConveyor({ records, pool, intervalS, saturationThreshold });
  report.errors = errors;

  // Always emit the JSON payload (the `--json` view both the conveyor skill and the future console read). `--json`
  // is accepted for call-site symmetry with the sibling collectors but is not required.
  void flags.json;
  writeAllSync(1, JSON.stringify(report, null, 2));
  process.exit(0);
}

// Main-module detection — run the IO shell only when invoked directly, never on import (keeps the pure core
// importable by the test with zero side effects).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
