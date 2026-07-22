#!/usr/bin/env node
/**
 * @file scripts/readiness/conveyor-state.mjs
 * @description The CONVEYOR TICK STATE-READ (WE #2611, epic #2612). ONE `--json` read that returns the whole
 *   conveyor tick picture — the build queue, the live lanes + their leases/breaches, free slots, in-flight lane
 *   PRs, the resident drain daemon's status, the idle-stop clock inputs, and a stalled-lane health verdict — so
 *   each tick of the /conveyor skill (#2613) starts from ONE deterministic read instead of four ad-hoc commands
 *   plus eyeballing. Scripted per platform-decisions.md#deterministic-core-thin-judgment (script-decidable →
 *   a deterministic, tested script single-sourced in we:scripts; skills/UIs SHELL it, never re-derive it).
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from scope-lease-collect.mjs #2560):
 *   • The PURE core (every `shape*` / `derive*` / `assess*` fn and {@link assembleConveyorState}) has NO fs, git,
 *     `Date`, `child_process`, or `gh` — it takes the ALREADY-PARSED raw collector outputs plus an INJECTED clock
 *     (`now`) and returns the shaped object. It is unit-tested directly against fixtures, with zero git/network/gh.
 *   • The IO SHELL (the `main()` CLI, gated on `import.meta.url === pathToFileURL(process.argv[1]).href`) owns all
 *     side effects: it shells `backlog.mjs build-queue --json`, `lane-pool.mjs status --json`,
 *     `scope-lease-collect.mjs --json`, `gh pr list --json`, and (cross-repo, best-effort) the plateau drain
 *     daemon's `status --json`; reads `queued.json` + `lane-ports.json`; and scans delivery-agent transcript
 *     mtimes for the health scan. Every read is GUARDED — a failing collector degrades to a null/empty section
 *     plus an `errors[]` entry, never a crashed tick.
 *
 * COMPOSES, NEVER REINVENTS: the lanes section is derived from `lane-pool status --json` × the live scope-lease
 *   picture (`scope-lease-collect.mjs`, which itself composes the #2560 observer) — this script re-implements
 *   neither lease/overlap detection nor breach math, it just shapes their output into the tick view. The daemon
 *   section is the plateau daemon's OWN `status --json` verbatim-distilled (the daemon owns all drain logic,
 *   #2449). The health scan reuses the transcript-mtime stall approach from
 *   `.claude/skills/batch-backlog-items/workflow-progress.mjs`.
 *
 * DAEMON, GRACEFUL DEGRADE: the drain daemon lives in the SIBLING plateau-app repo, which may be absent (a WE-only
 *   checkout, or a lane pool without the sibling clone). When its CLI can't be found or errors, {@link shapeDaemon}
 *   yields the string `"unavailable"` — the conveyor skill reads that as "no resident drain, do the drain inline"
 *   rather than failing the whole tick.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readQueueFile, resolveQueuePath, normNum } from '../conveyor/queue-store.mjs';
// #2613 — the SAME empty-scope test the dispatcher uses (normScope([]) === [] ⇒ no usable scope), so the tick
// picture's `unshaped` set and the dispatch plan's `unshaped-no-scope` holds can never disagree on what counts
// as "no predicted scope". scope-lease.mjs is import-clean (no node built-ins), safe for the pure core.
import { normScope } from './scope-lease.mjs';

// ── PURE CORE (no fs / git / Date / child_process / gh — every input is passed IN) ───────────────────────────

/** The default stall threshold: a delivery-agent transcript silent longer than this reads as a suspected stall
 *  (mirrors workflow-progress.mjs's `WF_STALL_S` = 180s). Exported so a caller/test can override it. */
export const DEFAULT_STALL_MS = 180_000;

