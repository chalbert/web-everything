/**
 * Reliability protocol — the **pure-contract half** (#1019, slice #1051).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/reliability` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`. The
 * runtime half — concrete handlers (HTTP retry, circuit breaker, offline queue) and the
 * `customRecovery` swap registry — is impl and lives in FUI; only the contract crosses the seam (npm
 * scope mirrors layer).
 *
 * Reliability standardizes **mechanism failure recovery**: an operation failed (network timeout, server
 * error, crash) and the system must decide whether to retry, queue, fall back, or surface it — distinct
 * from input *validation* (the user gave bad data; that is webvalidation). A consumer never contains
 * recovery logic: on failure it resolves the registry through the injector chain and delegates to the
 * **first handler that accepts** the error. This is a genuine Protocol — independent recovery strategies
 * conform to one `CustomRecoveryHandler` contract (a real provider seam, per the Project/Protocol bar).
 *
 * Three rulings are encoded here, not redecided downstream:
 *  - **Handlers are pluggable and ordered; first-accept-wins.** `tryRecover` returns `null` to decline
 *    *without side effects* (the next handler is tried) or a `RecoveryResult` to own the recovery.
 *    Registration order is the priority — explicit and reviewable, never hardwired into the standard.
 *  - **The outcome set is closed** (`retry | queued | fallback | abort`) so a conformant consumer can
 *    map each to the Reliability Intent UX dimensions (`recovering` / `fallback` / `failed`).
 *  - **The error-recovery *semantics* over the registry are now decided** (decision #1032). The contract
 *    normalizes the cross-handler *outputs* every consumer/UX reads — a **failure disposition** and an
 *    **in-flight recovery phase** — while every per-operation *mechanism* (raw classification, backoff
 *    math, composition order) stays private to handlers (adapter-as-normalization-hub). See the
 *    `FailureDisposition`, `RecoveryPhase`, and `RecoveryResult.disposition` definitions below.
 *
 * Decision #1032 — the three forks, encoded not redecided:
 *  - **Fork 1 (classification):** the contract carries a normalized `FailureDisposition`
 *    (`transient`/`terminal`/`deferred`) a handler maps the raw error into; the raw classification logic
 *    (HTTP status, `Retry-After`, DB error shapes) stays private. Disposition is **orthogonal** to the
 *    Reliability Intent `tolerance` axis (recoverability × user-impact severity — not 1:1).
 *  - **Fork 2 (surfacing):** the contract adds a `RecoveryPhase` discriminator on the in-flight
 *    `recovering` state — an **open meta-schema** with a minimal core (`retrying`/`queued`/`awaiting-manual`);
 *    `circuit-open` (and any future `rate-limited`) ship as **registered extensions**, NOT core, because
 *    the protocol bundles no circuit-breaker handler. Kept separate from data/loader status (the TanStack
 *    `status` vs `fetchStatus` split).
 *  - **Fork 3 (composition):** single-dispatch is preserved (the registry still picks the first handler
 *    that accepts); multi-concern cooperation is an **author-ordered composite handler** that nests (the
 *    Polly `PolicyWrap` analogue), NOT protocol-level orchestration — the wrap order is load-bearing, so
 *    the author owns it. A flat-escalation `'continue'` outcome is **not** authored here: it is a deferred,
 *    app-opt-in capability for a *different* need (flat fallthrough, not nesting), added additively only
 *    when a real app demonstrates it — not rejected, just YAGNI-deferred.
 *
 * Invariants unchanged: backoff math stays in handlers (the contract exposes only an opaque `delay`);
 * the runtime half — concrete handlers and the `customRecovery` swap registry — is impl and lives in FUI.
 */

/** The error that triggered recovery — opaque to the seam; a handler classifies it however it needs. */
export type RecoveryError = unknown;

/**
 * What a handler decided to do with an error. A closed set so a consumer can reflect each to the
 * Reliability Intent UX dimensions:
 *  - `retry` — re-run the operation (after an optional `delay`); `recovering`.
 *  - `queued` — the handler took ownership and will replay later (offline queue); `recovering`.
 *  - `fallback` — give up on recovery, render fallback content; `fallback`.
 *  - `abort` — terminal, surface the error; `failed`.
 */
export type RecoveryOutcome = 'retry' | 'queued' | 'fallback' | 'abort';

/**
 * **Fork 1 (#1032) — the normalized recoverability of a failure**, the UX-facing projection of a
 * handler's *private* classification. A handler maps the raw error (HTTP status, `Retry-After`, DB error
 * shapes — all private) into one of three dispositions; the consumer reads the disposition without
 * knowing how the handler decided it (adapter-as-normalization-hub):
 *  - `transient` — worth recovering (will likely succeed on a retry / reconnection).
 *  - `terminal` — give up; the failure won't resolve by retrying (e.g. a 4xx client error).
 *  - `deferred` — parked for later replay (an offline-queued operation awaiting reconnection).
 *
 * **Orthogonal** to the Reliability *Intent* `tolerance` axis (which is user-impact *severity*:
 * forgivable / degraded / terminal). Disposition is *recoverability*; tolerance is *severity*; the UX
 * reads both together — they are NOT 1:1 (a `transient` failure can still be `terminal`-severity to the
 * user, and a `terminal` failure can be `forgivable`).
 */
export type FailureDisposition = 'transient' | 'terminal' | 'deferred';

