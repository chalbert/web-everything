/**
 * The #899 conformance **binding** contract — the per-implementer adapter the conformance-vector driver
 * dispatches a vector's steps to and reads observable surfaces from (epic #1576, slice #1596).
 *
 * Where {@link file://./schema.ts} defines the build-agnostic vector **shape** + corpus, this module defines
 * the build-agnostic **driver↔component** seam: the `ConformanceBinding` a runner sequences steps against,
 * the `ConformanceBindingFactory` that mints a fresh one per vector, and the `ConformanceClock` verb-contract
 * a binding schedules its async settles on. All three are **type-only contracts** — the standard's definition
 * of how ANY WE implementer is exercised (reads output as DATA, #1467/#817/WPT). The runnable *driver*
 * (`runConformanceVector` + `judgeConformanceTrace`) and the concrete `VirtualClock` **impl** live in a
 * neutral runner home per #1576-(2) (Plateau, #1597) — WE holds zero executable (#1282). A concrete binding
 * (e.g. FUI's `blocks/deck/deckConformance.ts`) `implements` these and imports them WE→implementer
 * (#700/#872).
 */
import type { ConformanceVector } from './schema';

/**
 * The clock-verb contract a Layer-2 binding schedules its async settles on (#899). A *temporal* vector
 * (`beginAsync … settlesInMs`) can only prove a stale result is dropped by running virtual time; the driver
 * advances this clock by hand and a binding's scheduled settles fire at the exact virtual instant the vector
 * expects, so the conformance check is reproducible without wall-clock timers. The runnable implementation
 * (`VirtualClock`) lives in the neutral runner home (#1576-(2) / #1597); this is only its contract.
 */
export interface ConformanceClock {
  /** The current virtual time in milliseconds. */
  readonly now: number;
  /** Schedule a callback to fire `delayMs` of virtual time from now. Returns a cancellation handle. */
  setTimeout(callback: () => void, delayMs: number): number;
  /** Cancel a scheduled callback. */
  clearTimeout(handle: number): void;
  /**
   * Advance virtual time by `ms`, firing every callback whose due time falls in `(now, now+ms]` in
   * chronological order and flushing microtasks between each, then leaving `now` at `now+ms`.
   */
  tickAsync(ms: number): Promise<void>;
  /** Fire every still-pending callback in order (advancing `now` to the last one's due time). */
  runAll(): Promise<void>;
}

/**
 * The #899 binding interface, **clock-free base**: the per-component adapter the driver dispatches a vector's
 * steps to and reads observable surfaces from. A binding interprets the action verbs (`setInput`, `setFacts`,
 * …) for ONE standard and reads its observable outcomes; the driver stays verb-agnostic (it only sequences
 * steps). Each implementer ships a binding per conformant standard; a test supplies a fake one.
 *
 * A **synchronous** standard — a facts→verdict engine (e.g. a DMN policy engine, #1784) whose vectors are
 * order-only (every step's `atMs` omitted ⇒ synchronous, per {@link file://./schema.ts}) — implements this
 * base directly: it has no temporal vectors, so it needs **no** {@link ConformanceClock}. Only a standard
 * with *temporal* vectors (`beginAsync … settlesInMs`) implements the clock-bearing {@link ConformanceBinding}
 * below. (Skeptic-corrected in #1784: the clock is welded to temporal observation and is dead weight for
 * synchronous logic, so the contract factors rather than carrying an unused clock everywhere.)
 */
export interface SynchronousConformanceBinding {
  /** Perform one action verb against the candidate (args are verb-specific). */
  dispatch(step: ConformanceVector['steps'][number]): void | Promise<void>;
  /**
   * Read one observable surface (`verdict`, `aria`, `renderedMessage`, `validity`, `state`, `events`, …) —
   * never an impl internal. `state` is the contract-vocabulary state used by `expect.finalState`.
   */
  observe(surface: string): unknown;
}

/**
 * The **temporal** binding: a {@link SynchronousConformanceBinding} plus the virtual {@link clock} a temporal
 * vector needs — the binding schedules its async settles on the same clock instance the driver advances. A
 * standard with no temporal vectors uses the clock-free base above instead.
 */
export interface ConformanceBinding extends SynchronousConformanceBinding {
  /** The shared clock the binding schedules async settles on (the same instance the driver advances). */
  readonly clock: ConformanceClock;
}

/**
 * Builds a fresh binding (clean candidate + clock) for each vector, so vectors don't bleed into each other.
 * Generic over the binding variant: defaults to the temporal {@link ConformanceBinding} (backward-compatible);
 * a synchronous standard parameterises it as `ConformanceBindingFactory<SynchronousConformanceBinding>`.
 */
export interface ConformanceBindingFactory<B extends SynchronousConformanceBinding = ConformanceBinding> {
  create(vector: ConformanceVector): B | Promise<B>;
}
