/**
 * The Loader → off-view-receiver handoff contract (producer-owned).
 *
 * When a {@link ./ResourceLoader | ResourceLoader} crosses its `escalation:async`
 * debounce threshold, {@link ./backgroundHandoff | backgroundLoad} dispatches a
 * bubbling `background-task-register` event carrying a live {@link LoaderStateHandle}.
 * A *receiver* — any element that listens for the event and hosts the task off-view
 * (Frontier UI's `<background-tasks>` surface is the production one; the
 * `__fixtures__/reference-receiver` is the WE reference) — adopts the handle and
 * subscribes to it.
 *
 * These types are the **wire contract** of that handoff — the standard seam the WE
 * Resource Loader produces. The receiver is impl (it lives in `@frontierui/blocks`,
 * reached only across the iframe boundary), so WE owns the producer half and the
 * contract; the cross-boundary coupling is the DOM `CustomEvent` alone, never a
 * shared runtime type. Each side declares its own view of these shapes.
 *
 * @module blocks/resource-loader
 */

import type { LoaderProgress } from './types';

/**
 * A single observation of a backgrounded Loader's state. The receiver maps the
 * Loader's own machine onto its task lifecycle — `active`/`success`/`error` are
 * the off-view-relevant phases; a receiver's own `registered`/`dismissed` phases
 * are not produced by the Loader.
 */
export interface LoaderSnapshot {
  state: 'active' | 'success' | 'error';
  /** 0..1 fraction; only meaningful when the task is `determinate`. */
  progress?: number;
  /** Present on `error` — the failure surfaced for retry/announcement. */
  error?: Error;
}

/**
 * The live Loader state-machine handle carried by `background-task-register`.
 *
 * This is the same machine the originating view used — the receiver subscribes to
 * it off-view rather than snapshotting or reimplementing it. The handle outlives
 * the originating element, which is why registration is a one-shot event handoff,
 * not a DI lookup.
 *
 * `retry` is optional: when present (a Reliability-backed Loader), the receiver's
 * retry affordance calls it after dispatching a non-prevented retry event. The
 * receiver owns the affordance; the handle owns the recovery policy.
 */
export interface LoaderStateHandle {
  /** Current snapshot, read on adopt to seed the entry. */
  getSnapshot(): LoaderSnapshot;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: (snapshot: LoaderSnapshot) => void): () => void;
  /** Optional Reliability-backed recovery, invoked by the retry affordance. */
  retry?(): void;
}

/** Detail for `background-task-register` (the handoff OUT, from the producer). */
export interface BackgroundTaskRegisterDetail {
  id: string;
  label: string;
  progress: LoaderProgress;
  loaderState: LoaderStateHandle;
}

/**
 * Detail for `background-task-dismiss` (the receiver removed an entry; bubbles
 * back so the producer can release the handle's loader listeners). Cancelable: a
 * host that vetoes the dismiss keeps the entry, and the producer must not dispose.
 */
export interface BackgroundTaskDismissDetail {
  id: string;
  reason: 'user' | 'auto-clear';
}
