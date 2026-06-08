/**
 * Shared fixtures for the Background Task Surface — a controllable mock of the
 * carried Loader state handle, plus a registration helper. Imported by BOTH the
 * unit tests and the conformance playground so the behavior they exercise and
 * the behavior they demo can never drift (the demo-first anti-drift split).
 *
 * The real handoff carries a *live* Loader machine; off-view the surface only
 * needs `getSnapshot`/`subscribe`/`retry`, so the mock implements exactly that
 * and lets a driver push snapshots on demand.
 *
 * @module blocks/background-task-surface/__fixtures__
 */

import type { LoaderSnapshot, LoaderStateHandle, ProgressMode } from '../types';

/** A scripted Loader handle whose snapshots are pushed by the test/demo driver. */
export class MockLoaderHandle implements LoaderStateHandle {
  #snapshot: LoaderSnapshot;
  #listeners = new Set<(s: LoaderSnapshot) => void>();
  /** How many times the surface delegated recovery to this handle. */
  retried = 0;

  constructor(initial: LoaderSnapshot = { state: 'active', progress: 0 }) {
    this.#snapshot = initial;
  }

  getSnapshot(): LoaderSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: (s: LoaderSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  retry(): void {
    this.retried++;
  }

  /** Push a new snapshot to all subscribers (the driver's lever). */
  emit(snapshot: LoaderSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }
}

/**
 * Dispatch a `background-task-register` handoff. Fired from `source` (defaults to
 * the surface itself) so the bubbling, nearest-ancestor resolution is exercised
 * exactly as a real descendant Loader would.
 */
export function registerTask(
  surface: Element,
  opts: {
    id: string;
    label: string;
    progress?: ProgressMode;
    handle: MockLoaderHandle;
    source?: Element;
  },
): void {
  const source = opts.source ?? surface;
  source.dispatchEvent(
    new CustomEvent('background-task-register', {
      bubbles: true,
      cancelable: false,
      detail: {
        id: opts.id,
        label: opts.label,
        progress: opts.progress ?? 'indeterminate',
        loaderState: opts.handle,
      },
    }),
  );
}

/** A named scenario the playground renders and the suite asserts. */
export interface TaskScenario {
  id: string;
  title: string;
  note: string;
  /** Attributes (dimensions/traits) the surface is configured with. */
  attrs: Record<string, string>;
  /** The invariant the badge proves. */
  invariant: string;
}

/**
 * Conformance scenarios — each names an invariant of the surface's contract,
 * including edge/negative paths (error stays, transient auto-clears, guard).
 */
export const taskScenarios: TaskScenario[] = [
  {
    id: 'transient-success',
    title: 'Transient success auto-clears',
    note: 'Default persistence: a successful entry announces, then auto-clears.',
    attrs: {},
    invariant: 'success → announced → entry removed (auto-clear)',
  },
  {
    id: 'sticky-success',
    title: 'Sticky success persists',
    note: 'withStickyEntries: a successful entry stays until dismissed.',
    attrs: { persistence: 'sticky' },
    invariant: 'success → entry persists until dismissed',
  },
  {
    id: 'error-sticky',
    title: 'Failure is always reviewable',
    note: 'An error entry is sticky regardless of persistence.',
    attrs: {},
    invariant: 'error → entry persists (sticky regardless)',
  },
  {
    id: 'batch-concurrent',
    title: 'Batch shows concurrent tasks',
    note: "withBatchAggregation: one task's failure does not abort the others.",
    attrs: { aggregation: 'batch' },
    invariant: 'two tasks → both render; one error leaves the other active',
  },
  {
    id: 'retry-delegates',
    title: 'Retry delegates recovery',
    note: 'withPerTaskRetry: the affordance fires retry and calls the handle.',
    attrs: { retry: '', persistence: 'sticky' },
    invariant: 'retry → background-task-retry fired → handle.retry() called',
  },
];
