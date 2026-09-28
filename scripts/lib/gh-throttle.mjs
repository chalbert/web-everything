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
 *
 * ================================================================================================
 * #3670'S ADDITION (2026-09-22): a PER-MINUTE POINTS BUDGET, and CALL-VOLUME/EXHAUSTED-RETRY RECORDING. The
 * concurrency cap above bounds how many `gh` calls run AT ONCE; it says nothing about how many GitHub REST
 * "points" are spent over time, and a cap-6 semaphore alone still lets 6 calls a second sail past GitHub's
 * 900-points-per-minute secondary ceiling. {@link acquireGhPointsSync} adds that second, independent gate —
 * a fixed 60s window token bucket — using the SAME reuse discipline as the concurrency semaphore above: it
 * does not invent a new cross-process primitive, it calls `file-locks.mjs`'s existing `reserve`/`releaseLockDir`
 * (the same atomic mkdir/O_EXCL + heartbeat-TTL mutex heavy-admission.mjs's own slots are built from) as a
 * plain single-holder mutex guarding a tiny read-modify-write of one shared JSON state file
 * (`points-budget-state.json`, a sibling of the concurrency semaphore's own slot dirs under `.admission/gh`) —
 * so the budget is HOST-SHARED across every lane/process on the box, exactly like the concurrency cap, not a
 * per-process guess that many concurrent lanes could each independently blow past.
 *
 * THE DEFAULT (`DEFAULT_GH_POINTS_BUDGET_PER_MIN`, overridable via `WE_GH_THROTTLE_POINTS_BUDGET_PER_MIN`) is
 * derived, not invented — see that constant's own doc comment for the full methodology.
 *
 * POINTS-PER-CALL is a per-call declaration (`opts.throttle.points`, default 1 — the cost of the majority
 * shape, a single-item view), because different `gh` calls cost GitHub different points (card #3670's own
 * measurement: a single-PR view is 1 point, a 100-PR open list is 4). This module does not maintain a
 * per-subcommand cost table — that would need re-deriving GitHub's own points formula — a caller that knows
 * its call costs more than the default passes `throttle.points` explicitly.
 *
 * A CALL BEYOND BUDGET WAITS, IT DOES NOT FIRE — {@link acquireGhPointsSync} polls (bounded, fail OPEN on
 * timeout, mirroring {@link acquireGhSlotSync}'s own policy exactly) until the current window has room or a
 * new window rolls over, exactly the shape `acquireGhSlotSync` already uses for the concurrency slot.
 *
 * RECORDING — {@link recordGhCallLogEntry} appends one JSON line per `gh` attempt (`calls.jsonl`, a sibling of
 * the budget state file) so the load estimates #3699 used stay honest going forward: this module used to have
 * no memory of how much it was actually called. A `retry_exhausted` line is appended in addition, on the
 * attempt that finally gives up — best-effort (never throws past the call, mirrors `recordGhThrottleMetric`'s
 * own discipline elsewhere in this codebase): a logging failure must never turn a working `gh` call into a
 * broken one.
 *
 * SELF-CALIBRATION AGAINST GitHub'S REAL LIVE RATE-LIMIT SIGNALS (epic #3383's git-manager vision, first real
 * slice — the guessed exponential backoff above was the whole story until now; a `gh pr create` that failed
 * TWICE in one day with no automatic retry at all is what motivated closing that gap).
 *
 * THREE signals exist, and they are NEVER conflated — doing so would misclassify the exact failure that hit us:
 *   1. PRIMARY limit (REST) — `x-ratelimit-remaining` / `x-ratelimit-reset` RESPONSE HEADERS on every REST call.
 *      `remaining: 0` means THIS quota (core/graphql/search/…) is exhausted until `reset` (a UNIX-epoch-seconds
 *      seconds timestamp).
 *   2. PRIMARY limit (GraphQL) — the SAME numbers, but IN-BAND: a `rateLimit { limit cost remaining resetAt }`
 *      field in the response BODY, present ONLY when the query itself asks for it (GitHub never attaches it
 *      unrequested). {@link parseGraphQLRateLimit} reads it for a future caller that does; none of this pass's
 *      wired call sites query for it (`gh pr create` is REST).
 *   3. SECONDARY (abuse/burst) limit — the ~100-concurrent / 900-REST-points-per-minute ceiling this module's
 *      concurrency cap already exists to avoid (see above), and the one that actually hit us twice. GitHub's own
 *      docs are explicit that this is a DIFFERENT mechanism from the primary quota — it is NEVER reported by
 *      `x-ratelimit-*`, and is knowable only REACTIVELY, from a `Retry-After` header on the 403/429 response that
 *      triggered it. {@link classifyRateLimitSignal} checks for `retry-after` FIRST and treats its presence as
 *      secondary UNCONDITIONALLY, so a response that carried both header families would still resolve to the one
 *      that actually told us how long to wait — the conflation risk named up front, closed by construction
 *      rather than by convention.
 *
 * HOW THE SIGNAL REACHES US AT ALL. `gh` is a subprocess we shell out to — this module never makes the HTTP call
 * itself — so the only way to see its real response headers is `GH_DEBUG=api`, which makes `gh` print a full
 * request/response trace to STDERR (empirically confirmed, 2026-09: a successful call's STDOUT is byte-for-byte
 * untouched, so this is invisible to the common case; only a FAILURE's `stderr` gains the extra trace text, and
 * the Authorization header is redacted by `gh` itself before it ever reaches this trace). {@link
 * parseGhDebugResponseHeaders} parses that trace's response-header block back into a plain header map.
 *
 * THIS IS WHY HEADER CALIBRATION IS OPT-IN PER CALL (`opts.throttle.calibrateHeaders`), NEVER THE DEFAULT.
 * `runGhSync`'s existing contract — proven for real against the live `gh` binary in
 * `gh-throttle.fidelity.test.mjs` — is that a THROWN error's `.stderr` is byte-identical to a raw `execFileSync`
 * throw. Turning `GH_DEBUG` on unconditionally would break that promise for every one of this wrapper's current
 * adopters (`review-label-provider.mjs`, `ci-queue-watch.mjs`, `runner.mjs`), none of which asked for it. Only
 * the ONE call site this pass wires in — `forge-land-provider.mjs#createGhLandProvider`'s `create()`, i.e. the
 * exact `gh pr create` that failed twice today — opts in. Every other call through this module keeps its
 * existing GUESSED backoff ({@link retryBackoffMs}) exactly as before: {@link calibratedBackoffMs} falls back to
 * it whenever no real header was available, which is automatically true whenever `calibrateHeaders` is off (no
 * `GH_DEBUG` trace exists to parse), so the fallback path is not a separate case to keep in sync — it IS the
 * pre-existing behavior, reached the same way it always was.
 *
 * TELEMETRY (the recorded vision's own "must include telemetry" requirement) — every classified rate-limit hit
 * records `gh.throttle.rate_limited` (+ `gh.throttle.backoff_ms` on a retry, `gh.throttle.exhausted` on a final
 * give-up) via `operations/telemetry-store.mjs`'s existing recorder, tagged with WHICH signal source calibrated
 * the wait — so a later capacity read can tell "we backed off using GitHub's own told wait" from "we were still
 * guessing," across every adopter of this module, not just the one call site with headers turned on.
 *
 * #4309 — SPEND ACCOUNTING. The CLI passthrough ({@link runGhCliPassthrough}, the path every agent session's `gh`
 * takes via the gh App shim) now turns `GH_DEBUG=api` on by default, reads each response's free `X-Ratelimit-*`
 * headers into the `calls.jsonl` line's `rl` field, and strips its own trace back out ({@link stripGhDebug})
 * before relaying stderr — a caller that set its own `GH_DEBUG` is never stripped. Kill switch:
 * `WE_GH_THROTTLE_COST_HEADERS=0`. {@link runGhSync}'s own exec is unchanged (its lines stay estimate-only);
 * both entry points log `id` (auth identity), `inv` (invocation id) and `resource`. `gh-spend.mjs` rolls it up.
 * ================================================================================================
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

import { tryAcquireSlot, releaseOwnedSlot, admissionStatus, ADMISSION_LEASE_MINUTES } from '../readiness/heavy-admission.mjs';
import { reserve, releaseLockDir } from '../readiness/file-locks.mjs';
import { defaultPoolRoot } from './lane-pool-paths.mjs';
import { sleepSyncMs } from '../readiness/drain-lock.mjs';
import { classifyPrOpenFailure } from '../conveyor/infra-blocked.mjs';
import { writeAllSync } from './write-all-sync.mjs';
import { retryAfterMs } from '../readiness/model-proposer.mjs';
import { createTelemetryRecorder } from '../operations/telemetry-store.mjs';
import { markPrSnapshotDirty, repoFromGhArgs } from './pr-snapshot-store.mjs';

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

/** {@link runGhCliPassthrough}'s own internal captured-output cap — mirrors `gh-app-shim.mjs`'s own
 *  `SHIM_CAPTURE_MAX_BUFFER` (#4064): Node's `spawnSync` default `maxBuffer` is 1MB, which would silently
 *  ENOBUFS/truncate a real `gh pr view`/`gh api` payload over that size. This module's CLI is now a hop INSIDE
 *  the gh App shim's own call chain (`gh-app-shim.mjs#renderGhShimScript`, #4064) rather than only a standalone
 *  direct invocation, so it must never be the layer that reintroduces the exact truncation bug the shim itself
 *  was fixed for (#x8mpubm follow-up, review-2578/2601). Overridable per-call via `throttle.maxBuffer`. */
export const DEFAULT_GH_CLI_MAX_BUFFER = 1024 * 1024 * 1024;

/** The points-budget window — fixed, not sliding (mirrors GitHub's own "per minute" framing). Not currently
 *  overridable: unlike the tuning above, changing the window size changes what the budget NUMBER means, so a
 *  caller that wants a different window should also reconsider the budget rather than flip one env var. */
export const GH_POINTS_WINDOW_MS = 60_000;

/**
 * Per-minute GitHub REST "points" budget for `gh` calls routed through this wrapper — distinct from
 * `DEFAULT_GH_CONCURRENCY_CAP` above: that bounds how many calls run AT ONCE, this bounds how many POINTS are
 * spent over a rolling 60s window (see the module header's #3670 section). Overridable via
 * `WE_GH_THROTTLE_POINTS_BUDGET_PER_MIN`.
 *
 * DERIVED 2026-09-22, from three inputs, not invented:
 *   1. GitHub's documented secondary ceiling — 900 REST points/minute, ACCOUNT-WIDE (this module header's own
 *      opening paragraph; also #3670's own text).
 *   2. This item's own measured call costs (#3670: a single-PR view is 1 point, a 100-PR open list is 4) and
 *      #3699's own load estimate from those costs: today's WE watchers (`pr-watch`/`wait-green`/the conveyor's
 *      review-reconcile pass) cost roughly 24-56 points/minute STEADY STATE at their current poll intervals.
 *   3. This wrapper's lock root is HOST-SHARED (the concurrency cap already proves this — see the module
 *      header), so ONE default here is spent by every lane/process on the box combined, not per-process; but
 *      it is NOT account-wide across every host, and NOT every `gh`-calling site is migrated onto this wrapper
 *      yet (#3670's own remaining ~78-of-84, filed as this item's slice-2 follow-on) — calls outside the
 *      wrapper spend from the SAME 900-point ceiling without this budget ever seeing them.
 *
 * 300 (one third of the documented 900-point ceiling) sits 5-12x above today's measured steady-state load
 * (headroom for the `merge-ai-prs.mjs` volume #3670 adds and for legitimate bursts), while leaving roughly 600
 * points/minute of the real ceiling for callers not yet migrated onto this wrapper — the same "conservative,
 * not near-full-utilization, leave headroom for the unmigrated sites" principle `DEFAULT_GH_CONCURRENCY_CAP`
 * already states for itself (6 of GitHub's 100-concurrent ceiling). Revisit once slice-2's migration and/or
 * #3699's state-feed adoption change how much of this account's quota this wrapper actually owns.
 */
export const DEFAULT_GH_POINTS_BUDGET_PER_MIN = 300;

export function resolveGhPointsBudgetPerMin(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_POINTS_BUDGET_PER_MIN);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_GH_POINTS_BUDGET_PER_MIN;
}

/**
 * Per-minute WRITE-ONLY budget — a THIRD, independent gate ({@link classifyGhWrite} decides membership), never
 * consulted for a read. #gh-write-burst (live 2026-09-27 03:5x-04:00Z landing freeze): the points budget above
 * alone did NOT stop that storm — every call in this module defaults to costing 1 point regardless of whether
 * it reads or writes, so a run of cheap mutations (a label flip, a posted comment) stays well inside a
 * 300-points-per-minute budget while still hammering GitHub's secondary limit, which is explicitly an ABUSE/
 * burst detector keyed on repeated MUTATIONS, not on generic REST-point spend (this module's own header, THREE
 * signals section). Reads and writes are not the same risk, so they get separate ceilings.
 *
 * DERIVED from that same incident, not invented: `calls.jsonl`'s own burst breakdown was `pr edit` x~80 + `pr
 * comment` x~75 in the ten minutes before the freeze (the third op in that burst, `api --method` x152, turned
 * out on inspection to be `--method GET` reads from `parked-pr-conflict-watch.mjs#computeConflictDisposition`,
 * NOT mutations — the exact ambiguity {@link classifyGhWrite} exists to resolve for every future read of this
 * log, not just this one). That is a real, sustained mutation rate of roughly 15/min for ten straight minutes —
 * `DEFAULT_GH_WRITE_BUDGET_PER_MIN` sits at roughly half that storm rate, well above any single legitimate
 * multi-PR write burst this repo's own passes produce today (a merge-orphan-sweep landing a handful of PRs back
 * to back, a label sweep touching a dozen PRs in one tick), while making a repeat of THIS incident's shape queue
 * instead of hammering GitHub. Overridable via `WE_GH_THROTTLE_WRITE_BUDGET_PER_MIN`.
 */
export const DEFAULT_GH_WRITE_BUDGET_PER_MIN = 40;

export function resolveGhWriteBudgetPerMin(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_WRITE_BUDGET_PER_MIN);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_GH_WRITE_BUDGET_PER_MIN;
}

