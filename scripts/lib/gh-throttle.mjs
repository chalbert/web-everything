#!/usr/bin/env node
/**
 * @file scripts/lib/gh-throttle.mjs
 * @description A TRANSPARENT local queue/throttle for `gh` CLI calls (we:backlog/3621's "Amendment (2026-09-08,
 *   later same day)", Idea 1) — built to stop the real, live incident it names: many concurrent dispatched
 *   agents plus the conveyor runner independently calling `gh` tripped GitHub's SECONDARY (burst) rate limit
 *   tonight (100 concurrent requests / 900 REST points-per-min / 2000 GraphQL points-per-min, a SHARED,
 *   per-account ceiling — confirmed separate from and NOT reflected in the primary 5,000/hr `core`/`graphql`
 *   quota: `gh api rate_limit` showed 0 used there while calls were actively failing). Grepping this repo that
 *   night found 84 files invoking `gh` via a subprocess call with no shared gate at all.
 *
 * SCOPE, STATED PLAINLY (do not read this as "the 84 sites are migrated"): this module builds and proves the
 * WRAPPER only. It is wired into a handful of the conveyor runner's own highest-volume `gh`-calling paths (see
 * the wiring note at the bottom of this file) as the first real adopter — proof the mechanism works under real
 * concurrent load, not a full migration. Migrating the remaining call sites is separate, larger follow-up work
 * (filed; see the item this module's own PR body links).
 *
 * MECHANISM — MIRRORS `we:scripts/readiness/heavy-admission.mjs` (#3461/#3456) RATHER THAN REIMPLEMENTING IT.
 * That module already built a cross-process-safe counting semaphore on top of `file-locks.mjs`'s atomic
 * mkdir/O_EXCL primitives (the exact "single managed chokepoint... gating/serializing them" pattern #3621's
 * amendment names as the model to follow) — round-robin over `cap` independent single-holder locks, a
 * heartbeat-TTL lease as the correctness floor, and a same-machine PID-liveness fast path layered on top so a
 * crashed holder never strands the cap for the full TTL. This module does NOT re-derive any of that: it calls
 * `heavy-admission.mjs`'s own `tryAcquireSlot` / `releaseOwnedSlot` against a SEPARATE lock root
 * (`.admission/gh`, a sibling of `.admission/heavy`) with its OWN cap, so `gh`-call concurrency and
 * heavy-command concurrency are two independent pools sharing one proven mechanism, not two copies of it. A
 * second implementation of that policy would be exactly what #2607 forbids (heavy-admission.mjs's own header).
 *
 * THE CAP IS DELIBERATELY WELL UNDER GitHub's 100-concurrent secondary ceiling (`DEFAULT_GH_CONCURRENCY_CAP`,
 * overridable via `WE_GH_THROTTLE_CAP`) — conservative by the same design principle heavy-admission.mjs states
 * for its own cap (below measured/documented capacity, never near-full-utilization), leaving headroom for
 * whatever else on the host also calls `gh` outside this wrapper (the 84 not-yet-migrated sites).
 *
 * BACKOFF/RETRY ON A RATE-LIMIT-SHAPED FAILURE — reuses, rather than re-guesses, this repo's own ALREADY
 * incident-grounded classifier: `we:scripts/conveyor/infra-blocked.mjs#classifyPrOpenFailure` (built for the
 * 2026-07-24 GitHub outage / #3573's rate-limit research) already matches `/\b(rate limit|secondary rate|abuse
 * detection|api rate)\b/` against `gh` stderr — the real phrasing GitHub's API returns for both its primary
 * ("API rate limit exceeded…") and secondary ("You have exceeded a secondary rate limit…"/"…abuse detection
 * mechanism…") limits, both served as HTTP 403 or 429, sometimes carrying a `Retry-After` header (confirmed
 * against GitHub's own rate-limit documentation, 2026-09; exact wording not independently re-triggered here —
 * doing so on purpose would itself be an abusive load test against a live account, which is the failure mode
 * this module exists to prevent). {@link isRateLimitShaped} is a thin, exported alias over that same classifier
 * so this module and `infra-blocked.mjs` can never drift into two different opinions about what "rate limited"
 * means. On a match, {@link runGhSync} releases its semaphore slot (so a slow backoff never idles a scarce
 * concurrency slot other callers could use), sleeps a BOUNDED exponential backoff ({@link retryBackoffMs},
 * shaped like `infra-blocked.mjs`'s own `backoffMs` — doubling, capped, never instant and never unbounded),
 * re-acquires, and retries — up to `DEFAULT_RETRY_MAX_ATTEMPTS` (`WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS`) total
 * attempts, after which the LAST real failure is re-thrown unchanged (never a synthetic error) — so a
 * genuinely exhausted retry looks, to the caller, exactly like an ordinary failed `gh` invocation.
 *
 * TWO TRANSPARENT INTEGRATION SHAPES, per #3621's ask that existing 84 callers be able to adopt this WITHOUT
 * their own call-site logic changing:
 *
 *   1. {@link runGhSync} — an IMPORTABLE, drop-in replacement for `execFileSync('gh', args, opts)`. Same
 *      signature shape (`(args, opts)`), same success return (whatever `execFileSync` would return — a
 *      string/Buffer of stdout, per `opts.encoding`), same THROWN error shape on failure (`error.status`,
 *      `error.stdout`, `error.stderr`, `error.message` — because on the non-retried path it delegates straight
 *      to a real `execFileSync('gh', args, opts)` call with `opts` passed through UNCHANGED, aside from an
 *      optional, separately-namespaced `opts.throttle` bag this module reads and strips before the real
 *      call — so it can never collide with a genuine `execFileSync` option). Wired as `createGhProvider`'s
 *      default `exec` in `we:scripts/lib/review-label-provider.mjs` and as `ci-queue-watch.mjs#defaultListRuns`'s
 *      default `exec` (see the wiring note below) — a caller using either seam gets the throttle for free with
 *      no call-site change at all.
 *   2. The CLI (`node scripts/lib/gh-throttle.mjs <same argv gh would take>`) — a full PROCESS-level
 *      transparent pass-through: same stdout bytes, same stderr bytes, same exit code, same stdin behavior
 *      (`stdio[0]` is `inherit`, so a caller piping input to `gh` sees it reach the real `gh` unchanged) as
 *      invoking the real `gh` binary directly. Internally this uses `child_process.spawnSync` (not
 *      `execFileSync`) specifically because `execFileSync` silently discards a SUCCESSFUL call's stderr
 *      (Node's own documented behavior — it returns only stdout on success), which would break byte-for-byte
 *      parity for any `gh` invocation that writes a warning to stderr while still exiting 0; `spawnSync`
 *      surfaces both streams unconditionally, on success or failure alike, which is what full-process
 *      transparency and the retry classifier both need. A caller that currently shells
 *      `execFileSync('gh', args, opts)` can swap to `execFileSync('node', ['scripts/lib/gh-throttle.mjs',
 *      ...args], opts)` with no other change — the retry loop lives entirely inside the child, so the parent's
 *      own call stays fully synchronous either way.
 *
 * KNOWN, STATED LIMITATION (not a silent gap): a retry re-spawns `gh` from scratch, so an invocation whose
 * `stdin` is a single-read, non-seekable pipe (rare for `gh` — almost every mutating call takes a
 * `--body-file`/`--*-file` flag instead, the same reason `we:scripts/lib/review-label-provider.mjs` posts
 * comments via a temp file rather than piped stdin) will NOT see the same stdin bytes on a second attempt. This
 * mirrors an inherent limit of retrying any subprocess call with piped input; it is not special to this module.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

import { tryAcquireSlot, releaseOwnedSlot, admissionStatus, ADMISSION_LEASE_MINUTES } from '../readiness/heavy-admission.mjs';
import { defaultPoolRoot } from './lane-pool-paths.mjs';
import { sleepSyncMs } from '../readiness/drain-lock.mjs';
import { classifyPrOpenFailure } from '../conveyor/infra-blocked.mjs';
import { writeAllSync } from './write-all-sync.mjs';

// ── TUNING (env-overridable, mirroring heavy-admission.mjs's own resolve*() convention) ────────────────────

/** Concurrency cap for `gh` calls routed through this wrapper — conservative against GitHub's 100-concurrent
 *  secondary ceiling, leaving headroom for callers not yet migrated. Overridable via `WE_GH_THROTTLE_CAP`. */
