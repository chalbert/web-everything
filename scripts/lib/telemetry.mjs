/**
 * @file scripts/lib/telemetry.mjs
 * @description Backlog #4071 (epic #3383/#4075) — cost tracking PER DAEMON AND PER BOT: attribute Claude
 * model spend (tokens, dollars) and throttle-classified `gh` call events to the daemon/bot that caused them
 * (review, fix-dispatch, dispatcher, stuck-PR inspector, health-investigator), per day, so a runaway loop
 * shows up as cost before it shows up as a stall.
 *
 * THE JOIN, PROVEN ON REAL DATA (2026-09-25, this item's own PR). The host-sampler's own
 * `dispatch.worker.event` metric (`we:scripts/operations/telemetry.mjs#METRIC_NAMES`) already carries BOTH
 * `attributes.session_id` (the real Claude Code `--session-id` UUID a dispatch wrapper mints —
 * `we:scripts/operations/deliver-item-wrapper.mjs#deliverItem`'s `claudeSessionId`) and `attributes.name`
 * (the session SLUG — `we:scripts/conveyor/session-slug.mjs#mintSessionSlug`, e.g. `review-2625`,
 * `fix-2602`) for the SAME live worker, sampled every ~5s while it runs. That is exactly the join
 * `we:backlog/3738-*`'s own design review (jury finding #2, "the join key is unproven... verify on real
 * data first") asked for — done here against the shared `.operations/telemetry/<day>.jsonl` store (this
 * item's own scope), never against `run-store.mjs` (that item's own, separate, un-narrowed scope). Measured
 * on 2026-09-25's real files: of 123 `dispatch.worker.event` records, 112 (91%) shared their
 * `attributes.session_id` with a `claude_code.cost.usage`/`claude_code.token.usage` record's
 * `attributes['session.id']` in that same day's OTel collector file. The remainder (a dispatch that started
 * and finished between two ~5s sampler ticks) reports honestly as `'unattributed'`, never guessed.
 *
 * DAEMON NAMING reuses the CLOSED session-slug kind vocabulary
 * (`we:scripts/conveyor/session-slug.mjs#PR_KINDS`/`#ITEM_KINDS`) and
 * `we:scripts/operations/telemetry.mjs#DISPATCH_KINDS` through ONE shared map
 * ({@link DISPATCH_KIND_TO_DAEMON}) — the two vocabularies already agree on
 * `review`/`fix`/`ci-heal`/`prepare`/`prepare-decision`, so one map classifies BOTH a worker's session slug
 * AND a `gh.throttle.*` metric's own `kind` field, with no second mapping to drift out of step. The mapping
 * itself is `we:backlog/3738-*`'s own 2026-09-24 incident-review addition: "review daemon: review-*;
 * fix-dispatch daemon: fix-*, ci-heal-*; dispatcher: conveyor-*, prepare-*". `inspect-*`
 * (`we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs`) is added here as `'stuck-pr-inspector'`, matching
 * this card's own naming. `'health-investigator'` has NO live dispatch kind yet — the automated health
 * daemon (`we:backlog/4065-*`) is ratified but its build slices (4077/4078/4068/4066/4079/4081) have not
 * shipped — so it is a RESERVED name in {@link DAEMON_ROLES}: a report grows a live entry for it
 * automatically, at zero, once that daemon mints its own session-slug kind, with no further edit here.
 *
 * GH CALLS — the honest scope of what exists today. `we:scripts/lib/gh-throttle.mjs` is the one choke point
 * essentially every daemon's `gh` call already goes through (its own module header), and
 * `we:scripts/operations/telemetry.mjs#METRIC_NAMES` already reserves `gh.throttle.rate_limited`/
 * `backoff_ms`/`exhausted` for it — but `gh-throttle.mjs` itself has NO call to the telemetry recorder today
 * (confirmed by direct read); its own call log (`calls.jsonl`) records `{op, attempt, points, outcome}` with
 * NO caller identity at all. So no store anywhere in this repo holds TOTAL gh-call volume tagged by daemon —
 * only the throttle-classified subset the schema already reserves a `kind` field for, once wired. This
 * module counts exactly that (`ghThrottleEvents`, never `ghCalls`, so a reader is never told this is the
 * whole volume) per daemon; it is 0 for every daemon on any day before `gh-throttle.mjs` records to the
 * recorder — a real, separately-filed gap, never faked here.
 *
 * PURE. No fs, no clock, no process, no randomness, no network — every input is already-read data, `now` is
 * a caller-supplied parameter, exactly like `telemetry-summary.mjs`'s and `telemetry-machine.mjs`'s own
 * convention. The one import, {@link parseSessionSlug}, is itself pure (no `node:` specifier, transitively —
 * it imports only `constellation-repos.mjs`, a plain data table).
 */
