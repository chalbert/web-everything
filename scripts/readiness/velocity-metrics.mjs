#!/usr/bin/env node
/**
 * @file scripts/readiness/velocity-metrics.mjs
 * @description The VELOCITY-METRICS PRIMITIVE (WE #2686, parent #2505, epic #2676 Plateau design-studio).
 *   Derives per-item and rolled-up delivery velocity from the timestamps every backlog item ALREADY carries
 *   (`dateOpened` / `dateStarted` / `dateResolved` + `size`) — three views:
 *     • THROUGHPUT      — resolved points (and item count) per week over a trailing window.
 *     • CYCLE TIME      — the `dateStarted → dateResolved` span, summarised (n / mean / median / p85 / min / max).
 *     • WHERE-THE-TIME-GOES — how the in-flight work-in-progress splits between actively moving and waiting/blocked.
 *   It needs NO new required fields (the item spec's hard constraint): every input is a field items store today.
 *   Reusable BEYOND the feature-tracking screen — the same core shells fleet-health readouts and conveyor tuning
 *   (one impl, many shells), mirroring the `conveyor-instrument.mjs` precedent.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from conveyor-instrument.mjs #2680):
 *   • The PURE core (every `span*` / `itemVelocity` / `throughput` / `cycleTimeStats` / `whereTheTimeGoes` fn and
 *     the {@link rollUp} composer) has NO fs, git, `Date.now`, `child_process`, or `gh` — it takes ALREADY-PARSED
 *     item records (dates injected as ISO / `YYYY-MM-DD` strings) plus options and returns the breakdown. It is
 *     unit-tested directly against plain objects (the item spec's "unit-tested with plain objects"). Because it
 *     never reads the clock, the trailing-window `asOf` is INJECTED — and, when omitted, defaults deterministically
 *     to the latest `dateResolved` in the set, so the pure core stays a pure function of its inputs.
 *   • The IO SHELL (the `main()` CLI, gated on `import.meta.url === pathToFileURL(process.argv[1]).href`) owns the
 *     side effects: it reads `backlog/*.md`, parses frontmatter (gray-matter — the same parser the standards gate
 *     uses), maps each item to a record, composes the pure report, and emits `--json` or a terse human summary.
 *     Every read is guarded; a bad item degrades to a skip with a logged reason, never a crash.
 *
 * THE "BLOCKED SHARE" HONESTY BOUNDARY (the item's named open question — NO FABRICATED PRECISION):
 *   A TIME-WEIGHTED blocked share ("what fraction of cycle time was spent blocked") needs status-transition
 *   HISTORY that is NOT stored today — the item file keeps only the CURRENT `blockedBy` array, not when a block
 *   went on or came off. So {@link whereTheTimeGoes} deliberately computes a CURRENT-STATE POINT-SHARE of the live
 *   WIP (active points moving vs active points currently blocked) and LABELS it as such (`basis:'current-state'`
 *   + a `note`). It SURFACES the limitation rather than inventing a time-weighted number — adding real block-history
 *   capture is a separate, larger change the primitive intentionally does not presuppose.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const DAY_MS = 86_400_000;

/** The default trailing throughput window (4 weeks) when a caller passes none. */
export const DEFAULT_WINDOW_DAYS = 28;

// ── span primitives — null-tolerant, never-negative ─────────────────────────────────────────────────

/**
 * Milliseconds between two date strings (`YYYY-MM-DD` or full ISO). Null when either boundary is missing or
 * unparseable, and null (NEVER negative) when `b` precedes `a` — an out-of-order pair is bad data, not a span.
 */
export function spanMs(a, b) {
  if (a == null || b == null) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  const ms = tb - ta;
  return ms < 0 ? null : ms;
}

/** {@link spanMs} expressed in fractional days (null-preserving). */
export function spanDays(a, b) {
  const ms = spanMs(a, b);
  return ms == null ? null : ms / DAY_MS;
}