/**
 * Classify a `gh` invocation's argv as a MUTATION ("write") or not, for the write-budget gate above — completely
 * independent of {@link isRateLimitShaped}/the concurrency cap. PURE: argv in, boolean out. Reuses `gh`'s own
 * documented method-inference rule for `gh api` (an explicit `--method` wins; absent that, `gh` itself switches
 * to `POST` the instant any `-f`/`-F`/`--field`/`--raw-field`/`--input` flag is present — the exact rule
 * `we:scripts/lib/review-label-provider.mjs`'s own header already names for `readPrFiles`'s `--method GET`) —
 * never re-guessed here. Every current `gh api --method ...` call site in this repo passes `GET` (confirmed by
 * grep, 2026-09-27; see {@link DEFAULT_GH_WRITE_BUDGET_PER_MIN}'s own doc comment) — this classifier is what
 * keeps that true going forward instead of being an unwritten convention nobody checks.
 * @param {string[]} args
 * @returns {boolean}
 */
export function classifyGhWrite(args) {
  const a = Array.isArray(args) ? args : [];
  const cmd = a[0];
  const sub = a[1];
  if (cmd === 'pr') return ['edit', 'comment', 'close', 'merge', 'reopen', 'ready', 'create', 'review'].includes(sub);
  if (cmd === 'issue') return ['edit', 'comment', 'close', 'reopen', 'create'].includes(sub);
  if (cmd === 'label') return ['create', 'delete', 'edit'].includes(sub);
  if (cmd === 'run') return ['cancel', 'rerun'].includes(sub);
  if (cmd === 'api') {
    const methodIdx = a.indexOf('--method');
    const method = methodIdx >= 0 ? String(a[methodIdx + 1] || '').toUpperCase() : null;
    if (method) return method !== 'GET' && method !== 'HEAD';
    return a.some((t) => t === '-f' || t === '-F' || t === '--field' || t === '--raw-field' || t === '--input');
  }
  return false;
}

/**
 * Best-effort caller attribution for a `gh` call, recorded on every `calls.jsonl` line (see {@link
 * recordGhCallLogEntry}) so the NEXT burst is traceable in one grep instead of the forensic, multi-log,
 * multi-transcript correlation the 2026-09-27 incident needed. Precedence, most to least specific:
 *   1. `throttle.caller` — an explicit override a call site passes (tests, a future precise adopter).
 *   2. `GH_CALLER` env — set by `we:skills-src/conveyor/pass-daemon.mjs` to the exact manifest pass name
 *      (e.g. "parked-pr-conflict-watch-we") before spawning each daemon+pass's child process; also settable by
 *      hand for an ad hoc invocation.
 *   3. `process.argv[1]`'s basename — free attribution for EVERY caller that runs as its OWN node process
 *      (every mechanical pass spawned by pass-daemon.mjs, and the standalone CLI's own direct invocations):
 *      `process.argv[1]` in that process IS the pass's own script path, no env needed. Only uninformative for
 *      one population — the standalone CLI passthrough used by the gh App shim (#4064), where argv[1] is always
 *      this module itself — which is exactly why (2) exists.
 *   4. `'unknown'` — never blank; a caller field that could be absent is one nobody greps reliably.
 * @param {{caller?:string}} throttle
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
export function deriveGhCaller(throttle, env) {
  if (throttle && throttle.caller) return String(throttle.caller);
  if (env && env.GH_CALLER) return String(env.GH_CALLER);
  const argv1 = process.argv[1];
  if (argv1) {
    const b = basename(argv1);
    if (b && b !== 'gh-throttle.mjs') return b;
  }
  return 'unknown';
}

const SUBDIR = join('.admission', 'gh');
const POINTS_BUDGET_LOCK_KEY = 'points-budget';
const POINTS_BUDGET_LOCK_LEASE_MINUTES = 1; // short — the mutex is held only across one tiny JSON read/write
const POINTS_BUDGET_STATE_FILENAME = 'points-budget-state.json';
const CALL_LOG_FILENAME = 'calls.jsonl';
const WRITE_BUDGET_LOCK_KEY = 'write-budget';
const WRITE_BUDGET_STATE_FILENAME = 'write-budget-state.json';

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

/** Env override for {@link ghThrottleLockRoot} — an absolute path (a leading `~` expands to `$HOME`). */
export const GH_THROTTLE_LOCK_ROOT_ENV = 'WE_GH_THROTTLE_LOCK_ROOT';