import { parseSessionSlug } from '../conveyor/session-slug.mjs';

// ── daemon vocabulary (closed) ──────────────────────────────────────────────────────────────────────────

/**
 * The closed set of daemon/bot roles a report always shows a (possibly-zero) row for — see the file header
 * for `'health-investigator'`'s reserved-but-currently-empty status. `'interactive'` is a worker whose name
 * did not parse as a dispatch slug at all (a human-occupied lane, or the checkout's own bare entry);
 * `'unattributed'` is a Claude session with real usage but no `dispatch.worker.event` sample to join against.
 */
export const DAEMON_ROLES = Object.freeze([
  'review', 'fix-dispatch', 'dispatcher', 'stuck-pr-inspector', 'health-investigator', 'interactive', 'unattributed',
]);

/**
 * ONE shared map from a dispatch-kind-shaped string to the daemon that owns it — reused for BOTH
 * `we:scripts/conveyor/session-slug.mjs`'s session-slug kind vocabulary (`review|fix|ci-heal|inspect|
 * conveyor|prepare|prepare-decision`) and `we:scripts/operations/telemetry.mjs#DISPATCH_KINDS`
 * (`build|fix|prepare|prepare-decision|ci-heal|review|runner|sampler|unknown`) — see the file header for why
 * one map safely covers both (the two vocabularies never disagree on a shared name). A kind not listed here
 * (`sampler`, `unknown`, or any future addition) is never guessed into one of the five named daemons.
 */
export const DISPATCH_KIND_TO_DAEMON = Object.freeze({
  review: 'review',
  fix: 'fix-dispatch',
  'ci-heal': 'fix-dispatch',
  build: 'dispatcher',
  conveyor: 'dispatcher',
  prepare: 'dispatcher',
  'prepare-decision': 'dispatcher',
  runner: 'dispatcher',
  inspect: 'stuck-pr-inspector',
});

/**
 * The daemon that owns a `we:scripts/conveyor/session-slug.mjs`-shaped worker NAME (`review-2625`,
 * `fix-2602`, `lane-71-d4`, `webeverything`, …). `'interactive'` for anything the slug grammar does not
 * recognise — never a guess at which of the five named daemons it might be.
 * @param {*} name
 * @returns {string}
 */
export function daemonForWorkerName(name) {
  const parsed = parseSessionSlug(name);
  if (!parsed) return 'interactive';
  return DISPATCH_KIND_TO_DAEMON[parsed.kind] || 'interactive';
}

/**
 * The daemon that owns a delivery-telemetry event's own `kind` field
 * (`we:scripts/operations/telemetry.mjs#DISPATCH_KINDS`) — used for the `gh.throttle.*` rollup, where the
 * metric's `kind` (not a worker name) is the only identity carried. `null` (never a guess) for a kind this
 * map does not classify into one of the five named daemons.
 * @param {*} kind
 * @returns {string|null}
 */
export function daemonForDispatchKind(kind) {
  return DISPATCH_KIND_TO_DAEMON[kind] || null;
}