// ── per-item velocity ───────────────────────────────────────────────────────────────────────────────

/**
 * The velocity view of ONE item. All spans are null-tolerant, so a still-open or half-stamped item yields nulls
 * rather than throwing.
 * @param {{num?:*, size?:number, status?:string, dateOpened?:string, dateStarted?:string, dateResolved?:string,
 *          blockedBy?:Array}} item
 * @returns {{num:*, size:number, status:string|null, resolved:boolean, active:boolean, blocked:boolean,
 *            cycleDays:number|null, waitDays:number|null, leadDays:number|null}}
 *   cycleDays = started→resolved (the working span) · waitDays = opened→started (the pre-start queue wait) ·
 *   leadDays = opened→resolved (total lead time).
 */
export function itemVelocity(item = {}) {
  const size = Number.isFinite(item.size) ? item.size : Number(item.size) || 0;
  const status = item.status ?? null;
  const blocked = Array.isArray(item.blockedBy) && item.blockedBy.length > 0;
  return {
    num: item.num ?? null,
    size,
    status,
    resolved: status === 'resolved',
    active: status === 'active',
    blocked,
    cycleDays: spanDays(item.dateStarted, item.dateResolved),
    waitDays: spanDays(item.dateOpened, item.dateStarted),
    leadDays: spanDays(item.dateOpened, item.dateResolved),
  };
}

// ── throughput — resolved points / items per week over a trailing window ──────────────────────────────

/** The latest `dateResolved` present in a record set (ISO string), or null when none resolved. Pure — this is the
 *  deterministic default `asOf` so the window math never needs the wall clock. */
export function latestResolved(items = []) {
  let latest = null;
  for (const it of items) {
    if (it?.status !== 'resolved') continue; // consistent basis with throughput's resolved-only sum
    const d = it?.dateResolved;
    if (d == null) continue;
    const t = Date.parse(d);
    if (Number.isNaN(t)) continue;
    if (latest == null || t > latest) latest = t;
  }
  return latest == null ? null : new Date(latest).toISOString();
}

/**
 * Resolved-work throughput over the trailing `windowDays` ending at `asOf`.
 * @param {Array} items raw item records.
 * @param {{windowDays?:number, asOf?:string|null}} [opts] `asOf` defaults to the latest `dateResolved` in the set
 *   (deterministic — the pure core never reads the clock).
 * @returns {{windowDays:number, asOf:string|null, from:string|null, weeks:number, points:number, count:number,
 *            pointsPerWeek:number|null, itemsPerWeek:number|null}}
 *   Only items whose `dateResolved` falls in `(from, asOf]` count. `*PerWeek` is null when there is no window
 *   (no resolved item to anchor `asOf`).
 */
export function throughput(items = [], { windowDays = DEFAULT_WINDOW_DAYS, asOf = null } = {}) {
  const winOk = Number.isFinite(windowDays) && windowDays > 0;
  const weeks = winOk ? windowDays / 7 : null;
  const anchor = asOf ?? latestResolved(items);
  const asOfT = anchor == null ? NaN : Date.parse(anchor);
  // Degrade to the empty-window shape (never throw) on a bad window / unparseable asOf / no resolved anchor —
  // `new Date(NaN).toISOString()` would otherwise throw, breaking the "a bad input degrades, never crashes" rule.
  if (!winOk || Number.isNaN(asOfT)) {
    return { windowDays, asOf: null, from: null, weeks, points: 0, count: 0, pointsPerWeek: null, itemsPerWeek: null };
  }
  const fromT = asOfT - windowDays * DAY_MS;
  let points = 0;
  let count = 0;
  for (const it of items) {
    if (it?.status !== 'resolved') continue;
    const t = Date.parse(it?.dateResolved);
    if (Number.isNaN(t)) continue;
    if (t > fromT && t <= asOfT) {
      points += Number(it.size) || 0;
      count += 1;
    }
  }
  return {
    windowDays,
    asOf: new Date(asOfT).toISOString(),
    from: new Date(fromT).toISOString(),
    weeks,
    points,
    count,
    pointsPerWeek: weeks > 0 ? points / weeks : null,
    itemsPerWeek: weeks > 0 ? count / weeks : null,
  };
}