/** The host-shared lock root for `gh`-call admission — `.admission/gh`, never inside heavy-admission.mjs's own
 *  `.admission/heavy` root: the two pools are independent caps over the same proven mechanism.
 *
 *  CWD-INDEPENDENT (live 2026-09-27 ~04:10Z landing freeze): this used to be `defaultPoolRoot(process.cwd())`,
 *  i.e. derived from whatever directory the CALLER happened to be in. Every `gh` call runs through this module
 *  (via the gh App shim), so a call made from `/tmp` (a smoke candidate worktree, a scratch dir) derived
 *  `/private/.lanes/.admission/gh`, hit EACCES on mkdir, and crashed instead of running `gh`. Resolution order:
 *    1. `WE_GH_THROTTLE_LOCK_ROOT` — explicit host override;
 *    2. `LANE_POOL_ROOT` — the existing pool override (tests isolate the throttle with it) → `<pool>/.admission/gh`;
 *    3. `$HOME/workspace/.lanes/.admission/gh` — a fixed host path, the same place the old derivation produced
 *       for every caller already inside the workspace, so live callers on older code share the SAME semaphore.
 *  `_checkoutRoot` is accepted for signature compatibility and deliberately ignored. */
export function ghThrottleLockRoot(_checkoutRoot, env = process.env) {
  const home = env.HOME || homedir();
  const expand = (p) => (p && p.startsWith('~') ? join(home, p.slice(1)) : p);
  const override = expand(String(env[GH_THROTTLE_LOCK_ROOT_ENV] || '').trim());
  if (override) return resolve(override);
  if (env.LANE_POOL_ROOT) return join(defaultPoolRoot(home, env), SUBDIR);
  return join(home, 'workspace', '.lanes', SUBDIR);
}

let failOpenWarned = false;
/** Test seam: re-arm the once-per-process fail-open warning. @test-only-export-ok */
export function resetGhThrottleFailOpenWarning() { failOpenWarned = false; }

/**
 * FAIL OPEN: run one throttle SETUP step (`mkdir` of the lock root, a points/slot acquire, a slot release). If
 * it throws, warn once on stderr, best-effort log a `fail_open` line (the `gh-call-failures` health smell reads
 * it), and return `fallback` — the caller then runs `gh` ungated. A throttle is a courtesy to GitHub's rate
 * limits; it must never be the reason a `gh` call does not run at all.
 */
export function failOpenGate(stage, fn, { fallback, warn, logPath, op } = {}) {
  try {
    return fn();
  } catch (e) {
    const reason = String((e && e.message) || e).split('\n')[0];
    if (warn) warn(stage, reason);
    else if (!failOpenWarned) {
      failOpenWarned = true;
      try { process.stderr.write(`⚠ gh-throttle: ${stage} failed (${reason}) — running gh unthrottled (fail-open)\n`); } catch { /* ignore */ }
    }
    if (logPath) recordGhCallLogEntry(logPath, { op: op || 'unknown', outcome: 'fail_open', stage, reason });
    return fallback;
  }
}

/** Where the points-budget window state lives — a sibling of the concurrency semaphore's own slot dirs, under
 *  the SAME host-shared lock root (never a separate root: one `.admission/gh` for both gates). */
export function ghPointsBudgetStatePath(lockRoot) {
  return join(lockRoot, POINTS_BUDGET_STATE_FILENAME);
}

/** The sidecar call/retry-exhausted log's path (#3670) — a sibling of the budget state file, same lock root. */
export function ghThrottleLogPath(lockRoot) {
  return join(lockRoot, CALL_LOG_FILENAME);
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

// ── self-calibration against GitHub's REAL rate-limit signals (see the module header) ──────────────────────

/** Ceiling on a HEADER-DERIVED wait (a real `Retry-After` or a primary-limit reset) — GitHub can legitimately
 *  ask for a wait longer than the GUESSED backoff's own cap (a primary quota's reset can be most of an hour
 *  away), but a malformed or bogus header must never stall a caller indefinitely. Overridable via
 *  `WE_GH_THROTTLE_HEADER_WAIT_CAP_MS`. */
export const DEFAULT_HEADER_WAIT_CAP_MS = 10 * 60_000;

export function resolveHeaderWaitCapMs(env = process.env) {
  const n = Number(env.WE_GH_THROTTLE_HEADER_WAIT_CAP_MS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_HEADER_WAIT_CAP_MS;
}

/**
 * Parse `GH_DEBUG=api`'s response-header trace lines (`< Header-Name: value`) out of a `gh` invocation's
 * stderr — the ONLY way to see GitHub's real rate-limit headers when shelling `gh` as a subprocess (see the
 * module header). Takes the LAST `< HTTP/… <status>` block in the text (`gh` can retry internally before the
 * failure it finally surfaces to us, so an earlier block's headers would not describe the actual error), and
 * reads header lines until the block ends (the first line that does not start with `<` — the blank separator
 * before the response body). Pure — text in, a lowercased header map out; `{}` on no match. Never throws.
 * @param {string|null|undefined} text
 * @returns {Record<string,string>}
 */
export function parseGhDebugResponseHeaders(text) {
  const lines = String(text ?? '').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^<\s*HTTP\/\S+\s+\d+/.test(lines[i])) start = i; // keep updating — the LAST response block wins
  }
  if (start === -1) return {};
  const headers = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('<')) break; // block ends at the blank line separating headers from the body
    const m = line.match(/^<\s*([A-Za-z0-9-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2].trim();
  }
  return headers;
}

// ── cost-header capture (#4309) — free `X-Ratelimit-*` headers via `GH_DEBUG=api`, stripped before relay ────────

/** Kill switch for {@link runGhCliPassthrough}'s cost-header capture: `WE_GH_THROTTLE_COST_HEADERS=0` turns it
 *  off (the call then runs with no `GH_DEBUG` and logs no `rl`; `gh-spend.mjs` falls back to estimates). */
export const GH_COST_HEADERS_ENV = 'WE_GH_THROTTLE_COST_HEADERS';

export function resolveCostHeaderCapture(env = process.env) {
  return String(env[GH_COST_HEADERS_ENV] ?? '').trim() !== '0';
}

/** Capture headroom: the `GH_DEBUG=api` trace repeats each request and response body (pretty-printed) on stderr,
 *  so a capturing spawn gets this multiple of the caller's `maxBuffer`. Memory is only used as output arrives. */
export const DEBUG_CAPTURE_BUFFER_FACTOR = 8;

/** The error a capturing spawn raises when stdout alone exceeds the caller's own `maxBuffer` — the same
 *  `ENOBUFS` shape a non-capturing spawn would have thrown, so the widened child buffer never loosens that cap. */
function captureStdoutOverflow(bin, argv) {
  const err = new Error(`spawnSync ${bin} ENOBUFS (stdout exceeded maxBuffer)`);
  err.code = 'ENOBUFS';
  err.syscall = `spawnSync ${bin}`;
  err.path = bin;
  err.spawnargs = argv;
  return err;
}

/** The `[git remote -v]`-shaped line gh prints for every git subprocess it runs while `GH_DEBUG` is set. */
const GH_DEBUG_GIT_LINE = /^\[(\S*\/)?git( [^\n]*)?\]$/;

/**
 * Remove the trace `GH_DEBUG=api` adds to a `gh` invocation's stderr, and return the response headers it
 * carried. PURE. Shapes observed on the real binary (gh 2.95.0, fixtures in `__tests__/fixtures/gh-debug/`):
 *   - one block per HTTP request: `* Request at …`, `* Request to …`, `> ` request headers, a blank line, the
 *     request body (the GraphQL query), a blank line, `< HTTP/2.0 <status>`, `< ` response headers, a blank line,
 *     the response BODY (pretty-printed JSON), a blank line, `* Request took …`. A block is everything from its
 *     `* Request at` line through its `* Request took` line, inclusive;
 *   - a paginated or multi-request command prints several blocks back to back;
 *   - `[git …]` lines, one per git subprocess gh runs (repo resolution) — also debug-only, also stripped;
 *   - gh's own real stderr (e.g. `GraphQL: Could not resolve …`) comes after the last block and is kept.
 * An UNCLOSED block (gh died mid-request: a signal, a spawn-side buffer overflow) is stripped only through its
 * last `< `/`> ` header line plus one blank line; everything after that is kept, so a partial error is never lost.
 * @param {string|null|undefined} text
 * @returns {{stderr:string, responses:Array<{status:number, headers:Record<string,string>}>}}
 */
