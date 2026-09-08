#!/usr/bin/env node
/**
 * @file scripts/conveyor/ci-queue-watch.mjs
 * @description The GITHUB ACTIONS RUN-QUEUE WAIT-TIME cadence (WE #3574, epic #3383). A 2026-09-07
 *   investigation (this item's own card) found no current evidence that GitHub Actions runner concurrency is a
 *   binding constraint on this repo — but ALSO found nothing tracks it over time: a genuine queueing
 *   regression (e.g. a burst of concurrent dispatched lanes each triggering CI at once) would go unnoticed
 *   until someone manually re-samples `gh run list` by hand. This module makes that sampling a periodic,
 *   mechanical pass instead, mirroring `we:scripts/conveyor/branch-drift.mjs`'s pure-classify + thin gh-IO-shell
 *   shape (same file this card's own investigation named as the pattern to follow).
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors branch-drift.mjs #3464 and infra-blocked.mjs #2659): the PURE core
 *   ({@link waitSecondsOf}, {@link summarizeRuns}, {@link classifyQueueWait}, {@link parseHistory},
 *   {@link appendSample}, {@link serializeHistory}) has NO fs / gh / clock — every input is injected, so it is
 *   unit-tested directly against precomputed run lists and history arrays. The thin IO shell
 *   ({@link defaultListRuns}, the sidecar path/read/write helpers, {@link sweepCiQueue}, the CLI) owns every
 *   `gh`/fs call.
 *
 * WHERE THE HISTORY LIVES — the PRIMARY checkout's session sidecar (`.conveyor/ci-queue-history.json`),
 *   gitignored like the conveyor queue (#2613) and the infra-blocked store (#2659). Unlike branch-drift's git
 *   note (needed because that cadence can be swept from many different scratch checkouts), this cadence is
 *   piggybacked on the resident runner's OWN tick (`skills-src/conveyor/runner.mjs`) — one long-lived process
 *   on one checkout — so a local sidecar is the simpler fit and needs no git-notes push/fetch dance. The
 *   runner's own tick is the ONLY expected writer, but the card's own investigation names a real second one:
 *   an operator re-sampling `gh run list` by hand, right now, while the runner ticks the same sidecar — so the
 *   read-modify-write in {@link sweepCiQueue} is still serialized with a cheap advisory lock
 *   ({@link withHistoryLock}, mirrors `infra-blocked.mjs`'s `withInfraLock` shape) rather than assuming a single
 *   writer away; a genuinely single-writer sidecar could skip it, this one has a second one by design. The path
 *   resolves by SCRIPT LOCATION (never CWD), so writer and readers can't diverge; `CONVEYOR_CI_QUEUE_FILE`
 *   overrides it (tests + out-of-tree).
 *
 * SHAPE: a JSON ARRAY of samples, oldest first, bounded to `DEFAULT_MAX_HISTORY` entries (a ring buffer — old
 *   samples fall off the front once the cap is hit, so the file never grows unbounded across months of ticks).
 *   Each sample: `{ checkedAt, sampled, started, maxWaitSeconds, avgWaitSeconds, status, reason }`.
 *
 * THIS PASS IS PURELY INFORMATIVE — no dispatch gate reads it (unlike branch-drift's `blocked` verdict, which
 *   `dispatch-plan.mjs` holds dispatch on). The card asks only to make the trend VISIBLE, not to act on it; a
 *   gate can be layered on top of the persisted history later, once there is an actual trend to gate on.
 */

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, openSync, closeSync, statSync, unlinkSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
import { sleepSyncMs } from '../readiness/drain-lock.mjs';

// ── TUNING (exported so a caller/test can override) ─────────────────────────────────────────────────────────

/** How many recent runs `defaultListRuns` samples per sweep. Generous enough to catch a burst without a slow
 *  `gh` call — this repo's own investigation sampled 20 and found that plenty to judge "any queueing at all". */
export const DEFAULT_SAMPLE_LIMIT = 20;

/** Wait (seconds, `startedAt - createdAt`) past which a sweep reports `watch` — a real but modest queue, not
 *  yet a delivery problem. Env/flag overridable: `WE_CI_QUEUE_WATCH_SEC` / `--watch-sec=`. */
export const DEFAULT_WATCH_THRESHOLD_SEC = 60;
export const WATCH_THRESHOLD_ENV = 'WE_CI_QUEUE_WATCH_SEC';

