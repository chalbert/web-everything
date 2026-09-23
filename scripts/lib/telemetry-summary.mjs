/**
 * @file scripts/lib/telemetry-summary.mjs
 * @description Backlog `xs0eutz` (epic `xjtmptc`, the /telemetry operator page) — the USAGE half of
 * `TelemetrySnapshot` v1 (`week`, `today`, `last10`), documented on plateau-app's `lane/xjtmptc-telemetry-design`
 * branch, `docs/telemetry-page.md`. Turns raw `claude-otel-collector` day-file records into the plan-week view:
 * per-ET-day spend by model family, `byModel`/`byRole` totals, cache health and output for today, and a 10-day
 * trailing trend. Machine/sources (the other half of the snapshot) are the NEXT slice — not built here.
 *
 * PURE — no `node:` imports, no fs, no clock read. `now` is always a caller-supplied parameter (a `Date` or an
 * ISO string), exactly like `scripts/lib/gate-health.mjs`'s own convention.
 *
 * ALLOWLIST PROJECTION: this module only ever reads `receivedAt`, `name`, `value`, `attributes.model` and
 * `attributes.query_source` off an input record. It never copies `attributes` (or any of its other keys —
 * `session.id`, `user.email`, `user.account_id`, `organization.id`, etc.) into its output, so no identity ever
 * reaches the returned snapshot by construction, not by a scrub applied afterward.
 *
 * DST-SAFE WEEKLY WINDOW — PORTED, NOT SHARED. `zoneOffsetMs`, `zonedWallClockToUtc`, `WEEKDAYS`,
 * `nextWeeklyRenewalUtc` and `previousWeeklyRenewalUtc` below are copied from the unmerged prototype
 * `scripts/usage-report/usage-report.mjs` (branch `lane/mechanical-dispatcher`), which built and proved this
 * exact `Intl.DateTimeFormat`-based, no-date-library approach (native-first, #75) for the same "plan week
 * renews Friday 16:00 America/New_York" boundary. Copied rather than imported because that file lives outside
 * this module's dependency graph today and is itself an unmerged prototype; when backlog #3896 graduates
 * `usage-report.mjs` into the mainline, this copy should be folded back into one shared implementation instead
 * of the two drifting independently.
 */

// ── ported DST-safe zone helpers (see file header) ──────────────────────────────────────────────────────

/** The IANA zone's UTC offset in ms (east-positive) AT a given instant. */
function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** Convert a WALL-CLOCK date+time as read in `timeZone` to the real UTC instant it names. Two passes
 *  converge because the zone only ever has two possible offsets either side of a DST transition. */
function zonedWallClockToUtc(y, m, d, hour, minute, timeZone) {
  let utcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 2; i += 1) utcMs = Date.UTC(y, m - 1, d, hour, minute, 0) - zoneOffsetMs(new Date(utcMs), timeZone);
  return new Date(utcMs);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The next occurrence, at or after `now`, of a weekly renewal `{ dayOfWeek, time, timezone }`. DST-safe by
 *  construction: the target date's own wall-clock-to-UTC conversion resolves the zone's offset AT THE TARGET
 *  DATE, never at "now". */
export function nextWeeklyRenewalUtc(now, { dayOfWeek, time, timezone }) {
  const targetDow = WEEKDAYS.indexOf(dayOfWeek);
  if (targetDow < 0) throw new Error(`nextWeeklyRenewalUtc: dayOfWeek "${dayOfWeek}" is not a weekday name`);
  const [hour, minute] = String(time).split(':').map(Number);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const nowDow = WEEKDAYS.indexOf(parts.weekday);
  const y = Number(parts.year); const m = Number(parts.month); const d = Number(parts.day);

  const advance = (days) => {
    const rolled = new Date(Date.UTC(y, m - 1, d + days));
    return zonedWallClockToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), hour, minute, timezone);
  };

  const daysToTarget = (targetDow - nowDow + 7) % 7;
  let target = advance(daysToTarget);
  if (target.getTime() <= now.getTime()) target = advance(daysToTarget + 7); // today's own occurrence already passed
  return target;
}