export const DEFAULT_GH_CONCURRENCY_CAP = 6;

/** How often a blocked caller re-polls for a free slot (`gh` calls are far shorter than a heavy command, so
 *  this polls faster than heavy-admission.mjs's 2000ms default). */
export const DEFAULT_ACQUIRE_POLL_MS = 250;

/** How long a caller polls for a free CONCURRENCY slot before giving up and proceeding unslotted — fail OPEN,
 *  mirroring heavy-admission.mjs's own named policy: a queuing timeout must never strand an otherwise-healthy
 *  `gh` call behind a stuck semaphore. Overridable via `WE_GH_THROTTLE_ACQUIRE_TIMEOUT_MS`. */
export const DEFAULT_ACQUIRE_TIMEOUT_MS = 2 * 60_000;

/** Backoff base for a RATE-LIMIT retry (distinct from the acquire-poll interval above — this is the wait AFTER
 *  `gh` itself reports a secondary-limit-shaped failure). Overridable via `WE_GH_THROTTLE_RETRY_BASE_MS`. */
export const DEFAULT_RETRY_BASE_MS = 2_000;
/** Backoff multiplier per retry attempt (doubling, mirroring `infra-blocked.mjs#DEFAULT_FACTOR`). */
export const DEFAULT_RETRY_FACTOR = 2;
/** Backoff ceiling — no single retry wait exceeds this however many attempts have failed. Overridable via
 *  `WE_GH_THROTTLE_RETRY_CAP_MS`. */