/** Wait (seconds) past which a sweep reports `blocked` — sustained multi-minute queueing, the shape a runner
 *  concurrency ceiling being hit would actually produce. Env/flag overridable: `WE_CI_QUEUE_BLOCKED_SEC` /
 *  `--blocked-sec=`. */
export const DEFAULT_BLOCKED_THRESHOLD_SEC = 300;
export const BLOCKED_THRESHOLD_ENV = 'WE_CI_QUEUE_BLOCKED_SEC';

/** Ring-buffer cap on the persisted history — bounds the sidecar's size across months of ticks (see file
 *  header). Comfortably more than a day of 5-minute-cadence ticks. */
export const DEFAULT_MAX_HISTORY = 500;

// ── PURE CORE (no fs / gh / clock — every input is injected) ───────────────────────────────────────────────

/** The exact sentinel `gh run list --json startedAt` returns for a run that hasn't started yet — GitHub's zero
 *  `time.Time`, NOT an empty string. A truthy, `Date.parse`-able string that must still read as "unset", or a
 *  still-queued run reads as an instant (0s) start instead of excluded from the wait aggregate entirely (found
 *  by this item's own convergence red-team, mutation-confirmed against a real `gh run list` sample). */
export const GH_UNSTARTED_SENTINEL = '0001-01-01T00:00:00Z';

/**
 * The queue wait for one `gh run list` row, in seconds. PURE.
 * `startedAt` absent/empty/the GitHub zero-time sentinel ({@link GH_UNSTARTED_SENTINEL}) means the run is still
 * queued (not yet started) — returns `null` rather than 0, so {@link summarizeRuns} can tell "genuinely instant
 * start" (0) apart from "no data yet" (null) and exclude the latter from the wait aggregates instead of
 * dragging them toward zero.
 * @param {{createdAt?:string, startedAt?:string}} run
 * @returns {number|null}
 */
export function waitSecondsOf(run) {
  const startedAtRaw = run?.startedAt;
  if (!startedAtRaw || startedAtRaw === GH_UNSTARTED_SENTINEL) return null;
  const created = Date.parse(run?.createdAt);
  const started = Date.parse(startedAtRaw);
  if (!Number.isFinite(created) || !Number.isFinite(started)) return null;
  const deltaMs = started - created;
  // A clock skew / malformed pair reading NEGATIVE reads as 0 (the safe direction — never invent a queue that
  // isn't there), rather than propagating a negative number into an aggregate meant to only ever go up.
  return deltaMs > 0 ? deltaMs / 1000 : 0;
}

/**
 * Summarize a `gh run list` sample into the aggregate a sweep reports. PURE. Runs with no resolvable wait
 * (still queued, or malformed timestamps) count toward `sampled` but not `started`/the wait aggregates — an
 * all-queued sample must not silently read as "0s wait, all clear".
 * @param {Array<{createdAt?:string, startedAt?:string}>} runs
 * @returns {{sampled:number, started:number, maxWaitSeconds:number, avgWaitSeconds:number}}
 */
export function summarizeRuns(runs) {
  const list = Array.isArray(runs) ? runs : [];
  const waits = list.map(waitSecondsOf).filter((w) => w !== null);
  const maxWaitSeconds = waits.length ? Math.max(...waits) : 0;
  const avgWaitSeconds = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
  return { sampled: list.length, started: waits.length, maxWaitSeconds, avgWaitSeconds };
}

/**
 * The verdict for one sweep's aggregate. PURE, mirrors `classifyBranchDrift`'s ok/watch/blocked shape.
 * An EMPTY sample (`sampled === 0` — no runs to judge, e.g. a quiet repo) reads as `ok` with a distinct reason:
 * absence of data is not evidence of queueing, but it is also not the same "checked and it's fine" as a real
 * zero-wait sample, so a reader of the log can tell the two apart.
 *
 * A sample where NOTHING has started yet (`started === 0` but `sampled > 0`) is likewise never conflated with a
 * clean zero-wait sample. `maxWaitSeconds` computed from zero resolved waits is 0 by construction (there is no
 * wait DATA, not a wait of zero) — reading that as `ok` would misclassify the exact "a capacity crunch just
 * queued a burst of runs, none started yet" scenario this tool exists to surface as healthy. Reported as
 * `watch` instead: real signal (a real sample, genuinely nothing started), just not yet enough history to know
 * whether it is a transient blip or a live incident.
 * @param {{sampled?:number, started?:number, maxWaitSeconds?:number, watchThresholdSec?:number, blockedThresholdSec?:number}} input
 * @returns {{status:'ok'|'watch'|'blocked', reason:string}}
 */