export function stripGhDebug(text) {
  const lines = String(text ?? '').split('\n');
  const kept = [];
  const responses = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (GH_DEBUG_GIT_LINE.test(line)) { i += 1; continue; }
    if (!line.startsWith('* Request at ')) { kept.push(line); i += 1; continue; }
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].startsWith('* Request took ')) { end = j; break; }
      if (lines[j].startsWith('* Request at ')) break;
    }
    const blockEnd = end === -1 ? lines.length - 1 : end;
    let status = null;
    let headers = null;
    let lastHeaderLine = i;
    for (let j = i + 1; j <= blockEnd; j++) {
      const l = lines[j];
      const m = l.match(/^<\s*HTTP\/\S+\s+(\d+)/);
      if (m) { status = Number(m[1]); headers = {}; lastHeaderLine = j; continue; }
      if (l.startsWith('< ') || l.startsWith('> ')) {
        lastHeaderLine = j;
        const h = headers && l.startsWith('< ') ? l.match(/^<\s*([A-Za-z0-9-]+):\s*(.*)$/) : null;
        if (h) headers[h[1].toLowerCase()] = h[2].trim();
      }
    }
    if (status != null) responses.push({ status, headers });
    if (end !== -1) { i = end + 1; continue; }
    i = lastHeaderLine + 1;
    if (i < lines.length && lines[i] === '' && i < lines.length - 1) i += 1;
  }
  return { stderr: kept.join('\n'), responses };
}

/** The compact per-response record a `calls.jsonl` line carries in `rl` — one per response with rate-limit
 *  headers (about 80 bytes). `res` is GitHub's own `X-Ratelimit-Resource` (`graphql`, `core`, …). */
export function rateLimitRecords(responses) {
  const out = [];
  for (const r of responses || []) {
    const h = r && r.headers;
    if (!h || h['x-ratelimit-used'] == null) continue;
    const num = (k) => (h[k] != null && Number.isFinite(Number(h[k])) ? Number(h[k]) : null);
    out.push({ used: num('x-ratelimit-used'), rem: num('x-ratelimit-remaining'), limit: num('x-ratelimit-limit'), reset: num('x-ratelimit-reset'), res: h['x-ratelimit-resource'] || null });
  }
  return out;
}

/** Env var {@link runGhSync} sets on its real `gh` child so a nested passthrough (the gh App shim → this CLI)
 *  records `outer: <inv>` and the pair counts as ONE invocation, not two. */
export const GH_OUTER_INV_ENV = 'WE_GH_THROTTLE_OUTER_INV';

/**
 * Extract a GraphQL response body's IN-BAND `rateLimit` field — GitHub attaches it only when the query itself
 * requests one (`rateLimit { limit cost remaining resetAt }` or similar), never automatically, unlike the REST
 * headers {@link parseGhDebugResponseHeaders} reads. None of this pass's wired call sites query for it (`gh pr
 * create` is REST) — this exists so a future GraphQL-based caller has ONE shared parse to reuse rather than
 * re-deriving its own. Pure. Returns null on anything unparseable/absent.
 * @param {string|object|null|undefined} body  a parsed JSON object, or its raw text
 * @returns {{limit:(number|null), remaining:number, resetEpochSec:(number|null), cost:(number|null)}|null}
 */
export function parseGraphQLRateLimit(body) {
  try {
    const obj = typeof body === 'string' ? JSON.parse(body) : body;
    const rl = obj?.data?.rateLimit;
    if (!rl || typeof rl.remaining !== 'number') return null;
    const resetEpochSec = rl.resetAt ? Math.floor(Date.parse(rl.resetAt) / 1000) : null;
    return { limit: rl.limit ?? null, remaining: rl.remaining, resetEpochSec, cost: rl.cost ?? null };
  } catch {
    return null;
  }
}

/**
 * Classify a header map (from {@link parseGhDebugResponseHeaders}, or hand-built by a test/caller) into which
 * of the two DISTINCT rate-limit mechanisms it evidences — never both, never conflated (see the module
 * header). `retry-after` is checked FIRST and is UNCONDITIONALLY secondary: GitHub only ever sends that header
 * on the abuse/burst-limit response, never on an ordinary 200 with headroom to spare. Pure.
 * @param {Record<string,string>} headers
 * @returns {{kind:('secondary'|'primary'|'none'), retryAfterRaw?:string, remaining?:number, resetEpochSec?:number}}
 */
export function classifyRateLimitSignal(headers) {
  const h = headers || {};
  if (h['retry-after'] != null) return { kind: 'secondary', retryAfterRaw: h['retry-after'] };
  const remaining = h['x-ratelimit-remaining'] != null ? Number(h['x-ratelimit-remaining']) : null;
  const resetEpochSec = h['x-ratelimit-reset'] != null ? Number(h['x-ratelimit-reset']) : null;
  if (remaining === 0 && Number.isFinite(resetEpochSec)) return { kind: 'primary', remaining, resetEpochSec };
  return { kind: 'none' };
}

/**
 * The self-calibrated wait before the next retry — GitHub's OWN told wait when a real signal is available,
 * falling back to the existing GUESSED exponential backoff ({@link retryBackoffMs}) only when it is not (no
 * header calibration for this call, or a trace that carried neither signal). NEVER re-derives the primary/
 * secondary distinction itself — it branches on {@link classifyRateLimitSignal}'s verdict alone, so this
 * function and that one can never disagree about which failure is which. Pure.
 * @param {{headers?:object, attempt:number, tuning?:object, nowMs?:number, headerCapMs?:number}} o
 * @returns {{ms:number, source:('secondary-retry-after'|'primary-reset'|'guessed-backoff')}}
 */
export function calibratedBackoffMs({ headers = {}, attempt, tuning = {}, nowMs = Date.now(), headerCapMs = DEFAULT_HEADER_WAIT_CAP_MS } = {}) {
  const signal = classifyRateLimitSignal(headers);
  if (signal.kind === 'secondary') {
    const ms = retryAfterMs(signal.retryAfterRaw, nowMs); // reused from model-proposer.mjs — not re-derived
    if (ms != null) return { ms: Math.min(ms, headerCapMs), source: 'secondary-retry-after' };
  }
  if (signal.kind === 'primary') {
    const ms = Math.max(0, signal.resetEpochSec * 1000 - nowMs);
    return { ms: Math.min(ms, headerCapMs), source: 'primary-reset' };
  }
  return { ms: retryBackoffMs(attempt, tuning), source: 'guessed-backoff' };
}

/**
 * Best-effort telemetry for a rate-limit hit/backoff (epic #3383's "must include telemetry" ask) — reuses
 * `operations/telemetry-store.mjs`'s existing recorder rather than inventing a second store. NEVER throws
 * past this call (the recorder's own purity discipline already guarantees this; the try/catch here is cheap,
 * redundant insurance against a future change to that contract) — a telemetry hiccup must never turn a
 * successful retry loop into a broken one.
 * @param {string} name  one of `gh.throttle.rate_limited` | `gh.throttle.backoff_ms` | `gh.throttle.exhausted`
 * @param {number} value
 * @param {{op?:string, attempt?:number, source?:string, outcome?:string, unit?:string}} [o]
 */
