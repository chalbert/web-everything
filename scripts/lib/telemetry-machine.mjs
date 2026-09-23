/**
 * @file scripts/lib/telemetry-machine.mjs
 * @description Backlog `xaxks4j` (epic `xjtmptc`, the /telemetry operator page) — the MACHINE and SOURCES
 * halves of `TelemetrySnapshot` v1 (plateau-app `docs/telemetry-page.md`, `lane/xjtmptc-telemetry-design`):
 * how loaded the laptop is right now, today's hourly busy % (ET), load by day from the host-sampler's daily
 * rollups, per-source freshness (`ok` | `stale` | `missing`), and the `collector-restart` hazard (#3739).
 * The USAGE half (`week`/`today`/`last10`) is the prior slice, `scripts/lib/telemetry-summary.mjs`.
 *
 * PURE — no `node:` imports, no fs, no clock read. Every function takes already-read data; `now`/`nowMs` are
 * always caller-supplied, exactly like `telemetry-summary.mjs`'s and `gate-health.mjs`'s own convention.
 */

// ── small pure helpers ──────────────────────────────────────────────────────────────────────────────────

/** Median of a numeric array. `null` for an empty (or all-non-finite) input — there is no "no data" number
 *  to fake, and returning 0 would read as a real reading of zero load. */