export function classifyQueueWait({
  sampled = 0, started = 0, maxWaitSeconds = 0,
  watchThresholdSec = DEFAULT_WATCH_THRESHOLD_SEC, blockedThresholdSec = DEFAULT_BLOCKED_THRESHOLD_SEC,
} = {}) {
  if (!sampled) return { status: 'ok', reason: 'no runs sampled' };
  if (!started) return { status: 'watch', reason: `${sampled} run(s) sampled, none have started yet — no wait data to judge` };
  // `>= 0`, not `> 0` — an explicit 0 threshold ("flag everything") is a real, honored value, not the same as
  // "nothing was set"; only a negative/NaN/missing threshold falls back to the default (mirrors `numFlag`).
  const watchSec = Number.isFinite(watchThresholdSec) && watchThresholdSec >= 0 ? watchThresholdSec : DEFAULT_WATCH_THRESHOLD_SEC;
  const blockedSec = Number.isFinite(blockedThresholdSec) && blockedThresholdSec >= 0 ? blockedThresholdSec : DEFAULT_BLOCKED_THRESHOLD_SEC;
  const maxWait = Number(maxWaitSeconds) || 0;
  if (maxWait > blockedSec) {
    return { status: 'blocked', reason: `max wait ${Math.round(maxWait)}s past the ${blockedSec}s ceiling — sustained queueing` };
  }
  if (maxWait > watchSec) {
    return { status: 'watch', reason: `max wait ${Math.round(maxWait)}s past the ${watchSec}s watch line` };
  }
  return { status: 'ok', reason: `max wait ${Math.round(maxWait)}s` };
}

/** Tolerant parse of the sidecar text → a sample array. NEVER throws: empty/whitespace, bad JSON, or a
 *  non-array root all degrade to `[]` rather than breaking the reader (a corrupt sidecar must never wedge a
 *  tick). PURE. */
export function parseHistory(text) {
  if (!text || !String(text).trim()) return [];
  let raw;
  try { raw = JSON.parse(text); } catch { return []; }
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === 'object') : [];
}

/** Append one sample to the history, capping it to `maxEntries` (oldest dropped first — a ring buffer). PURE.
 * @param {Array<object>} history
 * @param {object} sample
 * @param {{maxEntries?:number}} [o]
 * @returns {Array<object>}
 */