function recordGhThrottleMetric(name, value, { op, attempt, source, outcome, unit = 'count' } = {}) {
  try {
    const tel = createTelemetryRecorder({ kind: 'gh-throttle' });
    tel.recordMetric(name, value, { unit, attributes: { op: op || 'unknown', attempt, source, ...(outcome ? { outcome } : {}) } });
  } catch {
    /* best-effort — see docblock */
  }
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

// ── the per-minute points budget (#3670) — a SECOND, independent gate over SPEND, not concurrency ────────────

function readGhPointsBudgetState(lockRoot) {
  try {
    const parsed = JSON.parse(readFileSync(ghPointsBudgetStatePath(lockRoot), 'utf8'));
    if (Number.isFinite(parsed.windowStartMs) && Number.isFinite(parsed.spent)) return parsed;
  } catch {
    /* absent or corrupt — decideGhPointsSpend treats a null state as a fresh window */
  }
  return null;
}

function writeGhPointsBudgetState(lockRoot, state) {
  writeFileSync(ghPointsBudgetStatePath(lockRoot), JSON.stringify(state) + '\n', 'utf8');
}

/**
 * PURE decision: may `points` be spent right now against `state` (the current window's `{windowStartMs,
 * spent}`, or `null` for a never-yet-written one), and if not, how long until it may. A window whose age has
 * reached `windowMs` is treated as freshly rolled over (spent resets to 0) BEFORE checking whether `points`
 * fits — so a caller that arrives just past the boundary spends against the new window, not the exhausted one.
 * @returns {{allowed:boolean, nextState:{windowStartMs:number, spent:number}, waitMs?:number}}
 */
export function decideGhPointsSpend({ state, points, nowMs, budgetPerMin, windowMs = GH_POINTS_WINDOW_MS }) {
  const priorStart = state && Number.isFinite(state.windowStartMs) ? state.windowStartMs : nowMs;
  const priorSpent = state && Number.isFinite(state.spent) ? state.spent : 0;
  const rolledOver = nowMs - priorStart >= windowMs;
  const windowStartMs = rolledOver ? nowMs : priorStart;
  const spent = rolledOver ? 0 : priorSpent;
  if (spent + points <= budgetPerMin) {
    return { allowed: true, nextState: { windowStartMs, spent: spent + points } };
  }
  return { allowed: false, nextState: { windowStartMs, spent }, waitMs: windowMs - (nowMs - windowStartMs) };
}

/**
 * Cross-process-safe points-budget gate. Spins (bounded, injectable `sleep`/`now` for tests — no real
 * waiting) until `points` fits in the current 60s window or `timeoutMs` elapses, guarding the shared window
 * state with `file-locks.mjs#reserve`/`releaseLockDir` (a plain single-holder mutex, held only across one
 * tiny JSON read/write — see the module header's #3670 section for why this reuses that primitive rather than
 * inventing a new one). FAILS OPEN on timeout (`{ok:false, timedOut:true}`) — mirrors {@link acquireGhSlotSync}
 * exactly: a stuck budget gate must never strand an otherwise-healthy `gh` call forever.
 */
export function acquireGhPointsSync({
  lockRoot, points = 1, budgetPerMin, owner, pid = process.pid,
  now = () => Date.now(), sleep = sleepSyncMs, pollMs = DEFAULT_ACQUIRE_POLL_MS,
  timeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS, windowMs = GH_POINTS_WINDOW_MS,
}) {
  mkdirSync(lockRoot, { recursive: true });
  const startedAt = now();
  for (;;) {
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    const locked = reserve(lockRoot, POINTS_BUDGET_LOCK_KEY, owner, nowMs, nowIso, pid, 'unknown', POINTS_BUDGET_LOCK_LEASE_MINUTES);
    let decision = null;
    if (locked.ok) {
      try {
        decision = decideGhPointsSpend({ state: readGhPointsBudgetState(lockRoot), points, nowMs, budgetPerMin, windowMs });
        if (decision.allowed) writeGhPointsBudgetState(lockRoot, decision.nextState);
      } finally {
        releaseLockDir(lockRoot, POINTS_BUDGET_LOCK_KEY);
      }
    }
    if (decision && decision.allowed) return { ok: true, waitedMs: nowMs - startedAt, timedOut: false };
    if (nowMs - startedAt >= timeoutMs) return { ok: false, waitedMs: nowMs - startedAt, timedOut: true };
    sleep(decision ? Math.min(pollMs, Math.max(1, decision.waitMs)) : pollMs);
  }
}

// ── the per-minute WRITE budget (#gh-write-burst) — a SEPARATE gate over MUTATIONS only, never a read ─────────

/** Where the write-budget window state lives — a sibling of the points-budget state file, own lock key, so a
 *  write-budget wait never blocks (or is blocked by) an ordinary read's points-budget accounting. */
export function ghWriteBudgetStatePath(lockRoot) {
  return join(lockRoot, WRITE_BUDGET_STATE_FILENAME);
}

function readGhWriteBudgetState(lockRoot) {
  try {
    const parsed = JSON.parse(readFileSync(ghWriteBudgetStatePath(lockRoot), 'utf8'));
    if (Number.isFinite(parsed.windowStartMs) && Number.isFinite(parsed.spent)) return parsed;
  } catch {
    /* absent or corrupt — decideGhPointsSpend treats a null state as a fresh window */
  }
  return null;
}

function writeGhWriteBudgetState(lockRoot, state) {
  writeFileSync(ghWriteBudgetStatePath(lockRoot), JSON.stringify(state) + '\n', 'utf8');
}

/**
 * Cross-process-safe WRITE-budget gate — the IDENTICAL fixed-window token-bucket shape as {@link
 * acquireGhPointsSync} (reusing its pure decision core, {@link decideGhPointsSpend}, unchanged: a spend
 * decision is a spend decision regardless of which ledger it is checked against), over its OWN state file and
 * lock key so exhausting the write budget never blocks a read and vice versa. A caller QUEUES here (spins,
 * bounded, injectable `sleep`/`now` for tests) rather than firing — the #gh-write-burst fix's whole point:
 * a write past budget waits for the window instead of hammering GitHub. FAILS OPEN on timeout, identically to
 * every other gate in this module. Cost is always 1 per call (write calls are not weighted by REST points —
 * unlike the points budget, this ledger counts MUTATIONS, not spend).
 */
export function acquireGhWriteBudgetSync({
  lockRoot, budgetPerMin, owner, pid = process.pid,
  now = () => Date.now(), sleep = sleepSyncMs, pollMs = DEFAULT_ACQUIRE_POLL_MS,
  timeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS, windowMs = GH_POINTS_WINDOW_MS,
}) {
  mkdirSync(lockRoot, { recursive: true });
  const startedAt = now();
  for (;;) {
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    const locked = reserve(lockRoot, WRITE_BUDGET_LOCK_KEY, owner, nowMs, nowIso, pid, 'unknown', POINTS_BUDGET_LOCK_LEASE_MINUTES);
    let decision = null;
    if (locked.ok) {
      try {
        decision = decideGhPointsSpend({ state: readGhWriteBudgetState(lockRoot), points: 1, nowMs, budgetPerMin, windowMs });
        if (decision.allowed) writeGhWriteBudgetState(lockRoot, decision.nextState);
      } finally {
        releaseLockDir(lockRoot, WRITE_BUDGET_LOCK_KEY);
      }
    }
    if (decision && decision.allowed) return { ok: true, waitedMs: nowMs - startedAt, timedOut: false };
    if (nowMs - startedAt >= timeoutMs) return { ok: false, waitedMs: nowMs - startedAt, timedOut: true };
    sleep(decision ? Math.min(pollMs, Math.max(1, decision.waitMs)) : pollMs);
  }
}

// ── the SHARED primary-budget backoff (#gh-graphql-budget) — one exhausted call backs EVERYONE off ──────────────
//
// Live 2026-09-27 04:31-05:20Z: the App installation's GraphQL budget (6100 points/hour) hit 0 and every caller
// kept retrying on its OWN guessed backoff (2s, 4s, 8s, 16s — `retry_exhausted` x21 for the drain's `pr list`
// alone), none of which can succeed before the hourly reset: GitHub answers "API rate limit ALREADY exceeded"
// until then. A PRIMARY exhaustion is a fact about the whole identity's bucket, not about one call — so the first
// caller to see it records the bucket's real reset time (read from the in-band GraphQL `rateLimit` field — NOT
// the REST `/rate_limit` endpoint, whose `graphql` entry reported 6059/6100 remaining at the same moment the
// GraphQL bucket itself said 0/6100, with a different reset: a separate, non-authoritative window) and every
// later call on that identity+resource fails FAST, without touching the network, until then.

/** Fallback block length when the reset time cannot be read (the probe itself failed). */
export const DEFAULT_BUDGET_BLOCK_FALLBACK_MS = 5 * 60_000;
/** Ceiling on any recorded block — a primary window is an hour; a bogus reset must never park the fleet longer. */
export const MAX_BUDGET_BLOCK_MS = 65 * 60_000;

/**
 * Which GitHub rate-limit RESOURCE a `gh` argv spends — `graphql` (every `gh pr …`/`gh issue …`/`gh repo …`/
 * `gh project …` subcommand and `gh api graphql`) or `core` (REST: `gh api <path>`, `gh run …`, `gh label …`,
 * `gh workflow …`, …). PURE. The two are separate buckets, so exhausting one must never block the other.
 * @param {string[]} args
 * @returns {'graphql'|'core'}
 */
export function classifyGhResource(args) {
  const a = Array.isArray(args) ? args.map(String) : [];
  // Not led by 'pr': multi-repo-scan reads any `['pr', …]` literal as gh argv and would flag it as repo-less.
  if (['issue', 'pr', 'repo', 'project', 'search'].includes(a[0])) return 'graphql';
  if (a[0] === 'api') {
    const positional = a.slice(1).filter((t, i, arr) => !t.startsWith('-') && !(i > 0 && /^-(X|H|f|F|q|t|p)$|^--(method|header|field|raw-field|jq|template|input|preview|hostname|cache)$/.test(arr[i - 1])));
    return positional[0] === 'graphql' ? 'graphql' : 'core';
  }
  return 'core';
}

/**
 * Is `text` GitHub's PRIMARY (hourly budget) exhaustion — never the secondary/abuse limit, which clears in
 * seconds and keeps its own retry path — and for which resource? PURE.
 * @param {string|null|undefined} text
 * @returns {'graphql'|'core'|null}
 */
export function primaryExhaustedResource(text) {
  const s = String(text ?? '');
  if (/secondary rate limit|abuse detection/i.test(s)) return null;
  if (!/API rate limit (already )?exceeded/i.test(s)) return null;
  return /GraphQL:/i.test(s) ? 'graphql' : 'core';
}

/** A stable, NON-SECRET label for the auth identity whose bucket a call spends: `app` for a GitHub App
 *  installation token (`ghs_…`), a short hash for any other explicit token, `default` for gh's own stored login. */
export function ghAuthIdentity(env = process.env) {
  const token = String((env && (env.GH_TOKEN || env.GITHUB_TOKEN)) || '');
  if (!token) return 'default';
  if (token.startsWith('ghs_')) return 'app';
  return `t-${createHash('sha256').update(token).digest('hex').slice(0, 12)}`;
}

export function budgetBlockPath(lockRoot, identity, resource) {
  return join(lockRoot, `budget-block-${String(identity).replace(/[^A-Za-z0-9_-]/g, '_')}-${resource}.json`);
}

/** The active block for identity+resource at `nowMs`, or null (absent, corrupt, or already past). Never throws. */
export function readBudgetBlock(lockRoot, identity, resource, nowMs = Date.now()) {
  try {
    const b = JSON.parse(readFileSync(budgetBlockPath(lockRoot, identity, resource), 'utf8'));
    return Number.isFinite(b?.untilMs) && b.untilMs > nowMs ? b : null;
  } catch {
    return null;
  }
}

/** Record a block (best-effort, never throws). `untilMs` is clamped to (now, now + MAX_BUDGET_BLOCK_MS]. */
export function writeBudgetBlock(lockRoot, identity, resource, { untilMs, nowMs = Date.now(), source = 'probe', op = null, caller = null } = {}) {
  const until = Math.min(nowMs + MAX_BUDGET_BLOCK_MS, Number.isFinite(untilMs) && untilMs > nowMs ? untilMs : nowMs + DEFAULT_BUDGET_BLOCK_FALLBACK_MS);
  const rec = { identity, resource, untilMs: until, until: new Date(until).toISOString(), detectedAt: new Date(nowMs).toISOString(), source, op, caller };
  try { mkdirSync(lockRoot, { recursive: true }); writeFileSync(budgetBlockPath(lockRoot, identity, resource), JSON.stringify(rec) + '\n', 'utf8'); } catch { /* best-effort */ }
  return rec;
}

/** The argv that reads the bucket's REAL remaining+reset (the GraphQL `rateLimit` field answers even at 0). */
export function budgetProbeArgs(resource) {
  return resource === 'graphql'
    ? ['api', 'graphql', '-f', 'query=query{rateLimit{limit remaining resetAt}}']
    : ['api', 'rate_limit', '--jq', '.resources.core'];
}

/** Parse a {@link budgetProbeArgs} response → `{remaining, resetMs}` or null. PURE. */
export function parseBudgetProbe(resource, stdout) {
  try {
    const j = JSON.parse(String(stdout ?? ''));
    if (resource === 'graphql') {
      const rl = j?.data?.rateLimit;
      return rl && typeof rl.remaining === 'number' ? { remaining: rl.remaining, resetMs: Date.parse(rl.resetAt) } : null;
    }
    return typeof j?.remaining === 'number' ? { remaining: j.remaining, resetMs: Number(j.reset) * 1000 } : null;
  } catch {
    return null;
  }
}

/** The one-line stderr a budget-blocked call returns instead of calling GitHub — still rate-limit shaped, so
 *  every existing classifier (`isRateLimitShaped`, the drain's gh-error text) reads it exactly as before. */
export function budgetBlockedMessage(block) {
  return `gh-throttle: GitHub ${block.resource} API rate limit exceeded for this identity — shared backoff until ${block.until}, call not sent (#gh-graphql-budget)\n`;
}

/** Resolve `untilMs` for a primary exhaustion: GitHub's own reset header when the failure carried one, else the
 *  probe. Returns null when the probe shows budget left (the exhaustion already cleared → no block). */
function resolveBudgetBlockUntil({ headers, resource, probe }) {
  const signal = classifyRateLimitSignal(headers);
  if (signal.kind === 'primary' && Number.isFinite(signal.resetEpochSec)) return { untilMs: signal.resetEpochSec * 1000, source: 'header' };
  let parsed = null;
  try { parsed = parseBudgetProbe(resource, probe(budgetProbeArgs(resource))); } catch { parsed = null; }
  if (parsed && parsed.remaining > 0) return null;
  if (parsed && Number.isFinite(parsed.resetMs)) return { untilMs: parsed.resetMs, source: 'probe' };
  return { untilMs: NaN, source: 'fallback' };
}

// ── call-volume / exhausted-retry recording (#3670) ────────────────────────────────────────────────────────

/**
 * Append one line to the sidecar call log (`calls.jsonl`) — best-effort, mirrors `recordGhThrottleMetric`'s
 * own discipline: a logging failure must never turn a working `gh` call into a broken one, so this never
 * throws past the call. `outcome` is `'call'` for every attempt (success or failure alike — the point is
 * VOLUME, not just failures) or `'retry_exhausted'` for the one extra line appended when a rate-limit-shaped
 * failure gives up after `maxAttempts`.
 * #gh-write-burst — `caller` (see {@link deriveGhCaller}) and `w` (whether {@link classifyGhWrite} classified
 * this call as a mutation) are recorded on every line so the NEXT burst is attributable and its write-share
 * visible directly from `calls.jsonl`, without the multi-log/multi-transcript correlation this incident needed.
 * @param {string} logPath
 * @param {{op:string, attempt:number, points:number, outcome:('call'|'retry_exhausted'|'fail_open'), ok?:boolean, caller?:string, w?:boolean}} entry
 */
export function recordGhCallLogEntry(logPath, entry) {
  try {
    appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  } catch {
    /* best-effort — see docblock */
  }
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
 *   @param {string} [opts.throttle.repo]             IGNORED for the lock root (now cwd-independent — see ghThrottleLockRoot)
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
 *   @param {number} [opts.throttle.points]            REST points this call costs (default 1 — see the module
 *     header's #3670 section; pass the real cost for a known-heavier call, e.g. a 100-item list is 4)
 *   @param {number} [opts.throttle.budgetPerMin]      override the points-budget-per-minute (tests)
 *   @param {string} [opts.throttle.op]                low-cardinality label for the sidecar log (default:
 *     derived from `args`, e.g. "pr view")
 *   @param {string} [opts.throttle.logPath]           override the sidecar call-log path (tests)
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
  // #4309 — one invocation id across every retry of this call. Only the REAL exec passes it down (so a nested
  // shim → passthrough record says `outer: <inv>`); an injected test exec still sees `opts` byte-unchanged.
  const inv = randomUUID().slice(0, 12);
  const exec = throttle.exec || ((a, o) => execFileSync('gh', a, { ...o, env: { ...(o.env || process.env), [GH_OUTER_INV_ENV]: inv } }));
  const points = throttle.points != null ? throttle.points : 1;
  const budgetPerMin = throttle.budgetPerMin != null ? throttle.budgetPerMin : resolveGhPointsBudgetPerMin(env);
  const pointsWindowMs = throttle.pointsWindowMs != null ? throttle.pointsWindowMs : GH_POINTS_WINDOW_MS;
  const logPath = throttle.logPath || ghThrottleLogPath(lockRoot);
  // Header self-calibration is OPT-IN per call (see the module header) — OFF unless a caller explicitly asks,
  // so every existing adopter's byte-identical-stderr contract (proven in gh-throttle.fidelity.test.mjs) is
  // unaffected by default. `opLabel` is the low-cardinality telemetry tag; a caller may override it
  // (`throttle.op`), else it derives from the gh subcommand itself (e.g. "pr create", "pr view").
  const calibrateHeaders = !!throttle.calibrateHeaders;
  const headerCapMs = throttle.headerCapMs != null ? throttle.headerCapMs : resolveHeaderWaitCapMs(env);
  const opLabel = throttle.op || (Array.isArray(args) ? args.slice(0, 2).join(' ') : 'unknown');
  const gateOpts = { warn: throttle.warn, logPath, op: opLabel };
  // #gh-write-burst — a THIRD, independent gate over MUTATIONS only (see DEFAULT_GH_WRITE_BUDGET_PER_MIN's own
  // doc comment), plus best-effort caller attribution recorded on every log line below.
  const isWrite = classifyGhWrite(args);
  const writeBudgetPerMin = throttle.writeBudgetPerMin != null ? throttle.writeBudgetPerMin : resolveGhWriteBudgetPerMin(env);
  const caller = deriveGhCaller(throttle, env);
  // #gh-graphql-budget — the shared primary-budget backoff (see that section above).
  const resource = classifyGhResource(args);
  const identity = ghAuthIdentity((execOpts && execOpts.env) || env);
  const blocked = readBudgetBlock(lockRoot, identity, resource, now());
  if (blocked) {
    recordGhCallLogEntry(logPath, { op: opLabel, attempt: 0, points: 0, outcome: 'budget_blocked', resource, caller, w: isWrite });
    const e = new Error(budgetBlockedMessage(blocked).trim());
    e.status = 1; e.stderr = budgetBlockedMessage(blocked); e.stdout = ''; e.budgetBlocked = blocked;
    throw e;
  }

  // FAIL OPEN (see `failOpenGate`): an unusable lock root means this call runs ungated, never not at all.
  const gated = failOpenGate('lock-root setup', () => { mkdirSync(lockRoot, { recursive: true }); return true; }, { ...gateOpts, fallback: false, logPath: null });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    // The write-budget gate (writes only) and the points-budget gate both run BEFORE the concurrency slot — a
    // call waiting out either budget must not hold a scarce concurrency slot idle while it waits (same
    // reasoning as releasing the slot before a backoff sleep, below).
    const acq = gated ? failOpenGate('acquire', () => {
      if (isWrite) acquireGhWriteBudgetSync({ lockRoot, budgetPerMin: writeBudgetPerMin, owner, pid, now, sleep, pollMs, timeoutMs: acquireTimeoutMs, windowMs: pointsWindowMs });
      acquireGhPointsSync({ lockRoot, points, budgetPerMin, owner, pid, now, sleep, pollMs, timeoutMs: acquireTimeoutMs, windowMs: pointsWindowMs });
      return acquireGhSlotSync({ lockRoot, cap, owner, pid, pollMs, timeoutMs: acquireTimeoutMs, now, sleep });
    }, { ...gateOpts, fallback: { ok: false } }) : { ok: false };
    // Fail OPEN on an acquire timeout too — proceeding unslotted rather than stranding this `gh` call forever
    // (the residual-risk policy heavy-admission.mjs itself names: a fixed cap bounds concurrency and makes the
    // wait observable, it does not claim to eliminate contention).
    let result;
    let failure = null;
    try {
      // `GH_DEBUG=api` is added ONLY when this call opted into header calibration, and ONLY if the caller
      // did not already ask for a specific debug mode of its own — never silently overridden. It changes
      // nothing about a SUCCESSFUL call (stdout is untouched; execFileSync discards stderr on success either
      // way — see the module header), so this stays inert for the common case even when calibration is on.
      const callExecOpts = calibrateHeaders ? withDebugEnv(execOpts) : execOpts;
      result = exec(args, callExecOpts);
    } catch (e) {
      failure = e;
    } finally {
      if (acq.ok) failOpenGate('release', () => releaseGhSlotSync({ lockRoot, cap, owner }), gateOpts);
    }
    recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'call', ok: !failure, caller, w: isWrite, resource, id: identity, inv });
    if (!failure) {
      // #gh-graphql-budget — a landed write makes the shared open-PR snapshot stale for that repo.
      if (isWrite) markPrSnapshotDirty({ repo: repoFromGhArgs(args), env });
      return result;
    }

    const text = `${failure && failure.stderr ? String(failure.stderr) : ''}\n${failure && failure.message ? String(failure.message) : ''}`;
    if (!isRateLimitShaped(text)) throw failure;

    // A REAL signal (only ever present when `calibrateHeaders` put a `GH_DEBUG` trace into this failure's
    // stderr) beats the guessed backoff — see `calibratedBackoffMs`'s own docblock for the fallback contract.
    const headers = parseGhDebugResponseHeaders(failure && failure.stderr);

    // #gh-graphql-budget — a PRIMARY exhaustion cannot clear before the bucket's reset: record the shared block
    // and give up NOW instead of spending the retry ladder on calls GitHub will refuse.
    const exhausted = primaryExhaustedResource(text);
    if (exhausted) {
      const probe = throttle.probeBudget || ((probeArgs) => exec(probeArgs, { ...execOpts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const until = resolveBudgetBlockUntil({ headers, resource: exhausted, probe });
      if (until) {
        const rec = writeBudgetBlock(lockRoot, identity, exhausted, { untilMs: until.untilMs, nowMs: now(), source: until.source, op: opLabel, caller });
        recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'budget_exhausted', resource: exhausted, until: rec.until, caller, w: isWrite });
        recordGhThrottleMetric('gh.throttle.exhausted', 1, { op: opLabel, attempt, source: `primary-${exhausted}` });
        throw failure;
      }
    }

    if (attempt >= maxAttempts) {
      recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'retry_exhausted', caller, w: isWrite });
      recordGhThrottleMetric('gh.throttle.rate_limited', 1, { op: opLabel, attempt, source: classifyRateLimitSignal(headers).kind, outcome: 'exhausted' });
      recordGhThrottleMetric('gh.throttle.exhausted', 1, { op: opLabel, attempt });
      throw failure;
    }

    const backoff = calibratedBackoffMs({ headers, attempt, tuning: retryTuning, nowMs: now(), headerCapMs });
    recordGhThrottleMetric('gh.throttle.rate_limited', 1, { op: opLabel, attempt, source: backoff.source, outcome: 'retry' });
    recordGhThrottleMetric('gh.throttle.backoff_ms', backoff.ms, { op: opLabel, attempt, source: backoff.source, unit: 'ms' });

    // Sleep OUTSIDE the held slot — a multi-second backoff must not idle a scarce concurrency slot other
    // pending `gh` calls could use in the meantime.
    sleep(backoff.ms);
  }
}