/**
 * Shape the ready/queued build queue from `backlog.mjs build-queue --json` (which lists the READY items in
 * next-to-build order — already unblocked, so `openBlockers` is empty by construction unless a producer annotates
 * it). Accepts the full command object (`{ queue: [...] }`) OR a bare row array OR null. Reads `scope` and
 * `openBlockers` DEFENSIVELY — a sibling lane (#2612's dispatch-plan script) may add a `scope` field to the build
 * queue rows; until then it is simply absent (→ null), and this never depends on it.
 *
 * `clearedNums` (#2613) is the SESSION-LOCAL conveyor queue — the ids the operator cleared for build via
 * `scripts/conveyor/queue.mjs` (the gitignored `.conveyor/queue.json` sidecar). When provided, a row's
 * `buildQueued` reflects SIDECAR membership (session-local operator intent), NOT the committed `buildQueued`
 * frontmatter — so `state.queue.filter(buildQueued)` (the conveyor skill's queue-empty test) tracks exactly
 * what the dispatch plan will pull. When `clearedNums` is null/absent, `buildQueued` falls back to the committed
 * frontmatter flag (backward-compatible with any caller that doesn't pass the sidecar).
 * @param {{queue?:object[]}|object[]|null|undefined} buildQueue
 * @param {Array<string|number>|null|undefined} clearedNums  the sidecar's cleared ids, or null to use frontmatter
 * @returns {Array<{num:(string|null), rank:(number|null), buildQueued:boolean, openBlockers:string[], scope:*}>}
 */
export function shapeQueue(buildQueue, clearedNums = null) {
  const rows = Array.isArray(buildQueue)
    ? buildQueue
    : Array.isArray(buildQueue?.queue)
      ? buildQueue.queue
      : [];
  const clearedSet = Array.isArray(clearedNums) ? new Set(clearedNums.map(normNum)) : null;
  return rows.map((r) => ({
    num: r?.num != null ? String(r.num) : null,
    rank: r?.rank ?? null,
    // buildQueued: sidecar membership when a cleared set is injected (#2613), else the committed frontmatter flag.
    buildQueued: clearedSet ? clearedSet.has(normNum(r?.num)) : r?.buildQueued === true,
    // openBlockers: explicit field if present, else the item's `blockedBy`, else [] (a ready row has none).
    openBlockers: Array.isArray(r?.openBlockers)
      ? r.openBlockers.map(String)
      : Array.isArray(r?.blockedBy)
        ? r.blockedBy.map(String)
        : [],
    // scope: read defensively — absent today (the dispatch-plan sibling owns adding it), null until then.
    scope: r?.scope ?? null,
  }));
}

/**
 * Extract a backlog item id from a lane `headRefName` like `lane/2611-conveyor-state` or `lane/xe2fmix-slug`.
 * Returns the numeric run (`2611`) or a JIT slug (`xe2fmix` — the drain's pre-number `x`+base36 id). A ref whose
 * first segment is a plain word (`lane/hotfix-2611`) does NOT return the word — it falls back to a trailing
 * `-<digits>` (→ `2611`), and a ref with no recognizable id at all returns null (never a silent wrong id).
 * @param {string|null|undefined} ref
 * @returns {string|null}
 */
export function itemNumFromRef(ref) {
  if (!ref) return null;
  const s = String(ref);
  // Normal lane ref: the first segment after `lane/` is the numeric item number …
  let m = s.match(/lane\/(\d+)(?:-|$)/i);
  if (m) return m[1];
  // … or a JIT slug (the drain's pre-number id: `x` + 5-7 base36 chars — anchored so a plain word never matches).
  m = s.match(/lane\/(x[a-z0-9]{5,7})(?:-|$)/i);
  if (m) return m[1];
  // Fallback: a non-standard word-first ref (`lane/hotfix-2611`) → the TRAILING digits, not the leading word.
  m = s.match(/-(\d+)$/);
  if (m) return m[1];
  return null;
}

/**
 * Distill a `gh pr` `statusCheckRollup` array into ONE CI token: `pass` (all complete & successful), `fail` (any
 * definitively-failed check), `pending` (any still-running / queued check, none failed), or `none` (no checks).
 * A definitively-red conclusion wins over pending; pending wins over pass. Never throws on a malformed rollup.
 * @param {Array<object>|null|undefined} statusCheckRollup
 * @returns {'pass'|'fail'|'pending'|'none'}
 */