// ── cycle-time distribution ───────────────────────────────────────────────────────────────────────────

/** Nearest-rank percentile of an ASCENDING-sorted numeric array (p in [0,1]). Null on an empty array. */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const rank = Math.ceil(p * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx];
}

/**
 * Cycle-time (started→resolved, in days) summary over every RESOLVED item that has a computable cycle span.
 * @returns {{n:number, meanDays:number|null, medianDays:number|null, p85Days:number|null,
 *            minDays:number|null, maxDays:number|null}}
 */
export function cycleTimeStats(items = []) {
  const cycles = [];
  for (const it of items) {
    if (it?.status !== 'resolved') continue;
    const d = spanDays(it?.dateStarted, it?.dateResolved);
    if (d != null) cycles.push(d);
  }
  const n = cycles.length;
  if (n === 0) return { n: 0, meanDays: null, medianDays: null, p85Days: null, minDays: null, maxDays: null };
  cycles.sort((a, b) => a - b);
  const sum = cycles.reduce((s, x) => s + x, 0);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? cycles[mid] : (cycles[mid - 1] + cycles[mid]) / 2;
  return {
    n,
    meanDays: sum / n,
    medianDays: median,
    p85Days: percentile(cycles, 0.85),
    minDays: cycles[0],
    maxDays: cycles[n - 1],
  };
}

// ── where-the-time-goes — CURRENT-STATE point-share of live WIP (see the honesty-boundary note in @file) ──

/**
 * How the ACTIVE work-in-progress splits, by size points, between moving and currently-blocked — a CURRENT-STATE
 * snapshot, deliberately NOT time-weighted (that needs block history the items don't store; see the @file note).
 * @returns {{basis:'current-state', wipItems:number, wipPoints:number, inFlightPoints:number, blockedPoints:number,
 *            inFlightShare:number|null, blockedShare:number|null, note:string}}
 */
export function whereTheTimeGoes(items = []) {
  let inFlightPoints = 0;
  let blockedPoints = 0;
  let wipItems = 0;
  for (const it of items) {
    if (it?.status !== 'active') continue;
    wipItems += 1;
    const size = Number(it.size) || 0;
    const blocked = Array.isArray(it.blockedBy) && it.blockedBy.length > 0;
    if (blocked) blockedPoints += size;
    else inFlightPoints += size;
  }
  const wipPoints = inFlightPoints + blockedPoints;
  return {
    basis: 'current-state',
    wipItems,
    wipPoints,
    inFlightPoints,
    blockedPoints,
    inFlightShare: wipPoints > 0 ? inFlightPoints / wipPoints : null,
    blockedShare: wipPoints > 0 ? blockedPoints / wipPoints : null,
    note: 'current-state point-share of active WIP, NOT time-weighted — a time-weighted blocked share needs '
      + 'status-transition history that backlog items do not store (only the current blockedBy array).',
  };
}

// ── top-level composer ────────────────────────────────────────────────────────────────────────────────

/**
 * The full velocity report — throughput + cycle time + where-the-time-goes + per-item detail — from raw records.
 * @param {Array} items raw item records.
 * @param {{windowDays?:number, asOf?:string|null}} [opts]
 */