export const DEFAULT_RETRY_CAP_MS = 60_000;
/** Total attempts (including the first) before a rate-limit-shaped failure is given up on and re-thrown
 *  unchanged. Overridable via `WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS`. */
export const DEFAULT_RETRY_MAX_ATTEMPTS = 5;

const SUBDIR = join('.admission', 'gh');

export function resolveGhCap(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_CAP);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_GH_CONCURRENCY_CAP;
}

export function resolveAcquireTimeoutMs(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_ACQUIRE_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_ACQUIRE_TIMEOUT_MS;
}

export function resolveRetryMaxAttempts(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_RETRY_MAX_ATTEMPTS;
}

function resolveRetryTuning(env = process.env) {
  const baseMs = Number(env.WE_GH_THROTTLE_RETRY_BASE_MS);
  const capMs = Number(env.WE_GH_THROTTLE_RETRY_CAP_MS);
  return {
    baseMs: Number.isFinite(baseMs) && baseMs >= 0 ? baseMs : DEFAULT_RETRY_BASE_MS,
    factor: DEFAULT_RETRY_FACTOR,
    capMs: Number.isFinite(capMs) && capMs >= 0 ? capMs : DEFAULT_RETRY_CAP_MS,
  };
}

/** The host-shared lock root for `gh`-call admission — a SIBLING of heavy-admission.mjs's own `.admission/heavy`
 *  root (same `defaultPoolRoot` derivation), never inside it: the two pools are independent caps over the same
 *  proven mechanism, not one cap wearing two names. */
export function ghThrottleLockRoot(checkoutRoot = process.cwd(), env = process.env) {
  return join(defaultPoolRoot(checkoutRoot, env), SUBDIR);
}

// ── rate-limit classification (reused, not re-guessed — see module header) ─────────────────────────────────

/**
 * Is `text` (a `gh` invocation's captured stderr/message) shaped like GitHub's PRIMARY or SECONDARY rate-limit
 * failure? A thin alias over `infra-blocked.mjs#classifyPrOpenFailure`'s already-incident-grounded classifier,
 * kept as its own named export so this module's call sites read intent-first rather than reaching through a
 * PR-open-flavored function name.
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isRateLimitShaped(text) {
  return classifyPrOpenFailure(text).cause === 'GitHub rate limit';
}

/**
 * Bounded exponential backoff for retry attempt `attempt` (1-based — the wait BEFORE the (attempt+1)th try).
 * PURE. Mirrors `infra-blocked.mjs#backoffMs`'s doubling-capped shape at a much shorter timescale (seconds, not
 * minutes) — a `gh` secondary-limit window clears in seconds, not the 30-minute outage ceiling that module caps
 * PR-open retries at.
 * @param {number} attempt
 * @param {{baseMs?:number, factor?:number, capMs?:number}} [tuning]
 * @returns {number}
 */
export function retryBackoffMs(attempt, { baseMs = DEFAULT_RETRY_BASE_MS, factor = DEFAULT_RETRY_FACTOR, capMs = DEFAULT_RETRY_CAP_MS } = {}) {
  const n = Math.max(1, Math.floor(attempt));
  const raw = baseMs * Math.pow(factor, n - 1);
  return Math.min(capMs, Math.round(raw));
}

// ── the concurrency semaphore — thin orchestration over heavy-admission.mjs's own primitives ────────────────

