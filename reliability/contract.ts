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
 *  - **Scope is the handler registry only.** The deeper *protocol-level error-recovery seam* (how
 *    recovery composes across the protocol) is a SEPARATE design-gated slice held behind decision #1032
 *    — deliberately NOT defined here.
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