/** The PREVIOUS occurrence, at or before `now`, of the same weekly renewal shape. Mirrors
 *  `nextWeeklyRenewalUtc`'s own construction (never a fixed 7-day ms subtraction, which lands on the wrong
 *  wall-clock hour across a DST transition). */
export function previousWeeklyRenewalUtc(now, { dayOfWeek, time, timezone }) {
  const targetDow = WEEKDAYS.indexOf(dayOfWeek);
  if (targetDow < 0) throw new Error(`previousWeeklyRenewalUtc: dayOfWeek "${dayOfWeek}" is not a weekday name`);
  const [hour, minute] = String(time).split(':').map(Number);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const nowDow = WEEKDAYS.indexOf(parts.weekday);
  const y = Number(parts.year); const m = Number(parts.month); const d = Number(parts.day);

  const advance = (days) => {
    const rolled = new Date(Date.UTC(y, m - 1, d + days));
    return zonedWallClockToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), hour, minute, timezone);
  };

  const daysSinceTarget = (nowDow - targetDow + 7) % 7;
  let target = advance(-daysSinceTarget);
  if (target.getTime() > now.getTime()) target = advance(-daysSinceTarget - 7); // today's own occurrence hasn't happened yet
  return target;
}

/** The plan window this operator confirmed (usage-report.mjs, 2026-09-13): renews Friday 16:00 America/New_York. */
export const PLAN_WEEK_RENEWAL = Object.freeze({ cadence: 'weekly', dayOfWeek: 'Friday', time: '16:00', timezone: 'America/New_York' });