/**
 * **Fork 2 (#1032) — the core phases of an in-flight recovery** (the `recovering` observable state),
 * kept SEPARATE from data/loader status (the TanStack `status` vs `fetchStatus` split). This is the
 * *closed core* of an OPEN meta-schema:
 *  - `retrying` — a retry attempt is in flight or its backoff `delay` is elapsing.
 *  - `queued` — the operation is parked in an offline queue, awaiting reconnection replay.
 *  - `awaiting-manual` — recovery is paused pending a user-triggered retry affordance.
 *
 * `circuit-open` (and any future `rate-limited`) are **registered extensions**, not core members — the
 * protocol bundles no circuit-breaker handler, so those phases enter via registration when a handler that
 * produces them is installed (see {@link RecoveryPhase}).
 */
export type RecoveryPhaseCore = 'retrying' | 'queued' | 'awaiting-manual';

/**
 * **Fork 2 (#1032) — the open meta-schema for recovery phase.** A registered extension value (e.g.
 * `circuit-open`, surfaced by a FUI circuit-breaker handler) widens the union WITHOUT a contract break —
 * the `(string & {})` tail keeps the core members autocompletable while admitting registered extensions.
 * Mirrors the open-system stance of intents (standardize the meta-schema, not the closed list): a
 * conformant consumer binds to the phase it understands and treats unknown phases as generic `recovering`.
 */
export type RecoveryPhase = RecoveryPhaseCore | (string & {});

/**
 * Everything a handler needs to decide a recovery — pure context, no recovery logic. The consumer
 * supplies a fresh `AbortSignal` per attempt (AbortController is the cancellation primitive) and the
 * running attempt count so a handler can cap retries.
 */
export interface RecoveryContext {
  /** The failure that triggered recovery. */
  readonly error: RecoveryError;
  /** 0-based count of attempts already made — a handler caps retries off this. */
  readonly attempt: number;
  /** A fresh signal for this attempt; the consumer aborts the prior one before dispatching the next. */
  readonly signal?: AbortSignal;
  /** A stable identity for the failing operation (endpoint, task id) — handlers key state off it. */
  readonly operationId?: string;
}

/**
 * A handler's decision. `outcome` is mandatory; `delay` (ms) applies to `retry`/`queued`; `reason` is
 * advisory legibility. Returning `null` from `tryRecover` (not a `RecoveryResult`) is the *decline*.
 */
export interface RecoveryResult {
  readonly outcome: RecoveryOutcome;
  /**
   * **Fork 1 (#1032)** — the normalized recoverability of the failure (`transient`/`terminal`/`deferred`),
   * the handler's UX-facing projection of its private classification. Optional on the contract for
   * backward compatibility; a conformant handler SHOULD set it so the consumer can surface recoverability
   * independent of which handler ran. ORTHOGONAL to the Reliability Intent `tolerance` (severity) axis.
   */
  readonly disposition?: FailureDisposition;
  /**
   * **Fork 2 (#1032)** — the in-flight recovery phase to surface while `outcome` keeps the operation in
   * the `recovering` state (`retrying`/`queued`/`awaiting-manual` core, plus registered extensions like
   * `circuit-open`). Read by the Reliability + Loader Intent UX without knowing which handler produced it.
   */
  readonly phase?: RecoveryPhase;
  /** Milliseconds to wait before the next attempt (backoff) — applies to `retry`/`queued`. */
  readonly delay?: number;
  /** Advisory note surfaced for legibility / logging — never control flow. */
  readonly reason?: string;
}

/**
 * A recovery handler — the swappable provider. `tryRecover` inspects the error and either declines
 * (`null`, no side effects, next handler tried) or owns the recovery (a `RecoveryResult`). Concrete
 * handlers (HTTP retry, circuit breaker, offline queue) are impl and live in FUI; they are held in the
 * `customRecovery` registry in priority order and resolved through the injector chain.
 */
export interface CustomRecoveryHandler {
  /** Stable registration key / priority identity (`http-retry`, `circuit-breaker`, …). */
  readonly key: string;
  tryRecover(error: RecoveryError, context: RecoveryContext): Promise<RecoveryResult | null>;
}

// ── Offline-retry / resumable-transfer facets ──────────────────────────────────────────────────────
// Named contract shapes for the two stateful recovery categories the handler registry supports. The
// queue/transfer *engine* is impl (→ FUI); these types are the durable state a handler persists.

/**
 * A single operation parked by an offline-queue handler (`outcome: 'queued'`), to be replayed on
 * reconnection (`navigator.onLine`). The replay engine is impl; this is the persisted entry shape.
 */
export interface OfflineQueueEntry {
  /** Stable id so a replay is idempotent and de-dupable. */
  readonly id: string;
  /** The operation identity this entry will replay (mirrors `RecoveryContext.operationId`). */
  readonly operationId: string;
  /** Epoch-ms the operation was first enqueued — used for TTL / ordering on replay. */
  readonly enqueuedAt: number;
  /** Attempts already spent before queuing — carried so the backoff continues across reconnection. */
  readonly attempt: number;
}

/**
 * The resume state of a long, restartable transfer (chunked upload / download) a handler can recover by
 * continuing from the last acknowledged offset rather than restarting. The transfer engine is impl;
 * this is the checkpoint shape it persists.
 */
export interface ResumableTransferState {
  /** Stable transfer id, stable across the resume. */
  readonly id: string;
  /** Total byte length when known (`undefined` for an unknown-length stream). */
  readonly total?: number;
  /** Bytes confirmed transferred — the resume offset for the next attempt. */
  readonly transferred: number;
  /** An opaque server-issued token to resume against (e.g. an upload session URL), when the protocol provides one. */
  readonly resumeToken?: string;
}