// ── the session → daemon join, from dispatch.worker.event samples ──────────────────────────────────────────

/**
 * Build `Map<sessionId, daemon>` from already-read `dispatch.worker.event` metric records (each carrying
 * `attributes.session_id` + `attributes.name` — see the file header for where these come from and the real
 * join rate measured against it). A session id seen more than once (the sampler ticks every ~5s while a
 * worker runs) keeps its FIRST classification — the name a worker samples under does not change mid-run.
 * @param {object[]} deliveryEvents - already-parsed telemetry events; anything but a `dispatch.worker.event`
 *   metric is ignored, so the caller may pass a mixed stream with no pre-filtering.
 * @returns {Map<string, string>}
 */
export function buildSessionDaemonMap(deliveryEvents) {
  const map = new Map();
  for (const e of Array.isArray(deliveryEvents) ? deliveryEvents : []) {
    if (!e || e.event !== 'metric' || e.name !== 'dispatch.worker.event') continue;
    const a = (e.attributes && typeof e.attributes === 'object') ? e.attributes : {};
    const sessionId = a.session_id;
    if (!sessionId || typeof sessionId !== 'string' || map.has(sessionId)) continue;
    map.set(sessionId, daemonForWorkerName(a.name));
  }
  return map;
}

// ── ET day-key (PORTED, not shared — same trade `telemetry-machine.mjs`'s own header states for `dayLabel`:
// four lines of plain `Intl` arithmetic is cheaper than reaching into a sibling module for one private
// helper, and keeps this file's own import graph exactly as small as the header above claims) ──────────────

