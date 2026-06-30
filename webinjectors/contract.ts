/**
 * webinjectors — the reactive **consume()/provide() handle**, pure-contract half (#1829, ruling #1798).
 *
 * Types and interfaces only: fully **compile-erased** (no runtime emit) so it can become the
 * `@webeverything/contracts/webinjectors` entry (#872/#874) that FUI depends on (the FUI→WE arrow) —
 * exactly like `identity/contract.ts` and `webcontexts/contract.ts`. The runtime half — the
 * `Injector.consume()` / `provide()` impl and the live value source — is impl and lives in FUI
 * (`fui:plugs/webinjectors` + `fui:plugs/webcontexts`); only this contract crosses the seam (WE holds
 * zero standard implementation).
 *
 * This declares **the shape a reactive `consume()` returns** — the one design call ruled by #1798:
 * *is the reactive handle a thenable?* The answer is **no, by construction**. The handle is the
 * {@link Consumable} below: a NON-thenable object that
 *
 *  - exposes the **current** provided value synchronously via {@link Consumable.value} (a live re-read,
 *    matching TC39 Signals `.get()` / RxJS `BehaviorSubject.value` — value-first), and
 *  - lets a consumer **wait for the next** `provide()` via the *explicit* `await consumable.next()`
 *    ({@link Consumable.next}), and
 *  - **streams** future provides via `for await…of` through `Symbol.asyncIterator`
 *    ({@link Consumable.[Symbol.asyncIterator]}).
 *
 * The `await consumable`-hangs-forever footgun is **impossible by construction**: the handle has no
 * `get then()`, so it is not a thenable and `await consumable` cannot resolve into a pending state (and
 * an `async consume()` cannot have its returned promise *follow* a thenable handle's never-settling
 * `then`). Removing the one broken spelling (`await consumable`) is the only restriction; the value-first
 * read is retained. This is distinct from the subscribe-based `Consumable` in `resources/contract.ts`
 * (the Apollo-Link transport observable, #455) — a different concept that is intentionally not merged.
 *
 * No new entity/protocol/intent: this refines the existing `webinjectors`/`webcontexts` plug API.
 */

/**
 * The reactive handle returned by a reactive `consume(key)` — a NON-thenable view over a provided value
 * that updates as `provide()` is re-called. Read current via {@link value}, await the next via
 * {@link next}, stream future provides via `for await…of` (`Symbol.asyncIterator`).
 *
 * Crucially this interface declares **no `then`** — it is deliberately not a thenable, which is what makes
 * `await consumable` (a now-vs-next ambiguity) impossible to write. Wait for the *next* provide with the
 * explicit `await consumable.next()`; read the *current* value synchronously with `consumable.value`.
 *
 * @typeParam T — the provided value's type (the provider seam's value shape).
 */
export interface Consumable<T> {
  /**
   * The **current** provided value, re-read live on each access (a synchronous pull — the latest value a
   * `provide()` set, never a frozen snapshot). Matches Signals `.get()` / `BehaviorSubject.value`.
   */
  readonly value: T;

  /**
   * Resolve with the **next** value a future `provide()` supplies (not the current one). This is the
   * *explicit* wait-for-next — the safe replacement for the removed `await consumable` spelling. Resolves
   * once, on the next provide after the call; call again to await the one after that.
   */
  next(): Promise<T>;

  /**
   * Stream **future** provided values — drive with `for await (const v of consumable)`. Each iteration
   * yields the next `provide()`'s value; the async iterator never yields the already-current value as its
   * first step (use {@link value} for that), keeping now-vs-next unambiguous.
   */
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

/**
 * The provide side of the seam — sets the value the matching {@link Consumable} reflects. Each call
 * updates {@link Consumable.value} and wakes any pending {@link Consumable.next} / `for await…of`
 * consumers with the new value.
 *
 * @typeParam T — the provided value's type (must match the consuming {@link Consumable}).
 */
export interface Provide<T> {
  (value: T): void;
}

/**
 * The **WC-CG Context Protocol** alignment surface (#1968, ratified under #1963 case-6c). Type-only,
 * compile-erased: it declares the *standards-track wire shape* the injector's zero-node resolution path
 * mirrors, so the plug can be **deprecated + migrated to native** when the Web Components Community Group
 * Context Protocol ships (plug-to-direction — #95 / #1963 item 7). The runtime listener + event class that
 * realise this shape are impl and live in FUI (`fui:plugs/webinjectors/ContextProtocol.ts`); only this
 * contract crosses the seam (WE holds zero standard implementation).
 *
 * Resolution semantics: a consumer dispatches a *bubbling, composed* `context-request` event carrying a
 * {@link ContextRequest.context} key and a {@link ContextRequest.callback}; the **nearest ancestor** that
 * can satisfy the key invokes the callback with the value and stops propagation — **zero added node** (no
 * `<provider>` wrapper; any existing ancestor is the provider). This is the `@lit/context`-proven mechanism.
 * The pre-existing DOM-walk injector chain stays as the **cheap-node `display:contents` fallback**, not the
 * primary path.
 */

/** The WC-CG event name — the single source of truth producers and consumers key on. */
export type ContextRequestEventType = 'context-request';

/**
 * The callback a provider invokes with the resolved value. The optional `unsubscribe` is the WC-CG
 * subscribe-to-future-values slot; WE's injector resolves once today, so it is omitted on the one-shot path
 * — the slot is retained for migration fidelity to the native surface.
 *
 * @typeParam T — the resolved context value's type.
 */
export interface ContextCallback<T> {
  (value: T, unsubscribe?: () => void): void;
}

/**
 * The declared shape of a `context-request` event — the consumer side of the protocol. A non-DOM,
 * compile-erased view of the bubbling event the injector answers; the FUI runtime's `ContextRequestEvent`
 * (an `Event` subclass) structurally satisfies this.
 *
 * @typeParam T — the resolved context value's type for {@link context}.
 */
export interface ContextRequest<T> {
  /** The context key being requested (the injector's provider key, e.g. `customContexts:theme`). */
  readonly context: string;
  /** Invoked by the nearest ancestor provider with the resolved value. */
  readonly callback: ContextCallback<T>;
  /** WC-CG: when true the consumer wants future updates too. One-shot today; carried for fidelity. */
  readonly subscribe: boolean;
}
