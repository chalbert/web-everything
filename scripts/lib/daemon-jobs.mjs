/**
 * @file scripts/lib/daemon-jobs.mjs
 * @description #4125 (epic #4075, statute `#daemon-jobs`, decision #4120) — THE DAEMON JOB MODEL, pure core.
 *
 * WHAT A JOB IS. A slow daemon action run as a DETACHED child process with a durable record, so the daemon's
 * tick only starts jobs and reads records and never waits on one. Ruling 4120 Fork 1 (a): a job is a
 * RUN-STORE RECORD KIND — an ordinary run record (`we:scripts/operations/run-record.mjs`) whose `op` is
 * `job:<kind>` and which carries a `job` block, validated here and called from `validateRunRecord`. The card's
 * field list maps onto it as: `id` → the run id, `input` → the run's `input`, and everything else
 * (`kind, pid, host, startedAt, heartbeatAt, checkpoint, status, codeSha, attempts`) lives in `job`.
 *
 * THE HANDLE is `host:pid:procStart` (ruling clause "Handle"); a bare pid is never a handle, because pids are
 * reused. Liveness = the pid exists on THIS host AND its start time still matches the recorded one — a live
 * pid with a different start time is a different process ({@link judgeHandle} answers `reused`, and reused
 * reads as dead, never as our job).
 *
 * REATTACH ({@link decideReattach}), run by every daemon at boot and on every tick:
 *   - live handle, fresh heartbeat → leave it alone;
 *   - live handle, STALE heartbeat → stalled: SIGTERM, then SIGKILL, confirm gone, then relaunch;
 *   - dead handle → resume from the last applied step (the record's `checkpoint`) — up to
 *     {@link DEFAULT_MAX_ATTEMPTS} launches with {@link backoffMs} between them, then fail VISIBLY.
 * A relaunch never spawns inline: it requeues the job with a `nextAttemptAt`, and admission
 * ({@link planAdmissions}) starts it under the same caps as a first launch.
 *
 * SLEEP (ratify red-team finding 2). A laptop that slept for an hour wakes with every heartbeat an hour old,
 * and a naive staleness check would kill every job it owns. {@link detectSleep} names the detection: the
 * tick's WALL-clock gap against its MONOTONIC-clock gap (the monotonic clock does not advance while the host
 * sleeps — `mach_absolute_time` on macOS, `CLOCK_MONOTONIC` on Linux). When wall − monotonic exceeds
 * {@link SLEEP_GAP_THRESHOLD_MS} the rule fires: that tick skips the staleness check, and heartbeat age is
 * measured from the wake from then on, so a job gets one full stale window after the wake to beat again. It
 * never suppresses the DEAD check — a dead pid is dead whether or not the host slept. A daemon's boot counts
 * as a wake for the same reason (it cannot know how long it was gone).
 *
 * CAPS ({@link planAdmissions}): a per-daemon concurrency cap, an optional per-kind cap, and one SERIAL LANE
 * shared by every single-writer kind (`serial: true`) — at most one serial job runs at a time.
 *
 * SNAPSHOT STORES (ratify red-team finding 3): a readonly-tree job's `node_modules` store is keyed by the
 * lockfile hash, not the code sha, and a store no live job references is evicted, keeping at most
 * {@link STORE_KEEP} ({@link planStoreEviction}).
 *
 * PURE. No fs, no clock, no process, no randomness — the IO shell is `./daemon-jobs-io.mjs`.
 */

/** Job lifecycle. `errored` = the child reported a throw and exited (retried like a dead handle). */
export const JOB_STATUSES = Object.freeze(['queued', 'launching', 'running', 'succeeded', 'errored', 'failed']);
export const TERMINAL_JOB_STATUSES = Object.freeze(['succeeded', 'failed']);
/** Statuses that occupy a concurrency slot. */
export const ACTIVE_JOB_STATUSES = Object.freeze(['launching', 'running']);

/** Ruling 4120 Fork 2 (c): the code version a kind runs. */
export const CODE_MODES = Object.freeze(['readonly-tree', 'mutates-tree']);