/**
 * Poll for a free `gh`-call slot until one is won or `timeoutMs` elapses. FAILS OPEN on timeout (`{ ok:false,
 * timedOut:true }`) — mirrors `heavy-admission.mjs#acquireSlotBlocking`'s own policy, at a SYNCHRONOUS sleep
 * (`sleepSyncMs`, from `we:scripts/readiness/drain-lock.mjs`) rather than an async one, since `runGhSync` (this
 * module's whole point) must stay a synchronous, execFileSync-shaped call — the same reason `gh` calls
 * themselves run via `execFileSync`/`spawnSync`, not an async `exec`.
 */
export function acquireGhSlotSync({
  lockRoot, cap, owner, pid = process.pid,
  pollMs = DEFAULT_ACQUIRE_POLL_MS, timeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS,
  now = () => Date.now(), sleep = sleepSyncMs,
}) {
  const startedAt = now();
  for (;;) {
    const nowMs = now();
    const r = tryAcquireSlot({
      lockRoot, cap, owner, nowMs, nowIso: new Date(nowMs).toISOString(), pid, leaseMinutes: ADMISSION_LEASE_MINUTES,
    });
    if (r.ok) return { ok: true, slot: r.slot, timedOut: false, waitedMs: nowMs - startedAt };
    if (nowMs - startedAt >= timeoutMs) return { ok: false, slot: null, timedOut: true, waitedMs: nowMs - startedAt };
    sleep(pollMs);
  }
}

/** Release whichever `gh`-call slot `owner` holds (idempotent — a no-op if it holds none). */
export function releaseGhSlotSync({ lockRoot, cap, owner }) {
  return releaseOwnedSlot({ lockRoot, cap, owner });
}

/**
 * Read-only snapshot of the gh-call admission pool, for diagnostics — the same shape the heavy-admission
 * module's own status reader returns. Exercised directly by this module's own unit tests as an
 * operator-facing diagnostic seam; the standalone CLI intentionally exposes no status subcommand of its own
 * (it stays a pure passthrough of whatever argv gh itself takes, by design — see the module header).
 * @test-only-export-ok: operator diagnostic seam mirroring an existing wired one, no internal caller yet
 */
export function ghThrottleStatus({ lockRoot, cap }) {
  return admissionStatus({ lockRoot, cap });
}

// ── the transparent, importable, drop-in replacement for `execFileSync('gh', args, opts)` ───────────────────

/**
 * Run `gh` with `args`, gated by the concurrency semaphore and retried with bounded backoff on a rate-limit-
 * shaped failure. TRANSPARENT: on the attempt that finally returns or throws, this behaves EXACTLY like a
 * direct `execFileSync('gh', args, opts)` call — `opts` (everything except the separately-namespaced
 * `opts.throttle` bag below) is passed through UNCHANGED, so the return value and the thrown-error shape
 * (`.status`, `.stdout`, `.stderr`, `.message`) are byte-identical to the real binary's.
 *
 * @param {string[]} args           the `gh` argv (exactly what `execFileSync('gh', args, opts)` would take)
 * @param {object} [opts]           execFileSync options, passed through verbatim, PLUS:
 * @param {object} [opts.throttle]  wrapper-only config, stripped before the real call reaches `execFileSync`:
 *   @param {string} [opts.throttle.owner]           slot-holder identity (default: a fresh random id per call)
 *   @param {string} [opts.throttle.repo]             checkout root used to derive the lock root (default: cwd)
 *   @param {object} [opts.throttle.env]               env bag for the `resolve*` tuning reads (default: process.env)
 *   @param {string} [opts.throttle.lockRoot]         override the derived lock root (tests)
 *   @param {number} [opts.throttle.cap]              override the concurrency cap (tests)
 *   @param {number} [opts.throttle.acquireTimeoutMs] override the acquire-timeout (tests)
 *   @param {number} [opts.throttle.pollMs]           override the acquire poll interval (tests)
 *   @param {number} [opts.throttle.maxAttempts]      override the retry attempt cap (tests)
 *   @param {number} [opts.throttle.retryBaseMs]      override the backoff base (tests)
 *   @param {number} [opts.throttle.retryCapMs]       override the backoff cap (tests)
 *   @param {(ms:number)=>void} [opts.throttle.sleep]  injectable sleep (tests — no real waiting)
 *   @param {()=>number} [opts.throttle.now]           injectable clock (tests)
 *   @param {(args:string[], opts:object)=>*} [opts.throttle.exec]  injectable `gh` exec (tests — mocks the real
 *     `execFileSync('gh', …)` call so no `gh` binary is needed to prove the semaphore/backoff logic)
 * @returns {Buffer|string} whatever the underlying `exec`/`execFileSync` call returns on success
 */
