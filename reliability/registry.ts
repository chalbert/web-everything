/**
 * `CustomRecoveryHandlerRegistry` (standalone model, #1052) — the swap point of the Error Recovery
 * protocol (#1019, contract #1051).
 *
 * Named handlers register here in **priority order**; on a failure the registry walks them and delegates
 * to the **first that accepts** (`tryRecover` returns a non-null `RecoveryResult`). It is the sibling of
 * the `CustomGuardRegistry` and a peer of the other standalone protocol models — one shared, injectable
 * service every recovering operation delegates to, rather than each consumer baking its own retry logic.
 * Like those planes this is a dependency-free model of the contract: the runtime `customRecovery` plug
 * fulfils the same `define`/`values`/`recover` surface as a core `CustomRegistry`, so the dispatch policy
 * has one home and cannot drift.
 *
 * Two rulings from the page (`project-webreliability.njk`) are pinned here, not redecided:
 *  - **Registry, not chain (first-that-accepts):** `values()` gives ordered iteration; `recover()` walks
 *    it and returns the first non-null result. No purpose-built chain object — registration order is the
 *    priority, explicit and reviewable. Mirrors `CustomExpressionParserRegistry.tryParse` / route matching.
 *  - **No default handlers:** the protocol ships none; an empty registry recovers nothing (`recover`
 *    returns `null`) until the consuming project `define()`s its handlers (HTTP retry, circuit breaker,
 *    offline queue — all impl). Composition across handlers is an author-ordered composite handler
 *    (#1032 Fork 3), NOT protocol-level orchestration — the registry stays single-dispatch.
 *
 * The contract is **async/trust-crossing**: `recover` runs a handler's `tryRecover` and passes the answer
 * through `assertRecoveryResult` so a misbehaving handler is caught at the seam (a malformed result is a
 * thrown `RecoveryResultError`, never a silent bad outcome driving the consumer).
 */
import type { CustomRecoveryHandler, RecoveryContext, RecoveryError, RecoveryResult } from './contract.js';
import { assertRecoveryResult } from './provider.js';

/** A scope asked for a recovery handler that was never registered. */
export class UnknownRecoveryHandlerError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown recovery handler "${key}" — registered handlers: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownRecoveryHandlerError';
  }
}

/**
 * Registry of named recovery handlers held in **registration (priority) order**. Mirrors the
 * `CustomRegistry` API the runtime plug extends (`localName` + `define`/`get`/`has`/`keys`/`values`),
 * kept self-contained here. Unlike the key-resolved `CustomGuardRegistry`, the primary entry point is the
 * ordered first-accept-wins `recover()` — there is no single "resolved" handler, the chain is the model.
 * Re-registering a key replaces that handler **in place** (preserves its priority slot), so a project can
 * swap one handler's impl without reordering the chain.
 */
export class CustomRecoveryHandlerRegistry {
  readonly localName = 'customRecovery';
  readonly #handlers = new Map<string, CustomRecoveryHandler>();

  /** Register a handler under its `key`, appended to the end of the priority order (lowest priority). */
  define(handler: CustomRecoveryHandler): void {
    this.#handlers.set(handler.key, handler); // Map preserves insertion order; re-set keeps the slot.
  }

  has(key: string): boolean {
    return this.#handlers.has(key);
  }

  keys(): string[] {
    return [...this.#handlers.keys()];
  }

  /** The registered handlers in priority order — the ordered iteration `recover()` walks. */
  values(): CustomRecoveryHandler[] {
    return [...this.#handlers.values()];
  }

  /** The handler registered under `key`, or `undefined`. */
  get(key: string): CustomRecoveryHandler | undefined {
    return this.#handlers.get(key);
  }

  /** The handler registered under `key`, or throw `UnknownRecoveryHandlerError` — never substitutes. */
  resolve(key: string): CustomRecoveryHandler {
    const handler = this.#handlers.get(key);
    if (!handler) throw new UnknownRecoveryHandlerError(key, this.keys());
    return handler;
  }

  /**
   * Walk the handlers in priority order and delegate to the **first that accepts** `error`. Each answer
   * crossing back is validated through `assertRecoveryResult` (the trust boundary). A handler returning
   * `null` declines without side effects and the next is tried; the first non-null `RecoveryResult` owns
   * the recovery and short-circuits the walk. Returns `null` when every handler declines (or none are
   * registered) — the consumer then surfaces the failure unrecovered. The single entry point a consumer
   * calls; it never touches a handler's `tryRecover` directly, so the trust-boundary check can't be skipped.
   */
  async recover(error: RecoveryError, context: RecoveryContext): Promise<RecoveryResult | null> {
    for (const handler of this.#handlers.values()) {
      const raw = await handler.tryRecover(error, context);
      const result = assertRecoveryResult(handler.key, raw);
      if (result !== null) return result; // first-that-accepts wins
    }
    return null; // every handler declined (or none registered) — no recovery
  }
}