/** "Up to 3 attempts with backoff, then fail visibly." */
export const DEFAULT_MAX_ATTEMPTS = 3;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 10 * 60_000;
/** A heartbeat older than this on a live handle means stalled. The runner beats every {@link DEFAULT_HEARTBEAT_MS}. */
export const DEFAULT_STALE_MS = 120_000;
export const DEFAULT_HEARTBEAT_MS = 10_000;
/** How long a `launching` record may sit with no handle before the launch is presumed lost. */
export const DEFAULT_LAUNCH_GRACE_MS = 30_000;
/** Sleep detection threshold: wall-clock gap minus monotonic gap across one tick. Well above scheduler and
 *  GC jitter (milliseconds), well below any real sleep worth reacting to. */
export const SLEEP_GAP_THRESHOLD_MS = 30_000;
/** At most this many node_modules stores (and code snapshots) kept once no live job references them. */
export const STORE_KEEP = 2;
/** Timeline entries kept per record — enough to show every attempt of a capped job, never unbounded. */
export const TIMELINE_MAX = 50;

const JOB_KIND_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HOST_RE = /^[^:\s]+$/;

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function isIso(v) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}
function msOf(iso) {
  return isIso(iso) ? Date.parse(iso) : null;
}

/** Is `kind` a usable job kind name? Kinds end up in op names and log lines, so the set is closed. */
export function isValidJobKind(kind) {
  return typeof kind === 'string' && JOB_KIND_RE.test(kind);
}

// ── HANDLE ────────────────────────────────────────────────────────────────────────────────────────────────────