export function appendSample(history, sample, { maxEntries = DEFAULT_MAX_HISTORY } = {}) {
  const next = [...(Array.isArray(history) ? history : []), sample];
  const cap = Number.isFinite(maxEntries) && maxEntries > 0 ? maxEntries : DEFAULT_MAX_HISTORY;
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Pretty-printed, newline-terminated — diffable by a human reading the sidecar directly. PURE. */
export function serializeHistory(history) {
  return `${JSON.stringify(Array.isArray(history) ? history : [], null, 2)}\n`;
}

// ── IO SHELL (gh / fs only past this point) ─────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
export const CI_QUEUE_ROOT = resolve(HERE, '..', '..');

/** The `gh run list` sample. `exec` is injectable so the argv is assertable with no `gh` on PATH.
 * @param {{exec?:Function, repo?:string|null, limit?:number}} [o]
 * @returns {Array<{databaseId:number, status:string, createdAt:string, startedAt:string}>}
 */
export function defaultListRuns({ exec = execFileSync, repo = null, limit = DEFAULT_SAMPLE_LIMIT } = {}) {
  const argv = ['run', 'list', '--limit', String(limit), '--json', 'databaseId,status,createdAt,startedAt'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/** The session sidecar path: `<root>/.conveyor/ci-queue-history.json`. */
export function ciQueueHistoryPath(root = CI_QUEUE_ROOT) {
  return join(root, '.conveyor', 'ci-queue-history.json');
}

/** The canonical sidecar path every consumer resolves to — `CONVEYOR_CI_QUEUE_FILE` override wins, else
 *  script-location (never CWD, so writer and readers can't diverge). */
export function resolveCiQueueHistoryPath() {
  const env = process.env.CONVEYOR_CI_QUEUE_FILE;
  return env && env.trim() ? env.trim() : ciQueueHistoryPath();
}

/** Read + parse the sidecar → the sample array (empty on a missing/corrupt file). */
export function readHistory(path = resolveCiQueueHistoryPath()) {
  if (!existsSync(path)) return [];
  try { return parseHistory(readFileSync(path, 'utf8')); }
  catch { return []; }
}

/** Write the history to the sidecar, ATOMICALLY (temp + rename), so a mid-write reader never sees partial JSON. */
export function writeHistory(history, path = resolveCiQueueHistoryPath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeHistory(history));
  renameSync(tmp, path);
}

/** How old a `<path>.lock` file may be before {@link withHistoryLock} treats it as abandoned (a crashed holder)
 *  and steals it, rather than waiting forever on a lock nothing will ever release. */
export const DEFAULT_HISTORY_LOCK_STALE_MS = 10_000;
/** How long {@link withHistoryLock} retries acquiring a FRESH (non-stale) lock before giving up and running
 *  `fn` unlocked anyway — a lock must never wedge a sweep. Independent of the staleness window: this is the
 *  ceiling on THIS caller's own patience, not on when a lock counts as abandoned. */
export const DEFAULT_HISTORY_LOCK_TIMEOUT_MS = 10_000;
/** Pause between failed acquire attempts — a real sleep (`sleepSyncMs`), never a hot busy-spin: contention here
 *  is brief (a fast in-memory read-modify-write), so this just avoids pegging a CPU core for however long a
 *  live holder takes, found by this item's own convergence red-team against the first, sleep-less cut. */
const HISTORY_LOCK_POLL_MS = 25;

/**
 * Run `fn` inside a cross-PROCESS advisory lock on `path`, so the read-modify-write in {@link sweepCiQueue} is
 * serialized. The resident runner's own tick is the common writer, but the card's own investigation names the
 * exact second writer this guards against: an operator manually running `sweep` by hand (to re-sample `gh run
 * list` right now) while the runner's tick is mid-write — an unserialized read→modify→write there can lose
 * whichever sample writes second, silently shrinking the very history this tool exists to grow (found by this
 * item's own convergence review). A `<path>.lock` exclusive-create file; a STALE lock (older than `staleMs` —
 * a crashed holder) is stolen; if a fresh lock can't be taken within `timeoutMs`, `fn` still runs UNLOCKED
 * (best-effort — a lock must never wedge a sweep; worst case is the pre-lock last-write-wins). `staleMs` /
 * `timeoutMs` are overridable (tests only need a few ms, not the real multi-second defaults).
 * @template T
 * @param {string} path
 * @param {() => T} fn
 * @param {{staleMs?:number, timeoutMs?:number}} [o]
 * @returns {T}
 */
export function withHistoryLock(path, fn, { staleMs = DEFAULT_HISTORY_LOCK_STALE_MS, timeoutMs = DEFAULT_HISTORY_LOCK_TIMEOUT_MS } = {}) {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true });
  const start = Date.now();
  let held = false;
  while (Date.now() - start < timeoutMs) {
    try {
      closeSync(openSync(lockPath, 'wx')); // atomic exclusive create — fails if a holder exists
      held = true;
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) unlinkSync(lockPath); // steal a stale lock
      } catch { /* raced another stealer, or the holder just released it — either way, retry */ }
      sleepSyncMs(Math.min(HISTORY_LOCK_POLL_MS, Math.max(0, timeoutMs - (Date.now() - start))));
    }
  }
  try {
    return fn();
  } finally {
    if (held) { try { unlinkSync(lockPath); } catch { /* best-effort cleanup */ } }
  }
}

/**
 * THE IO SHELL. Samples `gh run list`, summarizes + classifies it, appends the result to the persisted
 * history, and returns the fresh sample (with the write outcome folded in). Never throws on a persistence
 * failure — a sweep that sampled fine but couldn't write the sidecar still reports what it found.
 * @param {{repo?:string|null, limit?:number, listRuns?:Function, historyPath?:string, now?:()=>string,
 *   watchThresholdSec?:number, blockedThresholdSec?:number, maxEntries?:number, persist?:boolean}} [o]
 * @returns {{checkedAt:string, sampled:number, started:number, maxWaitSeconds:number, avgWaitSeconds:number,
 *   status:string, reason:string, persisted:boolean}}
 */