/** Merge `GH_DEBUG=api` into an `execFileSync` opts bag, UNLESS the caller already set its own `GH_DEBUG` (an
 *  explicit caller choice always wins — this never overrides one). Used only when a call opted into header
 *  calibration (`throttle.calibrateHeaders`); see the module header for why this is never the default. */
function withDebugEnv(execOpts) {
  const baseEnv = execOpts.env || process.env;
  if (baseEnv.GH_DEBUG) return execOpts;
  return { ...execOpts, env: { ...baseEnv, GH_DEBUG: 'api' } };
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
 *
 * `bin` (#4064) — the executable to actually run, in place of the literal string `'gh'`. Lets a caller that
 * already resolved the REAL `gh` binary itself (`gh-app-shim.mjs#renderGhShimScript`'s generated shim, which
 * bakes in an absolute `REAL_GH` path at generation time specifically to never re-resolve `gh` off `PATH` —
 * see that module's header) hand this function that exact path, so the throttle's own internal spawn can
 * never accidentally re-resolve `gh` through the shim's own `PATH` override and recurse into itself. Default
 * `'gh'` (a PATH search) is unchanged for every existing direct/CLI caller.
 * @returns {{status:number, stdout:Buffer, stderr:Buffer}}
 */
export function runGhCliPassthrough(argv, { throttle = {}, spawn = spawnSync, bin = 'gh' } = {}) {
  const env = throttle.env || process.env;
  const repo = throttle.repo || process.cwd();
  const lockRoot = throttle.lockRoot || ghThrottleLockRoot(repo, env);
  const cap = throttle.cap != null ? throttle.cap : resolveGhCap(env);
  const maxBuffer = throttle.maxBuffer != null ? throttle.maxBuffer : DEFAULT_GH_CLI_MAX_BUFFER;
  const acquireTimeoutMs = throttle.acquireTimeoutMs != null ? throttle.acquireTimeoutMs : resolveAcquireTimeoutMs(env);
  const pollMs = throttle.pollMs != null ? throttle.pollMs : DEFAULT_ACQUIRE_POLL_MS;
  const maxAttempts = throttle.maxAttempts != null ? throttle.maxAttempts : resolveRetryMaxAttempts(env);
  const retryTuning = { ...resolveRetryTuning(env), ...(throttle.retryBaseMs != null ? { baseMs: throttle.retryBaseMs } : {}), ...(throttle.retryCapMs != null ? { capMs: throttle.retryCapMs } : {}) };
  const sleep = throttle.sleep || sleepSyncMs;
  const now = throttle.now || (() => Date.now());
  const pid = throttle.pid || process.pid;
  const owner = throttle.owner || `${pid}:${randomUUID()}`;
  const points = throttle.points != null ? throttle.points : 1;
  const budgetPerMin = throttle.budgetPerMin != null ? throttle.budgetPerMin : resolveGhPointsBudgetPerMin(env);
  const pointsWindowMs = throttle.pointsWindowMs != null ? throttle.pointsWindowMs : GH_POINTS_WINDOW_MS;
  const logPath = throttle.logPath || ghThrottleLogPath(lockRoot);
  const headerCapMs = throttle.headerCapMs != null ? throttle.headerCapMs : resolveHeaderWaitCapMs(env);
  const opLabel = throttle.op || (Array.isArray(argv) ? argv.slice(0, 2).join(' ') : 'unknown');
  const gateOpts = { warn: throttle.warn, logPath, op: opLabel };
  // #gh-write-burst — see runGhSync's identical wiring for the full rationale.
  const isWrite = classifyGhWrite(argv);
  const writeBudgetPerMin = throttle.writeBudgetPerMin != null ? throttle.writeBudgetPerMin : resolveGhWriteBudgetPerMin(env);
  const caller = deriveGhCaller(throttle, env);
  // #gh-graphql-budget — the shared primary-budget backoff (see runGhSync's identical wiring).
  const resource = classifyGhResource(argv);
  const identity = ghAuthIdentity(env);
  const blocked = readBudgetBlock(lockRoot, identity, resource, now());
  if (blocked) {
    recordGhCallLogEntry(logPath, { op: opLabel, attempt: 0, points: 0, outcome: 'budget_blocked', resource, caller, w: isWrite });
    return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from(budgetBlockedMessage(blocked)) };
  }

  // FAIL OPEN (see `failOpenGate`): an unusable lock root means this call runs ungated, never not at all.
  const gated = failOpenGate('lock-root setup', () => { mkdirSync(lockRoot, { recursive: true }); return true; }, { ...gateOpts, fallback: false, logPath: null });

  // #4309 — cost-header capture. The child inherits `process.env` (no `env` option), so THAT is where a caller's
  // own `GH_DEBUG` would be: when set, it is left alone and relayed untouched (never stripped). Otherwise this
  // turns `GH_DEBUG=api` on, reads the free `X-Ratelimit-*` headers, and strips ONLY its own trace back out.
  const capture = resolveCostHeaderCapture(env) && !process.env.GH_DEBUG;
  // The trace echoes every request and response body, pretty-printed, into stderr — so a payload that fits
  // `maxBuffer` can still overflow it through stderr alone and fail a call that succeeds without capture
  // (PR #2851 review). The child gets headroom for the trace; stdout's own cap is re-applied after the spawn.
  const spawnOpts = capture
    ? { stdio: ['inherit', 'pipe', 'pipe'], maxBuffer: maxBuffer * DEBUG_CAPTURE_BUFFER_FACTOR, env: { ...process.env, GH_DEBUG: 'api' } }
    : { stdio: ['inherit', 'pipe', 'pipe'], maxBuffer };
  const inv = randomUUID().slice(0, 12);
  const outer = env[GH_OUTER_INV_ENV] || process.env[GH_OUTER_INV_ENV] || null;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const acq = gated ? failOpenGate('acquire', () => {
      if (isWrite) acquireGhWriteBudgetSync({ lockRoot, budgetPerMin: writeBudgetPerMin, owner, pid, now, sleep, pollMs, timeoutMs: acquireTimeoutMs, windowMs: pointsWindowMs });
      acquireGhPointsSync({ lockRoot, points, budgetPerMin, owner, pid, now, sleep, pollMs, timeoutMs: acquireTimeoutMs, windowMs: pointsWindowMs });
      return acquireGhSlotSync({ lockRoot, cap, owner, pid, pollMs, timeoutMs: acquireTimeoutMs, now, sleep });
    }, { ...gateOpts, fallback: { ok: false } }) : { ok: false };
    let r;
    try {
      r = spawn(bin, argv, spawnOpts);
    } finally {
      if (acq.ok) failOpenGate('release', () => releaseGhSlotSync({ lockRoot, cap, owner }), gateOpts);
    }
    if (r.error) throw r.error; // e.g. `gh` not on PATH — not a `gh`-level failure to retry
    const stdoutOverflow = capture && r.stdout && r.stdout.length > maxBuffer;
    const rawStderrText = r.stderr ? r.stderr.toString('utf8') : '';
    // Classify on the STRIPPED text (what the caller would have seen without debug): the raw trace includes
    // response bodies, and a PR title saying "API rate limit exceeded" must never trigger a retry or a block.
    const stripped = capture ? stripGhDebug(rawStderrText) : null;
    const stderrText = stripped ? stripped.stderr : rawStderrText;
    // Byte-for-byte: the original buffer is relayed whenever nothing was stripped (no utf8 round trip).
    const stderrOut = stripped && stripped.stderr !== rawStderrText ? Buffer.from(stripped.stderr, 'utf8') : (r.stderr || Buffer.alloc(0));
    const failed = typeof r.status === 'number' && r.status !== 0;
    recordGhCallLogEntry(logPath, {
      op: opLabel, attempt, points, outcome: 'call', ok: !failed && !stdoutOverflow, caller, w: isWrite, resource, id: identity, inv,
      ...(outer ? { outer } : {}), ...(stripped ? { rl: rateLimitRecords(stripped.responses) } : {}),
    });
    // The call ran and spent points, so it is logged above before the overflow is raised.
    if (stdoutOverflow) throw captureStdoutOverflow(bin, argv);
    if (!failed && isWrite) markPrSnapshotDirty({ repo: repoFromGhArgs(argv), env }); // #gh-graphql-budget
    if (!failed || !isRateLimitShaped(stderrText)) {
      return { status: r.status == null ? (r.signal ? 128 : 1) : r.status, stdout: r.stdout || Buffer.alloc(0), stderr: stderrOut };
    }
    const headers = parseGhDebugResponseHeaders(rawStderrText); // the LAST response block's headers, pre-strip
    // #gh-graphql-budget — PRIMARY exhaustion → record the shared block and return now (see runGhSync).
    const exhausted = primaryExhaustedResource(stderrText);
    if (exhausted) {
      const probe = throttle.probeBudget || ((probeArgs) => {
        const pr = spawn(bin, probeArgs, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer });
        return pr && pr.status === 0 && pr.stdout ? pr.stdout.toString('utf8') : '';
      });
      const until = resolveBudgetBlockUntil({ headers, resource: exhausted, probe });
      if (until) {
        const rec = writeBudgetBlock(lockRoot, identity, exhausted, { untilMs: until.untilMs, nowMs: now(), source: until.source, op: opLabel, caller });
        recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'budget_exhausted', resource: exhausted, until: rec.until, caller, w: isWrite });
        recordGhThrottleMetric('gh.throttle.exhausted', 1, { op: opLabel, attempt, source: `primary-${exhausted}` });
        return { status: r.status == null ? 1 : r.status, stdout: r.stdout || Buffer.alloc(0), stderr: stderrOut };
      }
    }
    if (attempt >= maxAttempts) {
      recordGhCallLogEntry(logPath, { op: opLabel, attempt, points, outcome: 'retry_exhausted', caller, w: isWrite });
      recordGhThrottleMetric('gh.throttle.rate_limited', 1, { op: opLabel, attempt, source: classifyRateLimitSignal(headers).kind, outcome: 'exhausted' });
      recordGhThrottleMetric('gh.throttle.exhausted', 1, { op: opLabel, attempt });
      return { status: r.status == null ? (r.signal ? 128 : 1) : r.status, stdout: r.stdout || Buffer.alloc(0), stderr: stderrOut };
    }
    const backoff = calibratedBackoffMs({ headers, attempt, tuning: retryTuning, nowMs: now(), headerCapMs });
    recordGhThrottleMetric('gh.throttle.rate_limited', 1, { op: opLabel, attempt, source: backoff.source, outcome: 'retry' });
    recordGhThrottleMetric('gh.throttle.backoff_ms', backoff.ms, { op: opLabel, attempt, source: backoff.source, unit: 'ms' });
    sleep(backoff.ms);
  }
}