export function median(values) {
  const nums = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/** `{ dayKey: 'YYYY-MM-DD', hour: 0..23 }` for an instant, read in `timeZone`. */
export function etDayHour(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { dayKey: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `"Mon Sep 22"` for a `YYYY-MM-DD` calendar date. Ported rather than imported from
 *  `telemetry-summary.mjs`'s private `formatDayLabel` — same reasoning that file's own header gives for its
 *  ported DST helpers: four lines of plain Gregorian arithmetic is cheaper than exporting a private formatter
 *  across two modules for one caller each. */
export function dayLabel(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY_ABBR[dt.getUTCDay()]} ${MONTH_ABBR[m - 1]} ${d}`;
}

// ── machine.now + machine.cores ─────────────────────────────────────────────────────────────────────────

/** The most recent value in a `[{timestamp, value}]` list — the LATEST wins, not the largest. `null` if
 *  empty or every timestamp is unparseable. */
export function latestValue(samples) {
  let best = null;
  for (const s of Array.isArray(samples) ? samples : []) {
    const t = new Date(s?.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    if (!best || t > best.t) best = { t, value: Number(s.value) };
  }
  return best ? best.value : null;
}

/**
 * macOS `host.mem.pressure_level` sample values seen in practice are `1` (normal), `2` (warn), `4` (critical)
 * — the `dispatch_source_memorypressure` flags. `>= 3` also reads as `critical` (anything worse than warn),
 * and anything else (0, negative, non-finite) is `null` rather than a guess at a level nobody has seen.
 */
export function memPressureLevel(raw) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  if (v === 1) return 'normal';
  if (v === 2) return 'warn';
  if (v >= 3) return 'critical';
  return null; // 0, negative, or a non-integer level nobody has observed — a guess, not a reading
}

/**
 * `machine.now` + `machine.cores`.
 *
 * @param {object} o
 * @param {Array<{timestamp,value}>} o.busySamples - `host.cpu.busy_pct`
 * @param {Array<{timestamp,value}>} o.sessionSamples - `host.sessions.live`
 * @param {Array<{timestamp,value}>} o.pressureSamples - `host.mem.pressure_level`
 * @param {Array<{timestamp,value}>} o.coreSamples - `host.cpu.count`
 * @param {number|null} [o.fallbackCores] - a rollup's own `cores` field, used only when no raw sample exists
 *   (the raw tail can be empty right after a fresh day rolls over).
 */
export function computeMachineNow({
  busySamples = [], sessionSamples = [], pressureSamples = [], coreSamples = [], fallbackCores = null,
} = {}) {
  const rawCores = latestValue(coreSamples);
  // `Number(null)` is `0`, not "absent" — a bare `Number.isFinite` fallback would turn a genuinely missing
  // `fallbackCores` into a false reading of zero cores. `== null` catches both `null` and `undefined`.
  const fallback = fallbackCores == null ? NaN : Number(fallbackCores);
  return {
    now: {
      busyPct: latestValue(busySamples),
      claudeSessions: latestValue(sessionSamples),
      memPressure: memPressureLevel(latestValue(pressureSamples)),
    },
    cores: Number.isFinite(rawCores) ? rawCores : (Number.isFinite(fallback) ? fallback : null),
  };
}

// ── machine.todayHourlyBusyPct ──────────────────────────────────────────────────────────────────────────

/**
 * `machine.todayHourlyBusyPct` — 24 ET hours, median busy %, future hours `null`.
 *
 * `samples` may be drawn from more than one source — today's raw tail AND, for hours a bounded tail read
 * cannot reach, a closed day's rollup hourly buckets remapped onto ET — but this function does not care
 * where a sample came from, only which ET hour of `dayKey` it falls in. The merge is the CALLER's concern
 * (the io reader), never this one's.
 *
 * A gap hour (no sample fell in it) and a FUTURE hour both render `null` on the wire, but they are computed
 * differently here: a gap is "no data in the bucket", a future hour is "this hour has not happened yet in
 * `timezone` as of `now`" — the distinction the plateau-app contract draws between "no data" and "not
 * reached", so it is measured against `now`'s real ET hour, never inferred from an empty bucket.
 *
 * @param {Array<{timestamp, value}>} samples
 * @param {string} dayKey - the ET calendar day (`YYYY-MM-DD`) to bucket into.
 * @param {Date} now - injected clock.
 * @param {string} timezone
 * @returns {Array<number|null>} 24 entries, hour 0 first.
 */
export function todayHourlyBusyPct(samples, dayKey, now, timezone) {
  const buckets = Array.from({ length: 24 }, () => []);
  for (const s of Array.isArray(samples) ? samples : []) {
    const t = new Date(s?.timestamp);
    if (!Number.isFinite(t.getTime())) continue;
    const { dayKey: dk, hour } = etDayHour(t, timezone);
    if (dk !== dayKey) continue;
    buckets[hour].push(s.value);
  }
  const { dayKey: nowDayKey, hour: nowHour } = etDayHour(now, timezone);
  // `dayKey` is normally "today" itself (`nowDayKey`). The two fallbacks keep the function honest for any
  // other day it is handed: a fully past day has no future hours, a not-yet-reached day has none that aren't.
  const currentHour = nowDayKey === dayKey ? nowHour : (nowDayKey > dayKey ? 23 : -1);
  return buckets.map((vals, hour) => (hour > currentHour ? null : median(vals)));
}

// ── machine.days, from host-sampler rollups ─────────────────────────────────────────────────────────────

/** One `machine.days[]` entry from a parsed `<day>.rollup.json`. `null` for a malformed/missing rollup — the
 *  caller filters those out rather than rendering a day with no numbers. */
export function shapeMachineDay(rollup) {
  if (!rollup || typeof rollup !== 'object' || typeof rollup.day !== 'string') return null;
  const l = rollup.load1 || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    day: rollup.day,
    label: dayLabel(rollup.day),
    load1: { p50: num(l.p50), p90: num(l.p90), max: num(l.max) },
  };
}

/** The last 3 closed days, newest first. Ordering and de-duplication are the CALLER's job (which files it
 *  chose to read); this only shapes and drops what does not parse. */
export function machineDays(rollups) {
  return (Array.isArray(rollups) ? rollups : []).map(shapeMachineDay).filter(Boolean).slice(0, 3);
}

// ── sources[] + degraded[] ───────────────────────────────────────────────────────────────────────────────

export const CLAUDE_USAGE_STALE_MS = 15 * 60 * 1000; // the plateau-app contract's own rule (states #6)
export const HOST_SAMPLER_STALE_MS = 5 * 60 * 1000; // samples every 30s — 5 min silence is a real gap
export const ROLLUP_STALE_MS = 2 * 24 * 60 * 60 * 1000; // lands once a day — 2 days silent is stale

export const SOURCE_IDS = Object.freeze(['claude-usage', 'host-sampler', 'rollups']);

/**
 * One source's `state`, given it WAS readable (a read failure is decided by the caller — see
 * {@link shapeSources}). `lastAtMs == null` means no data has ever arrived, which is a fresh/idle store, not
 * a stale one, so it reads `'ok'`.
 *
 * The `claude-usage` carve-out is the plateau-app contract's own degraded rule (`docs/telemetry-page.md`,
 * states #6): silent more than 15 minutes while `sessionsLive > 0` is a real gap; silent on an idle laptop
 * (no Claude sessions running) is not.
 *
 * @param {object} o
 * @param {'claude-usage'|'host-sampler'|'rollups'} o.id
 * @param {number|null} o.lastAtMs
 * @param {number} o.nowMs
 * @param {number|null} [o.sessionsLive]
 * @returns {'ok'|'stale'}
 */
export function sourceState({ id, lastAtMs, nowMs, sessionsLive = null } = {}) {
  if (lastAtMs == null || !Number.isFinite(Number(lastAtMs))) return 'ok';
  const ageMs = Number(nowMs) - Number(lastAtMs);
  if (id === 'claude-usage') {
    if (ageMs <= CLAUDE_USAGE_STALE_MS) return 'ok';
    return Number(sessionsLive) > 0 ? 'stale' : 'ok';
  }
  const threshold = id === 'rollups' ? ROLLUP_STALE_MS : HOST_SAMPLER_STALE_MS;
  return ageMs > threshold ? 'stale' : 'ok';
}

/**
 * `sources[]` + `degraded[]`. `degraded` is ONLY the sources that FAILED TO READ (the wire contract's own
 * field comment: "named sources that failed to read") — a merely `stale` source still renders in `sources[]`
 * with that state; it is not repeated in `degraded`.
 *
 * @param {Record<string, {lastAtMs: number|null, missing: boolean, root: string|null}>} raw - keyed by
 *   {@link SOURCE_IDS}; a missing entry is treated the same as `{missing: true}`.
 * @param {number} nowMs
 * @param {number|null} sessionsLive
 */
export function shapeSources(raw, nowMs, sessionsLive) {
  const sources = SOURCE_IDS.map((id) => {
    const r = raw?.[id];
    if (!r || r.missing) {
      return { id, state: 'missing', lastAt: null, root: r?.root ?? null };
    }
    const state = sourceState({ id, lastAtMs: r.lastAtMs ?? null, nowMs, sessionsLive });
    return {
      id,
      state,
      lastAt: r.lastAtMs != null ? new Date(r.lastAtMs).toISOString() : null,
      root: r.root ?? null,
    };
  });
  const degraded = sources.filter((s) => s.state === 'missing').map((s) => s.id);
  return { sources, degraded };
}

// ── hazards: collector-restart (#3739) ──────────────────────────────────────────────────────────────────

/**
 * The `collector-restart` hazard (WE #3739): the collector's launchd job points at a script path that no
 * longer exists on disk, so it keeps running only because the process is old and would not survive a
 * restart (a reboot, a crash, a manual `launchctl kickstart`).
 *
 * A MISSING PLIST is not the hazard — it means launchd knows nothing about the collector at all, a
 * different (unmodelled) problem this operation does not diagnose, so it reports no hazard rather than
 * guessing one. Likewise, when the plist exists but its script path could not be determined (`scriptExists
 * === null`, e.g. `plutil` and the regex fallback both failed), this refuses to CLAIM the hazard: a read
 * failure is not evidence the path is missing, and reporting a false hazard is worse than reporting none.
 *
 * @param {{plistFound: boolean, scriptExists: boolean|null}} facts
 * @returns {Array<{id: 'collector-restart', ref: string}>}
 */
export function collectorHazards({ plistFound, scriptExists } = {}) {
  if (!plistFound || scriptExists !== false) return [];
  return [{ id: 'collector-restart', ref: 'WE #3739' }];
}