// ── calendar-day helpers (ET, plain Gregorian arithmetic once we have a Y-M-D) ─────────────────────────────

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The `timeZone`-local calendar day (`YYYY-MM-DD`) an instant falls on. */
function etDayKey(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** `dayKey` shifted by `n` calendar days — plain Gregorian arithmetic, no timezone involved (a calendar-day
 *  offset is not an instant). */
function addDaysToDayKey(dayKey, n) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The weekday name for a `YYYY-MM-DD` calendar date. Formatting the same Y-M-D as a UTC instant yields the
 *  correct weekday regardless of the real zone, because the calendar date is already resolved — no second
 *  zone conversion is needed just to name its weekday. */
function weekdayAbbrOf(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return WEEKDAY_ABBR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** `"Sun Sep 13"` — used only for the human-readable `previousWeek` incomparability reason. */
function formatDayLabel(dayKey) {
  const [, m, d] = dayKey.split('-').map(Number);
  return `${weekdayAbbrOf(dayKey)} ${MONTH_ABBR[m - 1]} ${d}`;
}

// ── model family / role classification ──────────────────────────────────────────────────────────────────

/** `id` contains `opus`/`sonnet`/`haiku` (case-insensitive) → that family; anything else → `'other'`. */
export function modelFamily(modelId) {
  const s = String(modelId || '').toLowerCase();
  if (s.includes('opus')) return 'opus';
  if (s.includes('sonnet')) return 'sonnet';
  if (s.includes('haiku')) return 'haiku';
  return 'other';
}

const ROLES = new Set(['main', 'subagent', 'auxiliary']);

/** `attributes.query_source` if it is one of the three known roles, else `'other'`. */
export function roleOf(querySource) {
  return ROLES.has(querySource) ? querySource : 'other';
}

// ── per-day reduction over the OTel metric names this slice covers ─────────────────────────────────────────

function emptyDaySums() {
  return {
    input: 0, output: 0, cacheRead: 0, cacheCreation: 0,
    commits: 0, linesChanged: 0, sessions: 0, activeSeconds: 0,
    usd: 0, hasUsd: false,
  };
}

function foldRecordIntoDay(sums, r) {
  const v = Number(r.value) || 0;
  switch (r.name) {
    case 'claude_code.token.usage': {
      const type = r.attributes?.type;
      if (type === 'input') sums.input += v;
      else if (type === 'output') sums.output += v;
      else if (type === 'cacheRead') sums.cacheRead += v;
      else if (type === 'cacheCreation') sums.cacheCreation += v;
      break;
    }
    case 'claude_code.commit.count': sums.commits += v; break;
    case 'claude_code.lines_of_code.count': sums.linesChanged += v; break;
    case 'claude_code.active_time.total': sums.activeSeconds += v; break;
    case 'claude_code.session.count': sums.sessions += v; break;
    case 'claude_code.cost.usage': sums.usd += v; sums.hasUsd = true; break;
    default: break;
  }
}

/** Shape a folded day into the fields `today`/`last10` both need. */
function shapeDay(sums) {
  const denom = sums.cacheRead + sums.cacheCreation + sums.input;
  return {
    cacheHitPct: denom > 0 ? sums.cacheRead / denom : null,
    tokens: { input: sums.input, output: sums.output, cacheRead: sums.cacheRead, cacheCreation: sums.cacheCreation },
    commits: sums.commits,
    linesChanged: sums.linesChanged,
    sessions: sums.sessions,
    activeHours: sums.activeSeconds / 3600,
    usd: sums.hasUsd ? sums.usd : null,
  };
}

// ── the entry point ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The usage half of `TelemetrySnapshot` v1: `{ week, today, last10 }`.
 *
 * @param {object} o
 * @param {Array<{v:number, receivedAt:string, name:string, unit:string, value:number, attributes:object}>} o.records
 *   Raw claude-otel-collector day-file records (any number of day files' worth, already read and concatenated
 *   by the caller — this module does no I/O).
 * @param {Date|string} o.now - injected "now", never read from a clock.
 * @param {{dayOfWeek:string, time:string, timezone:string}} [o.renewal] - defaults to `PLAN_WEEK_RENEWAL`.
 * @param {string} [o.timezone] - defaults to `renewal.timezone` (America/New_York) — the zone ET days are cut on.
 */
export function summarizeTelemetryUsage({ records = [], now, renewal = PLAN_WEEK_RENEWAL, timezone } = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) throw new Error('summarizeTelemetryUsage: `now` is not a valid date');
  const tz = timezone || renewal.timezone;

  const weekStart = previousWeeklyRenewalUtc(nowDate, renewal);
  const weekEnd = nextWeeklyRenewalUtc(nowDate, renewal);
  const todayKey = etDayKey(nowDate, tz);
  const startDayKey = etDayKey(weekStart, tz);
  const dayKeys = Array.from({ length: 8 }, (_, i) => addDaysToDayKey(startDayKey, i));

  // Group once by ET calendar day — `today`/`last10` read straight off it; the week loop below still checks
  // each record's real instant against `[weekStart, weekEnd)` on top of this, because the two boundary days
  // (day 0 and day 7) share a calendar date with hours that fall OUTSIDE the plan week (before/after 4 PM).
  const byDay = new Map();
  let earliestReceivedAt = null;
  for (const r of records) {
    const t = new Date(r.receivedAt);
    if (!Number.isFinite(t.getTime())) continue;
    if (earliestReceivedAt === null || t.getTime() < earliestReceivedAt.getTime()) earliestReceivedAt = t;
    const dk = etDayKey(t, tz);
    if (!byDay.has(dk)) byDay.set(dk, []);
    byDay.get(dk).push(r);
  }

  // ── week: per-day model-family spend, byModel, byRole ─────────────────────────────────────────────────
  const byModel = { opus: 0, sonnet: 0, haiku: 0, other: 0 };
  const byRole = { main: 0, subagent: 0, auxiliary: 0, other: 0 };
  const gapLabels = [];
  let totalUsd = 0;

  const days = dayKeys.map((dk, i) => {
    const dayUsd = { opus: 0, sonnet: 0, haiku: 0, other: 0 };
    let hasData = false;
    for (const r of byDay.get(dk) || []) {
      if (r.name !== 'claude_code.cost.usage') continue;
      const t = new Date(r.receivedAt).getTime();
      if (t < weekStart.getTime() || t >= weekEnd.getTime()) continue; // outside the plan week (boundary days)
      const v = Number(r.value) || 0;
      const family = modelFamily(r.attributes?.model);
      const role = roleOf(r.attributes?.query_source);
      dayUsd[family] += v;
      byModel[family] += v;
      byRole[role] += v;
      hasData = true;
    }
    const future = dk > todayKey;
    if (!hasData && !future) gapLabels.push(weekdayAbbrOf(dk));
    if (hasData) totalUsd += dayUsd.opus + dayUsd.sonnet + dayUsd.haiku + dayUsd.other;
    return {
      day: dk,
      label: weekdayAbbrOf(dk),
      partial: i === 0 ? 'from 4 PM' : (i === dayKeys.length - 1 ? 'to 4 PM' : null),
      future,
      usd: hasData ? dayUsd : null,
    };
  });

  const incomplete = gapLabels.length
    ? `${gapLabels.join(', ')} ${gapLabels.length > 1 ? 'have' : 'has'} no data`
    : null;

  // ── previousWeek — comparable only if the store's earliest record predates that OTHER window's own start ──
  const prevWeekStart = previousWeeklyRenewalUtc(new Date(weekStart.getTime() - 1), renewal);
  const prevWeekEnd = weekStart;
  let prevTotalUsd = 0;
  for (const r of records) {
    if (r.name !== 'claude_code.cost.usage') continue;
    const t = new Date(r.receivedAt).getTime();
    if (t >= prevWeekStart.getTime() && t < prevWeekEnd.getTime()) prevTotalUsd += Number(r.value) || 0;
  }
  const previousWeek = (earliestReceivedAt && earliestReceivedAt.getTime() < prevWeekStart.getTime())
    ? { comparable: true, totalUsd: prevTotalUsd }
    : {
      comparable: false,
      reason: earliestReceivedAt
        ? `usage data starts ${formatDayLabel(etDayKey(earliestReceivedAt, tz))}`
        : 'no usage data recorded yet',
    };

  // ── today ────────────────────────────────────────────────────────────────────────────────────────────
  const todaySums = emptyDaySums();
  for (const r of byDay.get(todayKey) || []) foldRecordIntoDay(todaySums, r);
  const todayShaped = shapeDay(todaySums);
  const today = {
    cacheHitPct: todayShaped.cacheHitPct,
    tokens: todayShaped.tokens,
    commits: todayShaped.commits,
    linesChanged: todayShaped.linesChanged,
    sessions: todayShaped.sessions,
    activeHours: todayShaped.activeHours,
  };

  // ── last10 — the 10 most recent ET calendar days ending today, independent of the plan-week window ─────
  const last10 = Array.from({ length: 10 }, (_, i) => addDaysToDayKey(todayKey, i - 9)).map((dk) => {
    const sums = emptyDaySums();
    for (const r of byDay.get(dk) || []) foldRecordIntoDay(sums, r);
    const shaped = shapeDay(sums);
    return {
      day: dk,
      cacheHitPct: shaped.cacheHitPct,
      commits: shaped.commits,
      linesChanged: shaped.linesChanged,
      sessions: shaped.sessions,
      activeHours: shaped.activeHours,
      usd: shaped.usd,
    };
  });

  return {
    week: {
      startedAt: weekStart.toISOString(),
      renewsAt: weekEnd.toISOString(),
      totalUsd,
      incomplete,
      days,
      byModel,
      byRole,
      previousWeek,
    },
    today,
    last10,
  };
}