function parseThrottleEnvRepo() {
  return process.env.WE_GH_THROTTLE_OWNER_REPO || process.cwd();
}

/** #4064 — `gh-app-shim.mjs`'s generated shim invokes this CLI with the REAL `gh` binary's own absolute path
 *  in `WE_GH_THROTTLE_GH_BIN` (never the bare string `'gh'`, which would resolve back through the shim's own
 *  `PATH` override and recurse). Every other caller (a direct `node scripts/lib/gh-throttle.mjs <argv>`
 *  invocation, unchanged) leaves this unset and gets the pre-existing `'gh'` PATH search. */
function parseThrottleEnvBin() {
  return process.env.WE_GH_THROTTLE_GH_BIN || 'gh';
}

async function main(argv) {
  const repo = parseThrottleEnvRepo();
  const owner = process.env.WE_GH_THROTTLE_OWNER || `${process.pid}:${randomUUID()}`;
  const bin = parseThrottleEnvBin();
  // #gh-write-burst — `argv[1]` for THIS process is always `gh-throttle.mjs` itself (see `deriveGhCaller`), so
  // the standalone CLI passthrough (the gh App shim's own call path, #4064) is the one population that needs an
  // explicit caller signal from its invoker rather than getting it for free from its own script path.
  const caller = process.env.WE_GH_THROTTLE_CALLER || undefined;
  const { status, stdout, stderr } = runGhCliPassthrough(argv, { throttle: { repo, owner, caller }, bin });
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
//
//   4. #4064 — `we:scripts/lib/gh-app-shim.mjs#renderGhShimScript`'s GENERATED shim (the `PATH`-shadowing `gh`
//      wrapper every dispatched session resolves a bare `gh` command to) now routes BOTH of its own real-`gh`
//      invocations (the tokened attempt and the inherited-auth fallback) through THIS CLI, via
//      `WE_GH_THROTTLE_GH_BIN=<the shim's own resolved REAL_GH path>` (see {@link parseThrottleEnvBin} above) —
//      so every `gh` call ANY dispatched session makes is now both on the App login AND paced by this same
//      cross-process cap, with no call-site migration needed at all (unlike adopters 1-3 above, which each
//      had to import and call this module themselves).