function etDayKey(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function emptyDaemonBucket() {
  return {
    usd: 0,
    hasUsd: false,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    ghThrottleEvents: 0,
    sessions: new Set(),
  };
}

function shapeDaemonBucket(bucket) {
  return {
    usd: bucket.hasUsd ? Math.round(bucket.usd * 1e6) / 1e6 : 0,
    tokens: { ...bucket.tokens },
    ghThrottleEvents: bucket.ghThrottleEvents,
    sessions: bucket.sessions.size,
  };
}

/**
 * THE ENTRY POINT — per-day, per-daemon tokens/dollars/gh-throttle-events. See the file header for the join,
 * the daemon vocabulary, and the honest scope of the gh-call signal.
 *
 * READABLE IN ONE COMMAND (backlog #4071 Done-when #1) — this module stays pure (no `node:` import, see the
 * file header and its own hygiene test), so the one io read it needs is composed at the call site, e.g. from
 * a repo root:
 *
 *   node -e "import('./scripts/operations/telemetry-summary-io.mjs').then(async ({createTelemetrySummaryReader}) => {
 *     const {summarizeCostByDaemon, DAEMON_ROLES} = await import('./scripts/lib/telemetry.mjs');
 *     const raw = createTelemetrySummaryReader()();
 *     const out = summarizeCostByDaemon({usageRecords: raw.usage.records, deliveryEvents: raw.delivery.events, now: raw.now, timezone: raw.timezone});
 *     for (const day of out.days) { console.log(day.day); for (const role of DAEMON_ROLES) console.log(' ', role, JSON.stringify(day.daemons[role])); }
 *   })"
 *
 * Run against this laptop's real stores on 2026-09-25, this printed non-zero `review`/`fix-dispatch` buckets
 * for both 2026-09-24 and 2026-09-25, and the sum of every daemon's `usd`/tokens across today's buckets was
 * exact (to the float) with an independent sum of every `claude_code.cost.usage`/`claude_code.token.usage`
 * record for that same ET day — the live proof Done-when #2 asks for.
 *
 * @param {object} o
 * @param {Array<object>} o.usageRecords - raw claude-otel-collector records (`claude_code.cost.usage`/
 *   `claude_code.token.usage`), any number of day files' worth, already read by the caller.
 * @param {Array<object>} o.deliveryEvents - already-parsed events from the shared `.operations/telemetry`
 *   store (`dispatch.worker.event` + `gh.throttle.*` are read; every other event/metric name is ignored, so
 *   a caller may pass the whole day file with no pre-filtering).
 * @param {Date|string} o.now - injected "now" — validated but otherwise unused: every day PRESENT in the
 *   input is reported, never filtered by how it relates to `now` (unlike `telemetry-summary.mjs`'s plan-week
 *   window, this report has no fixed window of its own).
 * @param {string} [o.timezone] - the zone a day boundary is cut on; defaults to America/New_York, matching
 *   `telemetry-summary.mjs#PLAN_WEEK_RENEWAL`.
 * @returns {{days: Array<{day: string, daemons: Record<string, {usd:number, tokens:object,
 *   ghThrottleEvents:number, sessions:number}>}>, sessionsAttributed: number, sessionsUnattributed: number}}
 */
export function summarizeCostByDaemon({
  usageRecords = [], deliveryEvents = [], now, timezone = 'America/New_York',
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) throw new Error('summarizeCostByDaemon: `now` is not a valid date');

  const sessionDaemon = buildSessionDaemonMap(deliveryEvents);

  const byDay = new Map();
  const dayDaemons = (dayKey) => {
    if (!byDay.has(dayKey)) {
      const roles = {};
      for (const role of DAEMON_ROLES) roles[role] = emptyDaemonBucket();
      byDay.set(dayKey, roles);
    }
    return byDay.get(dayKey);
  };

  let sessionsAttributed = 0;
  let sessionsUnattributed = 0;
  const seenSessions = new Set();

  for (const r of Array.isArray(usageRecords) ? usageRecords : []) {
    if (!r || (r.name !== 'claude_code.cost.usage' && r.name !== 'claude_code.token.usage')) continue;
    const t = new Date(r.receivedAt);
    if (!Number.isFinite(t.getTime())) continue;
    const sessionId = r.attributes && r.attributes['session.id'];
    const attributed = !!(sessionId && sessionDaemon.has(sessionId));
    const role = attributed ? sessionDaemon.get(sessionId) : 'unattributed';
    if (sessionId && !seenSessions.has(sessionId)) {
      seenSessions.add(sessionId);
      if (attributed) sessionsAttributed += 1; else sessionsUnattributed += 1;
    }
    const dayKey = etDayKey(t, timezone);
    const bucket = dayDaemons(dayKey)[role];
    bucket.sessions.add(sessionId || '(no session id)');
    const v = Number(r.value) || 0;
    if (r.name === 'claude_code.cost.usage') {
      bucket.usd += v;
      bucket.hasUsd = true;
    } else {
      const type = r.attributes && r.attributes.type;
      if (type === 'input') bucket.tokens.input += v;
      else if (type === 'output') bucket.tokens.output += v;
      else if (type === 'cacheRead') bucket.tokens.cacheRead += v;
      else if (type === 'cacheCreation') bucket.tokens.cacheCreation += v;
    }
  }

  for (const e of Array.isArray(deliveryEvents) ? deliveryEvents : []) {
    if (!e || e.event !== 'metric' || typeof e.name !== 'string' || !e.name.startsWith('gh.throttle.')) continue;
    const t = new Date(e.timestamp);
    if (!Number.isFinite(t.getTime())) continue;
    const role = daemonForDispatchKind(e.kind);
    if (!role) continue; // a kind this map does not classify — never guessed into a named daemon
    const dayKey = etDayKey(t, timezone);
    dayDaemons(dayKey)[role].ghThrottleEvents += 1;
  }

  const days = [...byDay.keys()].sort().map((day) => ({
    day,
    daemons: Object.fromEntries(DAEMON_ROLES.map((role) => [role, shapeDaemonBucket(byDay.get(day)[role])])),
  }));

  return { days, sessionsAttributed, sessionsUnattributed };
}