export function ciRollup(statusCheckRollup) {
  const roll = Array.isArray(statusCheckRollup) ? statusCheckRollup : [];
  if (roll.length === 0) return 'none';
  const RED = new Set(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
  const DONE_OK = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
  let anyFail = false;
  let anyPending = false;
  for (const c of roll) {
    // A check-run reports `status`/`conclusion`; a legacy commit-status reports `state`. Prefer the terminal
    // `conclusion` when the run is COMPLETED, else fall back to the coarse `state`/`status`.
    const status = String(c?.status || '').toUpperCase();
    const conclusion = String(c?.conclusion || '').toUpperCase();
    const state = String(c?.state || '').toUpperCase();
    const verdict = conclusion || state || status;
    if (RED.has(verdict)) anyFail = true;
    else if (DONE_OK.has(verdict)) {
      /* complete & green — contributes nothing */
    } else anyPending = true; // COMPLETED-with-no-conclusion, IN_PROGRESS, QUEUED, PENDING, or unknown → pending
  }
  if (anyFail) return 'fail';
  if (anyPending) return 'pending';
  return 'pass';
}

/**
 * Shape the in-flight PR section from `gh pr list --json number,state,statusCheckRollup,labels,headRefName`.
 * @param {Array<object>|null|undefined} prList
 * @returns {Array<{num:(string|null), prNumber:(number|null), state:string, ci:string, labels:string[]}>}
 */
export function shapePrs(prList) {
  const rows = Array.isArray(prList) ? prList : [];
  return rows.map((p) => ({
    num: itemNumFromRef(p?.headRefName),
    prNumber: Number(p?.number) || null,
    state: String(p?.state || ''),
    ci: ciRollup(p?.statusCheckRollup),
    // gh labels arrive as `[{name}]`; tolerate a bare-string array too.
    labels: Array.isArray(p?.labels)
      ? p.labels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
      : [],
  }));
}

/**
 * Shape the live lanes section: `lane-pool status --json` rows (the pool + each lane's raw lease marker) crossed
 * with the live scope-lease picture (`scope-lease-collect.mjs --json`, per-lease predicted/observed/breach). Only
 * LIVE-LEASED lanes (`leased === true`) are active work streams. Each lane's `lease` paths come from the scope
 * picture's PREDICTED (declared/planned) scope when present, else the raw marker's `predictedScope`, else []; its
 * `breach` is the picture's per-lease breach set. `num` (the backlog item on the lane) is looked up in an injected
 * `laneItem` map (from the lane-ports registry) — null when unmapped.
 * @param {{poolStatus?:{lanes?:object[]}, scopePicture?:{leases?:object[]}, laneItem?:Record<string,*>}} input
 * @returns {Array<{lane:*, num:*, session:(string|null), lease:string[], breach:string[]}>}
 */
export function shapeLanes({ poolStatus, scopePicture, laneItem } = {}) {
  const laneRows = Array.isArray(poolStatus?.lanes) ? poolStatus.lanes : [];
  const held = laneRows.filter((l) => l && typeof l === 'object' && l.leased === true);
  const byLane = new Map();
  for (const s of Array.isArray(scopePicture?.leases) ? scopePicture.leases : []) byLane.set(s.lane, s);
  const itemMap = laneItem && typeof laneItem === 'object' ? laneItem : {};
  return held.map((l) => {
    const s = byLane.get(l.lane) || {};
    const lease = Array.isArray(s.predicted)
      ? s.predicted
      : Array.isArray(l.lease?.predictedScope)
        ? l.lease.predictedScope
        : [];
    return {
      lane: l.lane,
      num: itemMap[l.lane] ?? itemMap[String(l.lane)] ?? null,
      session: l.lease?.session ?? s.session ?? null,
      lease,
      breach: Array.isArray(s.breach) ? s.breach : [],
    };
  });
}

/**
 * Count FREE lanes in the pool — lanes that exist and hold no live lease (the conveyor's launch budget). A lane
 * with `leased === true` is occupied; a missing lane (`exists === false`) is not counted.
 * @param {{lanes?:object[]}|null|undefined} poolStatus
 * @returns {number}
 */
export function computeFreeSlots(poolStatus) {
  const laneRows = Array.isArray(poolStatus?.lanes) ? poolStatus.lanes : [];
  return laneRows.filter((l) => l && typeof l === 'object' && l.exists !== false && l.leased !== true).length;
}

/**
 * Distill the plateau drain daemon's `status --json` report (WE #2449) into the tick's `daemon` section, or the
 * string `"unavailable"` when the daemon CLI was absent / errored (a null/non-object report). Reads the report
 * DEFENSIVELY across its known shape (`launchd.loaded` → resident; top-level `lastPass`/`parkedNow`) with legacy
 * fallbacks, so a daemon-shape change degrades a field to a safe default rather than throwing.
 * @param {object|null|undefined} report
 * @returns {'unavailable'|{resident:boolean, lastPass:(object|null), parked:object[]}}
 */
export function shapeDaemon(report) {
  if (!report || typeof report !== 'object') return 'unavailable';
  const resident = report.launchd?.loaded ?? report.loaded ?? report.resident ?? false;
  const lastPass = report.lastPass ?? report.state?.lastPass ?? null;
  const parked = report.parkedNow ?? report.state?.parkedNow ?? report.parked ?? [];
  return { resident: !!resident, lastPass: lastPass ?? null, parked: Array.isArray(parked) ? parked : [] };
}

/**
 * The most recent MERGE timestamp from the daemon report — the newest `at` across `[lastPass, ...history]` whose
 * pass actually merged something (`merged > 0`). ISO strings compare lexicographically, so a plain `>` finds the
 * latest. null when the daemon is unavailable or has never merged in its retained window.
 * @param {object|null|undefined} report
 * @returns {string|null}
 */
export function lastMergeFromDaemon(report) {
  if (!report || typeof report !== 'object') return null;
  const passes = [report.lastPass, ...(Array.isArray(report.history) ? report.history : [])].filter(Boolean);
  let best = null;
  for (const p of passes) {
    if ((Number(p?.merged) || 0) > 0 && p?.at && (best === null || String(p.at) > best)) best = String(p.at);
  }
  return best;
}

/**
 * The most recent QUEUE-ADD timestamp from the parsed `queued.json` state (the newest `at` among queued items).
 * null when nothing is queued / the state is empty.
 * @param {{queued?:Array<{at?:string}>}|null|undefined} queuedState
 * @returns {string|null}
 */
export function lastQueueAddFromQueued(queuedState) {
  const q = Array.isArray(queuedState?.queued) ? queuedState.queued : [];
  let best = null;
  for (const e of q) if (e?.at && (best === null || String(e.at) > best)) best = String(e.at);
  return best;
}

/**
 * The idle-stop clock inputs the conveyor skill's idle-wait timer reads: the last merge, the last queue-add, and
 * the injected `now`. The clock (`now`) is passed IN — the pure core never calls `Date.now()` (determinism).
 * @param {{daemonReport?:object|null, queuedState?:object|null, now?:number|string|null}} input
 * @returns {{lastMerge:(string|null), lastQueueAdd:(string|null), now:(number|string|null)}}
 */
export function deriveIdle({ daemonReport, queuedState, now } = {}) {
  return {
    lastMerge: lastMergeFromDaemon(daemonReport),
    lastQueueAdd: lastQueueAddFromQueued(queuedState),
    now: now ?? null,
  };
}

/**
 * Does a transcript's text mention item `num` as a DISTINCT id? ANCHORED — the `#<num>` match must NOT be
 * followed by another alphanumeric, so `#26` never matches `#2611` / `#261x`, and a JIT slug never matches a
 * longer one. Without this anchor an unrelated recent session (`#2611`) masks a real stall on `#26` — the exact
 * failure the health verdict exists to catch. Mirrors workflow-progress.mjs's anchored item-id scrape.
 * @param {string} text  a transcript tail.
 * @param {string|number} num  the item id (numeric run or JIT slug).
 * @returns {boolean}
 */
export function transcriptMentionsItem(text, num) {
  if (!text || num == null) return false;
  const esc = String(num).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('#' + esc + '(?![0-9A-Za-z])').test(String(text));
}

/**
 * The health verdict — stalled-lane detection via delivery-agent transcript mtimes (reusing the approach in
 * workflow-progress.mjs). A lane is STALLED when its transcript's last activity (`lastActivity`, epoch ms) is
 * older than `stallMs`. A lane with `lastActivity == null` (no transcript located) is NOT flagged — a missing
 * mapping must never fabricate a stall. `errors` are collector-level read failures surfaced by the IO shell.
 * `verdict` is `warn` when anything is stalled OR any error was collected, else `ok`. The clock (`now`) and all
 * activity timestamps are passed IN — no `Date`/fs here (determinism).
 * @param {{lanes?:Array<{lane:*, num?:*, session?:*, lastActivity?:(number|null)}>, now?:number, stallMs?:number, errors?:string[]}} input
 * @returns {{verdict:'ok'|'warn', stalled:Array<{lane:*, num:*, session:*, idleS:number}>, errors:string[]}}
 */
export function assessHealth({ lanes = [], now = 0, stallMs = DEFAULT_STALL_MS, errors = [] } = {}) {
  const stalled = [];
  for (const l of Array.isArray(lanes) ? lanes : []) {
    const last = l?.lastActivity;
    if (last == null) continue; // no transcript located → conservative (never a false stall)
    if (now - Number(last) > stallMs) {
      stalled.push({
        lane: l.lane,
        num: l.num ?? null,
        session: l.session ?? null,
        idleS: Math.round((now - Number(last)) / 1000),
      });
    }
  }
  const errs = (Array.isArray(errors) ? errors : []).filter(Boolean).map(String);
  return { verdict: stalled.length || errs.length ? 'warn' : 'ok', stalled, errors: errs };
}

/**
 * The CLEARED-BUT-NOT-READY ids (#2613 review, required 2b): the sidecar ids (`clearedNums`) with NO row in the
 * build queue. `build-queue --json .queue` is hard-filtered to READY items, so a cleared id that is blocked /
 * resolved / a typo lands in the sidecar but never in a row — without surfacing it the operator gets NO feedback
 * (the "I cleared it, nothing happened" failure #2613 kills). This returns each such id (stored spelling) for the
 * tick's `clearedNotReady` signal. Pure — normalizes both sides via {@link normNum}.
 * @param {{queue?:object[]}|object[]|null|undefined} buildQueue  the build-queue rows (ready set)
 * @param {Array<string|number>|null|undefined} clearedNums  the sidecar ids
 * @returns {Array<string|number>}
 */
export function deriveClearedNotReady(buildQueue, clearedNums) {
  if (!Array.isArray(clearedNums)) return [];
  const rows = Array.isArray(buildQueue)
    ? buildQueue
    : Array.isArray(buildQueue?.queue)
      ? buildQueue.queue
      : [];
  const ready = new Set(rows.map((r) => normNum(r?.num)));
  return clearedNums.filter((n) => n != null && String(n) !== '' && !ready.has(normNum(n)));
}

/**
 * The UNSHAPED set (#2613 auto-prepare, ruled 2026-07-22): the ARMED (cleared-for-build) queue rows with NO
 * usable predicted `scope`. These are exactly the items the dispatcher NEVER launches to build — it holds every
 * one `unshaped-no-scope` (never runs it blind), and the /conveyor skill reads THIS set to dispatch a prepare-scope
 * task that authors each item's `scope:` upstream; once that lands the item is scoped and dispatches to BUILD.
 * Surfacing them here is how the skill decides to AUTO-PREPARE: "these cleared items have no scope — prepare it so
 * they can build and parallelize." An item counts as unshaped when its scope is absent / non-array / empty /
 * all-blank (the SAME `normScope`-emptiness test the dispatcher keys on), so the
 * two surfaces never disagree. Reads `buildQueued` from the session-local sidecar when `clearedNums` is injected
 * (else the committed frontmatter flag), so `unshaped` tracks exactly what the operator cleared this session.
 * Pure — shapes the queue via {@link shapeQueue} and filters; no fs / clock.
 * @param {{queue?:object[]}|object[]|null|undefined} buildQueue  the build-queue rows (scope-enriched by the shell)
 * @param {Array<string|number>|null|undefined} clearedNums  the sidecar's cleared ids, or null to use frontmatter
 * @returns {Array<{num:(string|null), scope:*}>} the armed, no-usable-scope rows (stored spelling of num kept)
 */
export function deriveUnshaped(buildQueue, clearedNums = null) {
  return shapeQueue(buildQueue, clearedNums)
    .filter((r) => r.buildQueued && normScope(r.scope).length === 0)
    .map((r) => ({ num: r.num, scope: r.scope }));
}

/**
 * The top-level PURE composer: raw collector outputs (+ an injected clock) → the whole conveyor tick picture. The
 * IO shell gathers the raw inputs and calls this; a test drives it directly with fixtures. `laneActivity` is a
 * `{ [lane]: epochMs }` map of each active lane's last transcript activity (the shell's best-effort transcript
 * scan); it is folded into the lanes ONLY for the health scan (the emitted `lanes` section stays activity-free).
 * @param {{
 *   buildQueue?:object|object[]|null, poolStatus?:object|null, scopePicture?:object|null, prList?:object[]|null,
 *   daemonReport?:object|null, queuedState?:object|null, laneItem?:Record<string,*>|null,
 *   laneActivity?:Record<string,number>|null, clearedNums?:Array<string|number>|null, now?:number,
 *   stallMs?:number, errors?:string[],
 * }} input
 * @returns {{queue:object[], clearedNotReady:Array<string|number>, unshaped:object[], lanes:object[], freeSlots:number, prs:object[], daemon:*, idle:object, health:object}}
 */
export function assembleConveyorState({
  buildQueue,
  poolStatus,
  scopePicture,
  prList,
  daemonReport,
  queuedState,
  laneItem,
  laneActivity,
  clearedNums = null,
  now,
  stallMs = DEFAULT_STALL_MS,
  errors = [],
} = {}) {
  const lanes = shapeLanes({ poolStatus, scopePicture, laneItem });
  const actMap = laneActivity && typeof laneActivity === 'object' ? laneActivity : {};
  const healthLanes = lanes.map((l) => ({
    ...l,
    lastActivity: actMap[l.lane] ?? actMap[String(l.lane)] ?? null,
  }));
  return {
    queue: shapeQueue(buildQueue, clearedNums),
    // Cleared ids with no ready build-queue row — surfaced so a clear never silently vanishes (#2613 review, 2b).
    clearedNotReady: deriveClearedNotReady(buildQueue, clearedNums),
    // Armed rows with NO predicted scope — the dispatcher NEVER builds these; the /conveyor skill reads this set
    // to AUTO-PREPARE each item's scope upstream, after which it dispatches to build (#2613 auto-prepare).
    unshaped: deriveUnshaped(buildQueue, clearedNums),
    lanes,
    freeSlots: computeFreeSlots(poolStatus),
    prs: shapePrs(prList),
    daemon: shapeDaemon(daemonReport),
    idle: deriveIdle({ daemonReport, queuedState, now }),
    health: assessHealth({ lanes: healthLanes, now, stallMs, errors }),
  };
}

// ── IO SHELL (runs only as a CLI — owns all git / child_process / gh / fs / clock) ───────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..'); // scripts/readiness → repo root
const BACKLOG_CLI = join(ROOT, 'scripts', 'backlog.mjs');
const LANE_POOL_CLI = join(ROOT, 'scripts', 'lane-pool.mjs');
const SCOPE_COLLECT_CLI = join(HERE, 'scope-lease-collect.mjs');
const QUEUED_PATH = join(ROOT, '.claude', 'skills', 'batch-backlog-items', 'queued.json');
const LANE_PORTS_PATH = join(ROOT, '.claude', 'lane-ports.json');

// stdout = machine payload ONLY; ALL logs / human text → stderr.
const log = (m) => process.stderr.write(m + '\n');

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

/** Run a node CLI and JSON-parse its stdout, or return `fallback` + push a message to `errors` on any failure. */
function runJson(node, args, { cwd = ROOT, errors, label } = {}) {
  try {
    const out = execFileSync(node, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    if (errors) errors.push(`${label}: ${String(e.message || e).split('\n')[0]}`);
    return undefined;
  }
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

/** Locate the cross-repo plateau drain-daemon CLI: env override, else the sibling `../plateau-app` (resolves in
 *  BOTH the primary checkout and a lane pool root, which carries a plateau-app sibling clone). null when absent. */
function findDaemonCli() {
  const env = process.env.CONVEYOR_DRAIN_DAEMON_CLI;
  const candidates = [
    env,
    resolve(ROOT, '..', 'plateau-app', 'tools', 'drain-daemon', 'cli.mjs'),
  ].filter(Boolean);
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

/** The lane → item-num map, reverse-derived from the lane-ports registry (`{ "<num>": { lane, port, repo } }`). */
function laneItemMap() {
  const reg = readJsonFile(LANE_PORTS_PATH, {});
  const map = {};
  if (reg && typeof reg === 'object') {
    for (const [num, entry] of Object.entries(reg)) {
      if (entry && entry.lane != null) map[entry.lane] = num;
    }
  }
  return map;
}

// ── best-effort delivery-agent transcript scan (health) — the IO half of the stall check ─────────────────────
// Reuses workflow-progress.mjs's approach: a transcript's mtime IS its last-activity clock, and an item's number
// is written distinctively in a worker's prompt (`#NNNN`). For each active lane we find the newest transcript
// whose tail references the lane's item number (ANCHORED, via transcriptMentionsItem) and take its mtime.
//
// LIMITS (best-effort by design — the PURE assessHealth verdict is the tested contract; this shell scan only
// supplies its `lastActivity` inputs, and a miss degrades to the conservative "no transcript ⇒ never a stall"):
//   • MAP: no reliable lane→session-uuid map exists, so a lane is matched by its item `#num` scraped from the
//     transcript. That number comes from `.claude/lane-ports.json` (`{ "<num>": { lane } }`). That registry is
//     `{}` today, so NO lane carries a num and the whole scan is INERT until it is populated — the health verdict
//     then simply reports `ok` (nothing to flag), never a false warn.
//   • TAIL: only the last TAIL_BYTES of each transcript is read, so an item id stated ONLY in a session's opening
//     prompt (never restated) can be missed. Acceptable — a live delivery agent restates its item id as it works.
//   • WINDOW: ACTIVITY_WINDOW_MS is kept FAR PAST the stall threshold on purpose. A lane silent LONGER than the
//     window is precisely the stall we want to catch, so the window must never drop that lane's (old-mtime)
//     transcript — it caps scan COST only, never the stall reach.
const PROJECTS = join(homedir(), '.claude', 'projects');
const ACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14d — far past any stall threshold, so a long-silent (stalled) lane's transcript is still found, not dropped
const TAIL_BYTES = 16 * 1024; // bounded tail read — a session transcript can be large

/** Read the last ≤ `TAIL_BYTES` of a file as utf8, or '' on any error. */
function readTail(path) {
  let fd = null;
  try {
    const size = statSync(path).size;
    if (size === 0) return '';
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.allocUnsafe(len);
    fd = openSync(path, 'r');
    const got = readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8', 0, got);
  } catch {
    return '';
  } finally {
    if (fd !== null) try { closeSync(fd); } catch { /* already gone */ }
  }
}

/** All recent (`mtime` within the window) session `.jsonl` transcripts under ~/.claude/projects. */
function recentTranscripts(nowMs) {
  const out = [];
  let projects = [];
  try { projects = readdirSync(PROJECTS).map((d) => join(PROJECTS, d)); } catch { return out; }
  for (const proj of projects) {
    let files = [];
    try { files = readdirSync(proj); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const path = join(proj, f);
      const m = (() => { try { return statSync(path).mtimeMs; } catch { return 0; } })();
      if (m && nowMs - m <= ACTIVITY_WINDOW_MS) out.push({ path, mtime: m });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

/** `{ [lane]: lastActivityMs }` — for each active lane with a mapped item num, the newest recent transcript whose
 *  tail references `#<num>`. Unmapped / unmatched lanes are simply omitted (→ null activity in the pure scan). */
function collectLaneActivity(lanes, nowMs) {
  const nums = lanes.map((l) => l.num).filter((n) => n != null).map(String);
  if (nums.length === 0) return {};
  const transcripts = recentTranscripts(nowMs);
  const numToMtime = new Map();
  for (const t of transcripts) {
    const tail = readTail(t.path);
    if (!tail) continue;
    for (const num of nums) {
      if (numToMtime.has(num)) continue; // transcripts are newest-first — first hit is the freshest
      if (transcriptMentionsItem(tail, num)) numToMtime.set(num, t.mtime);
    }
    if (numToMtime.size === nums.length) break;
  }
  const activity = {};
  for (const l of lanes) {
    const hit = l.num != null ? numToMtime.get(String(l.num)) : undefined;
    if (hit != null) activity[l.lane] = hit;
  }
  return activity;
}

/** The IO shell: gather every raw collector output, then compose the pure picture and emit it. */
function main(argv) {
  const flags = parseFlags(argv);
  const errors = [];
  const nowMs = Date.now();

  // 1. Build queue (ready + queued items, ranked) — READ-ONLY.
  const buildQueue = runJson('node', [BACKLOG_CLI, 'build-queue', '--json'], { errors, label: 'build-queue' });

  // 1b. Enrich the build-queue rows with each item's predicted `scope` (the `build-queue` view omits it) so the
  //     tick picture can flag UNSHAPED armed items — cleared-for-build rows with no predicted scope, which the
  //     dispatcher NEVER builds; the skill AUTO-PREPARES their scope instead (#2613 auto-prepare). Best-effort +
  //     guarded: a load failure leaves scope absent (every armed row then reads as unshaped — a SAFE over-surface:
  //     "prepare scope",
  //     never a false parallel claim) and is logged to stderr ONLY, NOT pushed to errors[] (a cosmetic enrichment
  //     miss must not flip the tick's health verdict to warn). Mirrors dispatch-plan.mjs's own scope enrichment.
  if (buildQueue && Array.isArray(buildQueue.queue) && buildQueue.queue.length) {
    try {
      const require = createRequire(import.meta.url);
      const loadBacklog = require(join(ROOT, 'src', '_data', 'backlog.js'));
      const items = typeof loadBacklog === 'function' ? loadBacklog() : [];
      const scopeByNum = new Map(items.map((it) => [String(it.num), it.scope]));
      buildQueue.queue = buildQueue.queue.map((r) => ({ ...r, scope: r?.scope ?? scopeByNum.get(String(r?.num)) ?? null }));
    } catch (e) {
      log(`  ⚠ could not load backlog for scope enrichment (${String(e.message || e).split('\n')[0]}) — armed items read as unshaped`);
    }
  }

  // 2. Lane pool status + the live scope-lease picture (leases / overlaps / breach).
  const poolArgs = ['status', '--json'];
  if (typeof flags.repo === 'string') poolArgs.push(`--repo=${flags.repo}`);
  if (typeof flags.name === 'string') poolArgs.push(`--name=${flags.name}`);
  const poolStatus = runJson('node', [LANE_POOL_CLI, ...poolArgs], { errors, label: 'lane-pool status' });
  // `--no-track-attempts` keeps this a PURE read (no breach-counter sidecar writes) — a state read must not mutate.
  const scopeArgs = ['--json', '--no-track-attempts'];
  if (typeof flags.repo === 'string') scopeArgs.push(`--repo=${flags.repo}`);
  if (typeof flags.name === 'string') scopeArgs.push(`--name=${flags.name}`);
  const scopePicture = runJson('node', [SCOPE_COLLECT_CLI, ...scopeArgs], { errors, label: 'scope-lease-collect' });

  // 3. In-flight lane PRs (this repo's open PRs).
  let prList;
  try {
    const out = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,state,statusCheckRollup,labels,headRefName'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    prList = JSON.parse(out || '[]');
  } catch (e) {
    errors.push(`gh pr list: ${String(e.message || e).split('\n')[0]}`);
    prList = [];
  }

  // 4. Drain daemon status (cross-repo, graceful degrade to `"unavailable"`).
  let daemonReport = null;
  const daemonCli = findDaemonCli();
  if (daemonCli) {
    // The daemon is explicitly best-effort + cross-repo, so a present-but-THROWING daemon must degrade IDENTICALLY
    // to an absent one: NO `errors` sink is passed here, so a failed read returns undefined → null → shapeDaemon
    // "unavailable", and a cross-repo daemon hiccup never flips the whole tick's health verdict to warn.
    daemonReport = runJson('node', [daemonCli, 'status', '--json'], { cwd: dirname(daemonCli), label: 'drain-daemon status' }) ?? null;
  }
  // A null report (absent CLI OR a failed/throwing read) shapes to "unavailable" — expected degradation, never an
  // `errors[]` row (the contract: the daemon section can vanish without warning the whole tick).

  // 5. Idle-clock inputs: queued.json for last queue-add (last merge comes from the daemon report).
  const queuedState = readJsonFile(QUEUED_PATH, { queued: [] });

  // 5b. The SESSION-LOCAL conveyor queue (#2613): the ids the operator cleared for build via
  //     `scripts/conveyor/queue.mjs` (the gitignored `.conveyor/queue.json` sidecar). This — NOT committed
  //     `buildQueued` frontmatter — is what arms a conveyor build, so the tick picture's `queue.buildQueued`
  //     reflects it (see shapeQueue). Read via the SAME resolver the dispatcher uses (script-location + env
  //     override) so the reader here can never diverge from the writer. A missing/corrupt sidecar degrades to [].
  const clearedNums = readQueueFile(resolveQueuePath()).map((e) => e.num);

  // 6. Lane → item map + the best-effort transcript activity scan for the health verdict.
  const laneItem = laneItemMap();
  const lanesForActivity = shapeLanes({ poolStatus, scopePicture, laneItem });
  const laneActivity = collectLaneActivity(lanesForActivity, nowMs);

  const picture = assembleConveyorState({
    buildQueue,
    poolStatus,
    scopePicture,
    prList,
    daemonReport,
    queuedState,
    laneItem,
    laneActivity,
    clearedNums,
    now: nowMs,
    errors,
  });

  // This script's whole reason to exist is the ONE JSON read, so it always emits the payload (a `--json`-less
  // human summary would just be the "eyeball four commands" this replaces). `--json` is accepted for call-site
  // symmetry with the sibling collectors but is not required.
  void flags.json;
  process.stdout.write(JSON.stringify(picture, null, 2) + '\n');
  process.exit(0);
}

// Main-module detection — run the IO shell only when invoked directly, never on import (keeps the pure core
// importable by the test with zero side effects).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