export function rollUp(items = [], { windowDays = DEFAULT_WINDOW_DAYS, asOf = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  return {
    counts: {
      total: list.length,
      resolved: list.filter((it) => it?.status === 'resolved').length,
      active: list.filter((it) => it?.status === 'active').length,
      open: list.filter((it) => it?.status === 'open').length,
      parked: list.filter((it) => it?.status === 'parked').length,
    },
    throughput: throughput(list, { windowDays, asOf }),
    cycleTime: cycleTimeStats(list),
    whereTheTimeGoes: whereTheTimeGoes(list),
    perItem: list.map(itemVelocity),
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// IO SHELL — side effects live below; the pure core above never touches fs / git / clock.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKLOG_DIR = join(HERE, '..', '..', 'backlog');

/** Parse `--k=v` / `--flag` argv into a flat object (bare flags → true). */
function parseFlags(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

/** Read every `backlog/NNN-*.md`, parse frontmatter, and map to velocity records. Guarded — a bad file is
 *  skipped with a logged reason, never fatal. */
function gatherItems(errors) {
  const require = createRequire(import.meta.url);
  let matter;
  try {
    matter = require('gray-matter');
  } catch {
    errors.push('gray-matter unavailable — cannot read backlog');
    return [];
  }
  let files;
  try {
    files = readdirSync(BACKLOG_DIR).filter((f) => /^\d+.*\.md$/.test(f));
  } catch (e) {
    errors.push(`cannot read ${BACKLOG_DIR}: ${e.message}`);
    return [];
  }
  const items = [];
  for (const f of files) {
    try {
      const fm = matter(readFileSync(join(BACKLOG_DIR, f), 'utf8')).data || {};
      const numMatch = /^(\d+)/.exec(f);
      items.push({
        num: numMatch ? Number(numMatch[1]) : f,
        size: Number(fm.size) || 0,
        status: fm.status ?? null,
        dateOpened: fm.dateOpened ?? null,
        dateStarted: fm.dateStarted ?? null,
        dateResolved: fm.dateResolved ?? null,
        blockedBy: Array.isArray(fm.blockedBy) ? fm.blockedBy : [],
      });
    } catch (e) {
      errors.push(`skip ${f}: ${e.message}`);
    }
  }
  return items;
}

const r1 = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toString());
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

function main(argv) {
  const flags = parseFlags(argv);
  const errors = [];
  const items = gatherItems(errors);
  const rawWin = flags['window-days'] != null && flags['window-days'] !== true ? Number(flags['window-days']) : NaN;
  const windowDays = Number.isFinite(rawWin) && rawWin > 0 ? rawWin : DEFAULT_WINDOW_DAYS;
  const rawAsOf = typeof flags['as-of'] === 'string' ? flags['as-of'] : null;
  const asOf = rawAsOf != null && !Number.isNaN(Date.parse(rawAsOf)) ? rawAsOf : null;
  const report = rollUp(items, { windowDays, asOf });

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ...report, errors }, null, 2)}\n`);
    return 0;
  }

  const t = report.throughput;
  const c = report.cycleTime;
  const w = report.whereTheTimeGoes;
  const lines = [
    'velocity-metrics — WE #2686 (from backlog item timestamps)',
    `  items: ${report.counts.total} total · ${report.counts.resolved} resolved · ${report.counts.active} active · ${report.counts.open} open · ${report.counts.parked} parked`,
    `  throughput (trailing ${t.windowDays}d, asOf ${t.asOf ?? '—'}): ${r1(t.pointsPerWeek)} pts/wk · ${r1(t.itemsPerWeek)} items/wk (${t.points} pts / ${t.count} items)`,
    `  cycle time (started→resolved, n=${c.n}): median ${r1(c.medianDays)}d · mean ${r1(c.meanDays)}d · p85 ${r1(c.p85Days)}d · [${r1(c.minDays)}–${r1(c.maxDays)}]d`,
    `  where-the-time-goes (WIP ${w.wipPoints} pts, ${w.basis}): ${pct(w.inFlightShare)} in-flight · ${pct(w.blockedShare)} blocked`,
  ];
  if (errors.length) lines.push(`  errors: ${errors.length} (see --json)`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

// Run the IO shell only when invoked directly — importing the module (e.g. from the test or a consumer shell)
// runs zero side effects, keeping the pure core clean-room testable.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv.slice(2));
}