export function runGhSync(args, opts = {}) {
  const { throttle = {}, ...execOpts } = opts;
  const env = throttle.env || process.env;
  const repo = throttle.repo || process.cwd();
  const lockRoot = throttle.lockRoot || ghThrottleLockRoot(repo, env);
  const cap = throttle.cap != null ? throttle.cap : resolveGhCap(env);
  const acquireTimeoutMs = throttle.acquireTimeoutMs != null ? throttle.acquireTimeoutMs : resolveAcquireTimeoutMs(env);
  const pollMs = throttle.pollMs != null ? throttle.pollMs : DEFAULT_ACQUIRE_POLL_MS;
  const maxAttempts = throttle.maxAttempts != null ? throttle.maxAttempts : resolveRetryMaxAttempts(env);
  const retryTuning = { ...resolveRetryTuning(env), ...(throttle.retryBaseMs != null ? { baseMs: throttle.retryBaseMs } : {}), ...(throttle.retryCapMs != null ? { capMs: throttle.retryCapMs } : {}) };
  const sleep = throttle.sleep || sleepSyncMs;
  const now = throttle.now || (() => Date.now());
  const pid = throttle.pid || process.pid;
  const owner = throttle.owner || `${pid}:${randomUUID()}`;
  const exec = throttle.exec || ((a, o) => execFileSync('gh', a, o));

  mkdirSync(lockRoot, { recursive: true });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const acq = acquireGhSlotSync({ lockRoot, cap, owner, pid, pollMs, timeoutMs: acquireTimeoutMs, now, sleep });
    // Fail OPEN on an acquire timeout too — proceeding unslotted rather than stranding this `gh` call forever
    // (the residual-risk policy heavy-admission.mjs itself names: a fixed cap bounds concurrency and makes the
    // wait observable, it does not claim to eliminate contention).
    let result;
    let failure = null;
    try {
      result = exec(args, execOpts);
    } catch (e) {
      failure = e;
    } finally {
      if (acq.ok) releaseGhSlotSync({ lockRoot, cap, owner });
    }
    if (!failure) return result;

    const text = `${failure && failure.stderr ? String(failure.stderr) : ''}\n${failure && failure.message ? String(failure.message) : ''}`;
    const retryable = attempt < maxAttempts && isRateLimitShaped(text);
    if (!retryable) throw failure;

    // Sleep OUTSIDE the held slot — a multi-second backoff must not idle a scarce concurrency slot other
    // pending `gh` calls could use in the meantime.
    sleep(retryBackoffMs(attempt, retryTuning));
  }
}

/**
 * The SAME throttle, shaped as an `execFileSync(file, args, opts)`-compatible 3-arg function — for a caller
 * (e.g. `ci-queue-watch.mjs#defaultListRuns`) whose injectable `exec` default is `execFileSync` itself rather
 * than a pre-bound `(args, opts) => execFileSync('gh', args, opts)` closure. Delegates to {@link runGhSync}
 * when `file === 'gh'`; falls through to the real `execFileSync` for anything else (defensive — every known
 * caller of this adapter only ever passes `'gh'`).
 * @param {string} file
 * @param {string[]} args
 * @param {object} [opts]
 */
export function execFileSyncThrottled(file, args, opts = {}) {
  if (file === 'gh') return runGhSync(args, opts);
  return execFileSync(file, args, opts);
}

// ── the standalone CLI passthrough — full-process transparency, including a SUCCESSFUL call's stderr ────────

/**
 * Run `gh` with `argv`, gated + retried exactly like {@link runGhSync}, then relay the child's stdout, stderr,
 * and exit code to THIS process's own real stdout/stderr/exit code, byte for byte. Uses `spawnSync` rather than
 * `execFileSync` specifically because `execFileSync` DISCARDS a successful call's stderr (Node's documented
 * behavior: it returns only stdout on success) — that would silently drop a real `gh` warning printed to
 * stderr on an otherwise-successful call, breaking the "same stderr" half of the transparency contract.
 * `stdio[0]` stays `'inherit'` so piped/typed stdin reaches the real `gh` unchanged on the FIRST attempt (see
 * the module header's stated retry-vs-piped-stdin limitation).
 * @returns {{status:number, stdout:Buffer, stderr:Buffer}}
 */