/** `ps -o lstart=` pads with spaces; collapse them so two reads of the same process compare equal. */
export function normalizeProcStart(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

/**
 * `host:pid:procStart`. Refuses a partial handle — a handle missing its start time is a bare pid in disguise.
 * @param {{host:string, pid:number, procStart:string}} h
 */
export function formatHandle({ host, pid, procStart } = {}) {
  const start = normalizeProcStart(procStart);
  if (typeof host !== 'string' || !HOST_RE.test(host)) throw new TypeError(`daemon-jobs: invalid handle host ${JSON.stringify(host)}`);
  if (!Number.isInteger(pid) || pid <= 0) throw new TypeError(`daemon-jobs: invalid handle pid ${JSON.stringify(pid)}`);
  if (!start) throw new TypeError('daemon-jobs: a handle needs the process start time — a bare pid is never a handle');
  return `${host}:${pid}:${start}`;
}

/**
 * Parse a handle. The start time itself contains colons (`Mon Sep 28 11:02:12 2026`), so only the first two
 * separate fields. Returns null for anything that is not a full handle — including a bare pid.
 * @returns {{host:string, pid:number, procStart:string}|null}
 */
export function parseHandle(handle) {
  if (typeof handle !== 'string') return null;
  const a = handle.indexOf(':');
  if (a <= 0) return null;
  const b = handle.indexOf(':', a + 1);
  if (b === -1) return null;
  const host = handle.slice(0, a);
  const pidText = handle.slice(a + 1, b);
  const procStart = normalizeProcStart(handle.slice(b + 1));
  if (!HOST_RE.test(host) || !/^[1-9][0-9]*$/.test(pidText) || !procStart) return null;
  return { host, pid: Number(pidText), procStart };
}

/**
 * Judge a handle against what the host says about its pid right now.
 * @param {string} handle
 * @param {{host:string, procStart:(string|null|undefined)}} probe - `procStart` null ⇒ no such pid;
 *   undefined ⇒ the probe itself failed (ps missing, permission) and nothing can be concluded.
 * @returns {'alive'|'dead'|'reused'|'foreign'|'unknown'|'invalid'}
 */
export function judgeHandle(handle, { host, procStart } = {}) {
  const h = parseHandle(handle);
  if (!h) return 'invalid';
  if (h.host !== host) return 'foreign';
  if (procStart === undefined) return 'unknown';
  if (procStart === null || !normalizeProcStart(procStart)) return 'dead';
  return normalizeProcStart(procStart) === h.procStart ? 'alive' : 'reused';
}

// ── RECORD ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The op name of a job record — how a reader tells a job from any other run. */
export function jobOpName(kind) {
  return `job:${kind}`;
}

/** Is this run record a job? */
export function isJobRecord(record) {
  return isPlainObject(record) && isPlainObject(record.job);
}

/**
 * Validate a run record's `job` block. Called by `validateRunRecord` when the block is present, so a torn or
 * hand-edited job record is refused by the same reader every run record goes through.
 * @returns {string[]} errors (empty when valid)
 */
export function validateJobBlock(job, op) {
  const errors = [];
  if (!isPlainObject(job)) return ['`job` must be an object when present'];
  if (!isValidJobKind(job.kind)) errors.push(`job.kind ${JSON.stringify(job.kind)} is not a valid kind`);
  else if (op !== undefined && op !== jobOpName(job.kind)) errors.push(`a job record's op must be ${JSON.stringify(jobOpName(job.kind))}`);
  if (typeof job.daemon !== 'string' || !job.daemon) errors.push('job.daemon must name the owning daemon');
  if (!CODE_MODES.includes(job.codeMode)) errors.push(`job.codeMode must be one of ${CODE_MODES.join('|')}`);
  if (typeof job.module !== 'string' || !job.module || job.module.startsWith('/') || job.module.split('/').includes('..')) {
    errors.push('job.module must be a repo-relative module path');
  }
  if (!JOB_STATUSES.includes(job.status)) errors.push(`job.status ${JSON.stringify(job.status)}; expected one of ${JOB_STATUSES.join('|')}`);
  if (!Number.isInteger(job.attempts) || job.attempts < 0) errors.push('job.attempts must be a non-negative integer');
  if (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 1) errors.push('job.maxAttempts must be a positive integer');
  if (job.codeSha !== null && !(typeof job.codeSha === 'string' && /^[0-9a-f]{7,64}$/.test(job.codeSha))) {
    errors.push('job.codeSha must be a hex sha or null');
  }
  if (job.handle !== null && !parseHandle(job.handle)) errors.push(`job.handle ${JSON.stringify(job.handle)} is not host:pid:procStart`);
  if (job.status === 'running' && job.handle === null) {
    errors.push('a running job must carry its handle');
  }
  for (const k of ['createdAt', 'launchedAt', 'startedAt', 'heartbeatAt', 'finishedAt', 'nextAttemptAt']) {
    if (job[k] !== null && job[k] !== undefined && !isIso(job[k])) errors.push(`job.${k} is not a parseable timestamp`);
  }
  if (!isIso(job.createdAt)) errors.push('job.createdAt is required');
  if (!Array.isArray(job.timeline)) errors.push('job.timeline must be an array');
  else job.timeline.forEach((t, i) => {
    if (!isPlainObject(t) || !isIso(t.at) || typeof t.event !== 'string') errors.push(`job.timeline[${i}] needs {at, event}`);
  });
  return errors;
}

/**
 * A fresh, queued job record — a full run record, so the run store writes it unchanged.
 * @param {{id:string, kind:string, daemon:string, module:string, codeMode:string, codeSha?:string|null,
 *   input?:object, maxAttempts?:number, now:string}} spec
 */
export function newJobRecord({ id, kind, daemon, module, codeMode, codeSha = null, input = {}, maxAttempts = DEFAULT_MAX_ATTEMPTS, now }) {
  const record = {
    v: 1,
    id,
    op: jobOpName(kind),
    input: { ...input },
    cursor: 0,
    findings: {},
    verdict: null,
    effects: [],
    telemetry: [],
    stepTimings: [],
    pending: null,
    job: {
      kind, daemon, module, codeMode, codeSha,
      status: 'queued',
      attempts: 0,
      maxAttempts,
      handle: null,
      host: null,
      pid: null,
      createdAt: now,
      launchedAt: null,
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
      nextAttemptAt: null,
      checkpoint: null,
      result: null,
      lastError: null,
      workdir: null,
      storeKey: null,
      timeline: [{ at: now, event: 'queued' }],
    },
  };
  const errors = validateJobBlock(record.job, record.op);
  if (errors.length) throw new TypeError(`daemon-jobs: invalid new job — ${errors.join('; ')}`);
  return record;
}

/** Return a copy of `record` with `patch` merged into its job block and `event` appended to the timeline. */
export function withJob(record, patch = {}, event = null) {
  const job = { ...record.job, ...patch };
  if (event) job.timeline = [...record.job.timeline, event].slice(-TIMELINE_MAX);
  return { ...record, job };
}

export function isTerminalJob(record) {
  return isJobRecord(record) && TERMINAL_JOB_STATUSES.includes(record.job.status);
}

/** Exponential backoff before relaunch number `attempts + 1`: 30s, 60s, 120s … capped. */
export function backoffMs(attempts, { baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS } = {}) {
  const n = Math.max(1, Number.isInteger(attempts) ? attempts : 1);
  return Math.min(maxMs, baseMs * 2 ** (n - 1));
}

// ── SLEEP DETECTION ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Did the host sleep between two ticks? Compares the wall-clock gap with the monotonic-clock gap.
 * @param {{wallMs:number, monoMs:number}|null} prev - the previous tick's clocks (null at boot)
 * @param {{wallMs:number, monoMs:number}} cur
 * @returns {{fired:boolean, wallGapMs:number|null, monoGapMs:number|null, sleptMs:number}}
 */
export function detectSleep(prev, cur, { thresholdMs = SLEEP_GAP_THRESHOLD_MS } = {}) {
  if (!prev) return { fired: false, wallGapMs: null, monoGapMs: null, sleptMs: 0 };
  const wallGapMs = cur.wallMs - prev.wallMs;
  const monoGapMs = cur.monoMs - prev.monoMs;
  const sleptMs = wallGapMs - monoGapMs;
  return { fired: sleptMs > thresholdMs, wallGapMs, monoGapMs, sleptMs };
}

// ── REATTACH ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What to do about one job record this tick. PURE — the caller has probed the handle already.
 *
 * @param {object} record
 * @param {{nowMs:number, verdict?:string, skipStaleness?:boolean, wakeAtMs?:number|null,
 *   staleMs?:number, launchGraceMs?:number, backoffBaseMs?:number}} ctx
 * @returns {{action:'none'|'wait'|'leave'|'kill-stalled'|'requeue'|'fail', reason:string, nextAttemptAt?:number}}
 *   `requeue`/`fail` are what to do with a job whose last attempt is over; `kill-stalled` is followed by the
 *   same retry decision once the process is confirmed gone ({@link decideRetry}).
 */
export function decideReattach(record, {
  nowMs, verdict = 'unknown', skipStaleness = false, wakeAtMs = null,
  staleMs = DEFAULT_STALE_MS, launchGraceMs = DEFAULT_LAUNCH_GRACE_MS, backoffBaseMs = BACKOFF_BASE_MS,
} = {}) {
  const job = record.job;
  const retry = (reason) => decideRetry(record, { nowMs, reason, backoffBaseMs });
  if (TERMINAL_JOB_STATUSES.includes(job.status)) return { action: 'none', reason: job.status };
  if (job.status === 'queued') return { action: 'none', reason: 'queued' };
  if (job.status === 'errored') return retry(`errored: ${job.lastError ?? 'no detail'}`);

  // launching / running
  if (job.handle === null) {
    const launched = msOf(job.launchedAt) ?? 0;
    if (nowMs - launched < launchGraceMs) return { action: 'wait', reason: 'launch in progress' };
    return retry('launch lost: no handle within the launch grace');
  }
  if (verdict === 'foreign') return { action: 'none', reason: 'handle belongs to another host' };
  if (verdict === 'unknown' || verdict === 'invalid') return { action: 'none', reason: `cannot judge handle (${verdict}) — never kill on doubt` };
  if (verdict === 'dead' || verdict === 'reused') {
    return retry(verdict === 'reused' ? 'handle dead (pid reused by another process)' : 'handle dead');
  }
  // alive
  if (skipStaleness) return { action: 'leave', reason: 'alive; staleness skipped (sleep detected)' };
  const beat = Math.max(msOf(job.heartbeatAt) ?? msOf(job.startedAt) ?? msOf(job.launchedAt) ?? 0, wakeAtMs ?? 0);
  const ageMs = nowMs - beat;
  if (ageMs > staleMs) return { action: 'kill-stalled', reason: `stalled: heartbeat ${Math.round(ageMs / 1000)}s old` };
  return { action: 'leave', reason: 'alive' };
}

/** A job's attempt is over (dead, errored, lost, or killed as stalled): retry within the cap, else fail. */
export function decideRetry(record, { nowMs, reason, backoffBaseMs = BACKOFF_BASE_MS }) {
  const job = record.job;
  if (job.attempts >= job.maxAttempts) {
    return { action: 'fail', reason: `${reason}; ${job.attempts}/${job.maxAttempts} attempts used` };
  }
  return { action: 'requeue', reason, nextAttemptAt: nowMs + backoffMs(job.attempts, { baseMs: backoffBaseMs }) };
}

// ── CAPS / ADMISSION ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which queued jobs to launch now. FIFO by due time then creation; a job is admitted only when the daemon cap,
 * its kind's cap, and (for a serial kind) the serial lane all have room.
 *
 * @param {object[]} records - every job record of this daemon
 * @param {{kinds:Object<string,{serial?:boolean, maxConcurrent?:number}>, maxConcurrent:number, nowMs:number}} o
 * @returns {{launch:string[], unknownKind:string[], deferred:{id:string, reason:string}[]}}
 */
export function planAdmissions(records, { kinds, maxConcurrent, nowMs }) {
  const jobs = records.filter(isJobRecord);
  const active = jobs.filter((r) => ACTIVE_JOB_STATUSES.includes(r.job.status));
  let total = active.length;
  const perKind = new Map();
  let serialBusy = false;
  for (const r of active) {
    perKind.set(r.job.kind, (perKind.get(r.job.kind) ?? 0) + 1);
    if (kinds[r.job.kind]?.serial) serialBusy = true;
  }
  const due = jobs
    .filter((r) => r.job.status === 'queued' && (msOf(r.job.nextAttemptAt) ?? 0) <= nowMs)
    .sort((a, b) => ((msOf(a.job.nextAttemptAt) ?? msOf(a.job.createdAt)) - (msOf(b.job.nextAttemptAt) ?? msOf(b.job.createdAt)))
      || a.job.createdAt.localeCompare(b.job.createdAt) || a.id.localeCompare(b.id));
  const launch = [];
  const unknownKind = [];
  const deferred = [];
  for (const r of due) {
    const spec = kinds[r.job.kind];
    if (!spec) { unknownKind.push(r.id); continue; }
    if (total >= maxConcurrent) { deferred.push({ id: r.id, reason: 'daemon cap' }); continue; }
    if (spec.serial && serialBusy) { deferred.push({ id: r.id, reason: 'serial lane busy' }); continue; }
    const kindCap = Number.isInteger(spec.maxConcurrent) ? spec.maxConcurrent : Infinity;
    if ((perKind.get(r.job.kind) ?? 0) >= kindCap) { deferred.push({ id: r.id, reason: 'kind cap' }); continue; }
    launch.push(r.id);
    total += 1;
    perKind.set(r.job.kind, (perKind.get(r.job.kind) ?? 0) + 1);
    if (spec.serial) serialBusy = true;
  }
  return { launch, unknownKind, deferred };
}

// ── STORE EVICTION ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which snapshot stores to evict. A store a live (non-terminal) job references is always kept; the rest are
 * evicted newest-last until at most `keep` stores remain in total.
 * @param {{key:string, mtimeMs:number}[]} stores
 * @param {Iterable<string>} referenced
 * @returns {{keep:string[], evict:string[]}}
 */
export function planStoreEviction(stores, referenced, { keep = STORE_KEEP } = {}) {
  const ref = new Set(referenced);
  const kept = stores.filter((s) => ref.has(s.key)).map((s) => s.key);
  const evict = [];
  const free = stores.filter((s) => !ref.has(s.key)).sort((a, b) => b.mtimeMs - a.mtimeMs || a.key.localeCompare(b.key));
  for (const s of free) {
    if (kept.length < keep) kept.push(s.key);
    else evict.push(s.key);
  }
  return { keep: kept, evict };
}

/** The store keys (and snapshot keys) live jobs still point at. */
export function referencedStores(records) {
  const storeKeys = new Set();
  const snapshotKeys = new Set();
  for (const r of records) {
    if (!isJobRecord(r) || TERMINAL_JOB_STATUSES.includes(r.job.status)) continue;
    if (r.job.storeKey) storeKeys.add(r.job.storeKey);
    if (r.job.codeMode === 'readonly-tree' && r.job.codeSha) snapshotKeys.add(r.job.codeSha);
  }
  return { storeKeys, snapshotKeys };
}
