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