export function runGhCliPassthrough(argv, { throttle = {}, spawn = spawnSync } = {}) {
  const env = throttle.env || process.env;
  const repo = throttle.repo || process.cwd();
  const lockRoot = throttle.lockRoot || ghThrottleLockRoot(repo, env);
  const cap = throttle.cap != null ? throttle.cap : resolveGhCap(env);
  const acquireTimeoutMs = throttle.acquireTimeoutMs != null ? throttle.acquireTimeoutMs : resolveAcquireTimeoutMs(env);
  const pollMs = throttle.pollMs != null ? throttle.pollMs : DEFAULT_ACQUIRE_POLL_MS;
  const maxAttempts = throttle.maxAttempts != null ? throttle.maxAttempts : resolveRetryMaxAttempts(env);
  const retryTuning = { ...resolveRetryTuning(env), ...(throttle.retryBaseMs != null ? { baseMs: throttle.retryBaseMs } : {}), ...(throttle.retryCapMs != null ? { capMs: throttle.retryCapMs } : {}) };
  const sleep = throttle.sleep || sleepSyncMs;
  const now = throttle.now || (() => Date.now());
  const pid = throttle.pid || process.pid;
  const owner = throttle.owner || `${pid}:${randomUUID()}`;

  mkdirSync(lockRoot, { recursive: true });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const acq = acquireGhSlotSync({ lockRoot, cap, owner, pid, pollMs, timeoutMs: acquireTimeoutMs, now, sleep });
    let r;
    try {
      r = spawn('gh', argv, { stdio: ['inherit', 'pipe', 'pipe'] });
    } finally {
      if (acq.ok) releaseGhSlotSync({ lockRoot, cap, owner });
    }
    if (r.error) throw r.error; // e.g. `gh` not on PATH — not a `gh`-level failure to retry
    const stderrText = r.stderr ? r.stderr.toString('utf8') : '';
    const failed = typeof r.status === 'number' && r.status !== 0;
    const retryable = failed && attempt < maxAttempts && isRateLimitShaped(stderrText);
    if (!retryable) return { status: r.status == null ? (r.signal ? 128 : 1) : r.status, stdout: r.stdout || Buffer.alloc(0), stderr: r.stderr || Buffer.alloc(0) };
    sleep(retryBackoffMs(attempt, retryTuning));
  }
}

function parseThrottleEnvRepo() {
  return process.env.WE_GH_THROTTLE_OWNER_REPO || process.cwd();
}

async function main(argv) {
  const repo = parseThrottleEnvRepo();
  const owner = process.env.WE_GH_THROTTLE_OWNER || `${process.pid}:${randomUUID()}`;
  const { status, stdout, stderr } = runGhCliPassthrough(argv, { throttle: { repo, owner } });
  if (stdout && stdout.length) writeAllSync(1, stdout);
  if (stderr && stderr.length) writeAllSync(2, stderr);
  process.exitCode = status;
}

// Run the IO shell only when invoked directly (`node scripts/lib/gh-throttle.mjs <gh argv>`) — never on import,
// so every function above stays importable with no subprocess side effect.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ gh-throttle error: ${String(e && e.stack || e)}\n`); process.exitCode = 1; });
}

// ── WIRING NOTE (the conveyor runner's own first real adoption — #3621) ──────────────────────────────────────
// This module wires into THREE real call sites, all inside the headless conveyor runner's every-tick mechanical
// passes (`skills-src/conveyor/runner.mjs#makeCliMechanicalPasses`, ticking every ~120s per
// `DEFAULT_TICK_INTERVAL_MS`) — the highest-volume, most-concurrent-with-itself population of `gh` callers on a
// busy host, per the incident this module exists to fix:
//   1. `we:scripts/lib/review-label-provider.mjs#createGhProvider`'s default `exec` — used, unmodified at their
//      own call sites, by THREE mechanical passes that run every tick: `conveyor/parked-pr-conflict-watch.mjs`
//      (sweep), `conveyor/review-round-tag.mjs`, and `conveyor/review-status-tag.mjs` (both dispatched per
//      review-owed PR inside the review-reconcile pass).
//   2. `we:scripts/conveyor/ci-queue-watch.mjs#defaultListRuns`'s default `exec` — the #3574 CI queue-wait
//      sample (`gh run list`), also run every tick.
//   3. `skills-src/conveyor/runner.mjs`'s own direct `gh repo view` slug resolution inside
//      `makeCliMechanicalPasses` (only paid when review work is actually owed, but on the runner's own hot
//      path, not a script it merely shells).
// See each file's own header/diff for how the seam was wired. The remaining ~79 of the 84 originally-grepped
// `gh`-calling files are NOT touched here — that migration is separate, larger follow-up work.
