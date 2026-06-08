/**
 * Shared fixtures for the Loader → Background Task Surface handoff (producer
 * side). Imported by BOTH the unit suite and the conformance playground so the
 * invariants they exercise and the behavior they demo can never drift (the same
 * demo-first anti-drift split the surface's `mock-loader.ts` uses).
 *
 * Unlike the surface fixtures (which script a *mock* handle), these drive a
 * **real** `ResourceLoader` through `backgroundLoad` into a **real**
 * `<background-tasks>` surface — the producer half this item wires. The only
 * shared lever is a controllable promise so the async boundary is deterministic.
 *
 * @module blocks/resource-loader/__fixtures__
 */

/** A promise whose settlement the driver controls (the async work stand-in). */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/** Create a controllable promise — the test/demo's lever over "async work". */
export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A named scenario the playground renders and the suite asserts. */
export interface HandoffScenario {
  id: string;
  title: string;
  note: string;
  /** The invariant the badge proves. */
  invariant: string;
}

/**
 * Conformance scenarios for the producer handoff — each names an invariant of
 * the escalation contract: fast loads don't escalate, slow loads register and
 * resolve, failures surface and retry re-runs the real load.
 */
export const handoffScenarios: HandoffScenario[] = [
  {
    id: 'escalate-on-async',
    title: 'Slow load escalates to the rail',
    note: 'A load that crosses the debounce threshold registers a live entry, then resolves to success.',
    invariant: 'loading → background-task-register → entry active → success',
  },
  {
    id: 'fast-load-no-escalate',
    title: 'Fast load never escalates',
    note: 'A load that resolves before the threshold never enters loading, so no entry is registered.',
    invariant: 'resolves < threshold → no register → rail stays empty',
  },
  {
    id: 'error-then-retry',
    title: 'Failure surfaces and retry re-runs the load',
    note: 'A failed background load shows a sticky error; the surface retry affordance re-invokes the real loader.',
    invariant: 'error → sticky entry → retry → loader.load() re-run → active again',
  },
];
