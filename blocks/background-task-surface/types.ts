/**
 * Shared types for the Background Task Surface block.
 *
 * Implements the registration handoff, state machine, and event contract
 * documented in the Background Task Intent spec (#113) and the Background Task
 * Surface block description (#128). The surface is the receiving end of a
 * Loader's `escalation:async` handoff — it adopts a live Loader state handle
 * and hosts it off-view rather than reimplementing progress.
 *
 * @module blocks/background-task-surface
 */

// -----------------------------------------------------------------------
// Task state machine
// -----------------------------------------------------------------------

/**
 * Lifecycle of a single tracked task entry, as surfaced by
 * `background-task-state-change`:
 *
 *   registered → active → success | error → dismissed
 *
 * - `registered` — adopted from a register event, before the first snapshot.
 * - `active` — work in flight (the Loader is loading).
 * - `success` — resolved successfully.
 * - `error` — failed (entries in this state are sticky regardless of the
 *   persistence dimension, so an off-view failure stays reviewable).
 * - `dismissed` — removed, by the user or by auto-clear of a transient success.
 */
export type BackgroundTaskState =
  | 'registered'
  | 'active'
  | 'success'
  | 'error'
  | 'dismissed';

/** Whether the user can see measurable progress for a task. */
export type ProgressMode = 'determinate' | 'indeterminate';

// -----------------------------------------------------------------------
// Loader state handle (the carried registration payload)
// -----------------------------------------------------------------------

/**
 * A single observation of a backgrounded Loader's state. The surface maps the
 * Loader's own machine onto the task lifecycle — `active`/`success`/`error` are
 * the off-view-relevant phases; `registered`/`dismissed` are owned by the
 * surface, not the Loader.
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
 * This is the same machine the originating view used — the surface subscribes
 * to it off-view rather than snapshotting or reimplementing it (the intent's
 * "same machine, hosted off-view"). The handle outlives the originating element,
 * which is why registration is a one-shot event handoff, not a DI lookup.
 *
 * `retry` is optional: when present (a Reliability-backed Loader), the surface's
 * retry affordance calls it after dispatching a non-prevented
 * `background-task-retry`. The surface owns the affordance; the handle owns the
 * recovery policy.
 */
export interface LoaderStateHandle {
  /** Current snapshot, read on adopt to seed the entry. */
  getSnapshot(): LoaderSnapshot;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: (snapshot: LoaderSnapshot) => void): () => void;
  /** Optional Reliability-backed recovery, invoked by the retry affordance. */
  retry?(): void;
}

// -----------------------------------------------------------------------
// Event detail types
// -----------------------------------------------------------------------

/** Detail for `background-task-register` (the handoff IN). */
export interface BackgroundTaskRegisterDetail {
  id: string;
  label: string;
  progress: ProgressMode;
  loaderState: LoaderStateHandle;
}

/** Detail for `background-task-state-change` (re-emitted lifecycle). */
export interface BackgroundTaskStateChangeDetail {
  id: string;
  from: BackgroundTaskState;
  to: BackgroundTaskState;
}

/** Detail for `background-task-retry` (user activated retry; cancelable). */
export interface BackgroundTaskRetryDetail {
  id: string;
}

/** Detail for `background-task-dismiss` (entry removed; cancelable). */
export interface BackgroundTaskDismissDetail {
  id: string;
  reason: 'user' | 'auto-clear';
}

// -----------------------------------------------------------------------
// Trait + config types
// -----------------------------------------------------------------------

/**
 * Resolved behavior of a surface, set from defaults and flipped by traits.
 * Mirrors the intent's configurable dimensions (the route-only baseline —
 * `durability` lives in the #134 reload tier, not here).
 */
export interface BackgroundTasksConfig {
  /** `single` (default, one entry shown) vs `batch` (all concurrent entries). */
  aggregation: 'single' | 'batch';
  /** `transient` (default, auto-clear on success) vs `sticky` (keep until dismissed). */
  persistence: 'transient' | 'sticky';
  /** Arm the beforeunload + route-leave guard while any task is in flight. */
  navigationGuard: boolean;
  /** Emit a Feedback toast when a task completes (for transient auto-clear). */
  completionToast: boolean;
  /** Expose a retry affordance on failed entries (recovery delegated out). */
  retry: boolean;
  /**
   * Durability of in-flight work across a full reload / tab close (#134, #450).
   *
   * - `route` (default, baseline) — in-memory: a task survives SPA route changes
   *   but a reload/close loses it; `navigationGuard` is the author's opt-in safety net.
   * - `reload` — opt-in durable *execution* tier: transfer-backed work delegated to a
   *   Background Fetch + service-worker adapter that survives reload/close and re-hydrates
   *   on the next load. Scope is bounded to transfers (#450 ruling 1); the enum stays
   *   `route | reload` (a future `resumable` checkpoint/resume term is reserved in docs,
   *   not shipped). `durability` and `navigationGuard` stay independent dimensions —
   *   `durability` *derives* the guard default (#450 ruling 2), never merges with it.
   */
  durability: 'route' | 'reload';
}

/** Default config — the route-only, single, transient baseline. */
export const DEFAULT_CONFIG: BackgroundTasksConfig = {
  aggregation: 'single',
  persistence: 'transient',
  navigationGuard: false,
  completionToast: false,
  retry: false,
  durability: 'route',
};

/**
 * Return value from a trait activation. Call `cleanup()` to revert the trait's
 * change (same contract as the Loader block's traits).
 */
export interface TraitHandle {
  cleanup: () => void;
}

/**
 * The slice of the surface a trait touches. Attributes are the single source of
 * truth for the surface's dimensions, so a trait is just a typed helper that
 * sets the corresponding attribute (and `cleanup()` removes it) — the element's
 * `attributeChangedCallback` re-derives config and re-arms behavior.
 */
export type BackgroundTaskSurface = Pick<
  Element,
  'setAttribute' | 'removeAttribute' | 'hasAttribute' | 'getAttribute'
>;

/** A function that applies a trait to a surface and returns a cleanup handle. */
export type BackgroundTasksTrait = (surface: BackgroundTaskSurface) => TraitHandle;

/** Constant: the completion-toast Feedback event name dispatched downstream. */
export const FEEDBACK_TOAST_EVENT = 'feedback-toast';