export function sweepCiQueue({
  repo = null, limit = DEFAULT_SAMPLE_LIMIT, listRuns = defaultListRuns,
  historyPath = resolveCiQueueHistoryPath(), now = () => new Date().toISOString(),
  watchThresholdSec = DEFAULT_WATCH_THRESHOLD_SEC, blockedThresholdSec = DEFAULT_BLOCKED_THRESHOLD_SEC,
  maxEntries = DEFAULT_MAX_HISTORY, persist = true,
} = {}) {
  const runs = listRuns({ repo, limit });
  const agg = summarizeRuns(runs);
  const verdict = classifyQueueWait({ ...agg, watchThresholdSec, blockedThresholdSec });
  const sample = { checkedAt: now(), ...agg, ...verdict };
  let persisted = false;
  if (persist) {
    try {
      withHistoryLock(historyPath, () => writeHistory(appendSample(readHistory(historyPath), sample, { maxEntries }), historyPath));
      persisted = true;
    } catch { /* best-effort — a sweep that sampled fine still reports even if the sidecar write failed */ }
  }
  return { ...sample, persisted };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────

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

/** `n >= 0`, not `n > 0` — an explicit `0` (e.g. `--watch-sec=0`) is a real, honored override, never silently
 *  discarded back to the default the way a negative/NaN/missing value correctly is (found by this item's own
 *  convergence review: the original `n > 0` guard treated an explicit zero identically to "nothing set"). */
function numFlag(flags, name, envName, fallback) {
  // `parseFlags` sets a bare `--name` (no `=value`) to the BOOLEAN `true`, and `Number(true) === 1` — a
  // malformed/valueless flag must never silently read as the number 1 (found by this item's own convergence
  // red-team), so a boolean raw value is treated the same as absent.
  const raw = flags[name] ?? (envName ? process.env[envName] : undefined);
  const n = typeof raw === 'boolean' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function main(argv) {
  const [verbRaw, ...rest] = argv;
  const verb = verbRaw && !verbRaw.startsWith('--') ? verbRaw : 'sweep';
  const flags = parseFlags(verbRaw && !verbRaw.startsWith('--') ? rest : argv);
  const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : null;
  const asJson = !!flags.json;
  const historyPath = resolveCiQueueHistoryPath();

  if (verb === 'check') {
    const history = readHistory(historyPath);
    const latest = history.length ? history[history.length - 1] : { status: 'unknown', reason: 'no sample yet' };
    if (asJson) writeAllSync(1, `${JSON.stringify({ ...latest, samples: history.length })}\n`);
    else writeLineSync(2, `ci-queue-watch check: ${latest.status}${latest.reason ? ` (${latest.reason})` : ''} — ${history.length} sample(s) on file`);
    process.exitCode = 0;
    return;
  }

  if (verb !== 'sweep') {
    writeLineSync(2, 'usage: ci-queue-watch.mjs [sweep|check] [--repo=<owner/name>] [--limit=<n>] [--json]');
    process.exitCode = 2;
    return;
  }

  const limit = numFlag(flags, 'limit', null, DEFAULT_SAMPLE_LIMIT);
  const watchThresholdSec = numFlag(flags, 'watch-sec', WATCH_THRESHOLD_ENV, DEFAULT_WATCH_THRESHOLD_SEC);
  const blockedThresholdSec = numFlag(flags, 'blocked-sec', BLOCKED_THRESHOLD_ENV, DEFAULT_BLOCKED_THRESHOLD_SEC);
  const result = sweepCiQueue({ repo, limit, historyPath, watchThresholdSec, blockedThresholdSec });

  if (asJson) writeAllSync(1, `${JSON.stringify(result)}\n`);
  else {
    writeLineSync(
      2,
      `ci-queue-watch sweep: ${result.status} — ${result.started}/${result.sampled} run(s) started, ` +
        `max wait ${Math.round(result.maxWaitSeconds)}s, avg ${Math.round(result.avgWaitSeconds)}s` +
        `${result.persisted ? '' : ' [history not persisted]'}`,
    );
    if (result.reason) writeLineSync(2, `  ${result.reason}`);
  }
  process.exitCode = 0;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => {
    writeLineSync(2, `✗ ci-queue-watch error: ${String((e && e.stack) || e)}`);
    process.exit(1);
  });
}
