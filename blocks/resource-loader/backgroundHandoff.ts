/**
 * Loader → Background Task Surface handoff (producer side).
 *
 * The {@link ../background-task-surface/BackgroundTasksElement | Background Task
 * Surface} adopts a live `LoaderStateHandle` carried by a bubbling
 * `background-task-register` event and hosts it off-view. This module is the
 * *producer* half: it adapts a real {@link ResourceLoader} into that handle and
 * dispatches the registration when the loader's work goes async.
 *
 * **Escalation:async trigger.** Rather than invent a new threshold, this reuses
 * the Loader's own debounce: a load escalates exactly when it crosses into the
 * `loading` state (i.e. it was slow enough that the Loader decided to surface a
 * pending UI). Fast operations that resolve before the timing threshold never
 * enter `loading`, so they never escalate to the rail. Backgrounding is opt-in:
 * call {@link backgroundLoad} instead of `loader.load()`.
 *
 * The coupling to the surface is a bubbling DOM `CustomEvent` only — the type
 * import below is erased at runtime, so the producer carries no runtime
 * dependency on the surface element.
 *
 * @module blocks/resource-loader
 */

import type ResourceLoader from './ResourceLoader';
import type { LoadResult } from './ResourceLoader';
import type {
  ResourceStateChangeDetail,
  ResourceLoadErrorDetail,
  ResourceProgressDetail,
  TraitFactory,
} from './types';
// Type-only — the surface owns the handoff contract; no runtime coupling.
import type {
  LoaderSnapshot,
  LoaderStateHandle,
  BackgroundTaskRegisterDetail,
  BackgroundTaskDismissDetail,
} from '../background-task-surface/types';

/** The bubbling registration event the surface listens for. */
export const BACKGROUND_TASK_REGISTER_EVENT = 'background-task-register';

/** The bubbling dismiss event the surface emits when an entry is removed. */
export const BACKGROUND_TASK_DISMISS_EVENT = 'background-task-dismiss';

/**
 * A live `LoaderStateHandle` over a {@link ResourceLoader}.
 *
 * It subscribes to the loader's own events on its target element and projects
 * them onto the surface's off-view snapshot machine:
 *
 * - `resource-state-change` → `loading` ⇒ `active`
 * - `resource-progress` ⇒ same state, with the determinate `0..1` fraction
 * - `resource-load-end` (success **or** empty) ⇒ `success`
 * - `resource-load-error` ⇒ `error` (carrying the `Error`)
 *
 * `pending`/`idle`/`stale` produce no snapshot — they are not off-view-relevant.
 * `retry()` re-runs the original `load(fn, traits)` on the *same* handle, so the
 * surface's existing subscription simply sees `active` again (no re-register).
 */
export class ResourceLoaderHandle implements LoaderStateHandle {
  #loader: ResourceLoader;
  #fn: (signal: AbortSignal) => Promise<unknown>;
  #traits?: TraitFactory[];
  #target: HTMLElement;
  #snapshot: LoaderSnapshot = { state: 'active' };
  #listeners = new Set<(snapshot: LoaderSnapshot) => void>();

  #onStateChange = (e: Event): void => {
    const { newState } = (e as CustomEvent<ResourceStateChangeDetail>).detail;
    if (newState === 'loading') this.#emit({ state: 'active' });
  };
  #onEnd = (): void => this.#emit({ state: 'success' });
  #onError = (e: Event): void => {
    const { error } = (e as CustomEvent<ResourceLoadErrorDetail>).detail;
    this.#emit({ state: 'error', error });
  };
  // Forward determinate progress without changing state: keep the current snapshot
  // and overlay the 0..1 fraction so the surface's determinate bar advances.
  #onProgress = (e: Event): void => {
    const { fraction } = (e as CustomEvent<ResourceProgressDetail>).detail;
    this.#emit({ ...this.#snapshot, progress: fraction });
  };

  constructor(
    loader: ResourceLoader,
    fn: (signal: AbortSignal) => Promise<unknown>,
    traits?: TraitFactory[],
  ) {
    this.#loader = loader;
    this.#fn = fn;
    this.#traits = traits;
    this.#target = loader.target;
    this.#target.addEventListener('resource-state-change', this.#onStateChange);
    this.#target.addEventListener('resource-progress', this.#onProgress);
    this.#target.addEventListener('resource-load-end', this.#onEnd);
    this.#target.addEventListener('resource-load-error', this.#onError);
  }

  getSnapshot(): LoaderSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: (snapshot: LoaderSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Reliability-backed recovery: re-run the original load on this handle. */
  retry(): void {
    void this.#loader.load(this.#fn, this.#traits);
  }

  /**
   * Detach from the loader's event stream. Optional: the listeners live on the
   * loader's target, so they are GC'd when the target is torn down with its
   * view. Call this to release them explicitly while the target persists.
   */
  dispose(): void {
    this.#target.removeEventListener('resource-state-change', this.#onStateChange);
    this.#target.removeEventListener('resource-progress', this.#onProgress);
    this.#target.removeEventListener('resource-load-end', this.#onEnd);
    this.#target.removeEventListener('resource-load-error', this.#onError);
    this.#listeners.clear();
  }

  #emit(snapshot: LoaderSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }
}

/** Options for {@link backgroundLoad}. */
export interface BackgroundLoadOptions {
  /** Stable task id (idempotent re-register replaces an entry with the same id). */
  id: string;
  /** Human label shown on the rail entry. */
  label: string;
  /**
   * Element to dispatch the bubbling register event from (resolves to the
   * nearest ancestor `<background-tasks>`). Defaults to the loader's target.
   */
  source?: Element;
  /** Trait factories forwarded to `loader.load()` (and re-applied on retry). */
  traits?: TraitFactory[];
}

/**
 * Run a load that escalates into the Background Task Surface when it goes async.
 *
 * Identical to `loader.load(fn, traits)` for the caller's purposes — it returns
 * the same `LoadResult` — but if the work crosses the loader's debounce
 * threshold into `loading`, it registers a live handle with the nearest
 * `<background-tasks>` surface so the task is tracked off-view (with progress,
 * completion announcement, and per-task retry). Fast loads that resolve first
 * never register.
 */
export function backgroundLoad<T>(
  loader: ResourceLoader,
  fn: (signal: AbortSignal) => Promise<T>,
  opts: BackgroundLoadOptions,
): Promise<LoadResult<T>> {
  const { id, label, source = loader.target, traits } = opts;
  const handle = new ResourceLoaderHandle(loader, fn, traits);

  // Register once, the moment the loader crosses into `loading` (escalation:async).
  const onEscalate = (e: Event): void => {
    if ((e as CustomEvent<ResourceStateChangeDetail>).detail.newState !== 'loading') return;
    loader.target.removeEventListener('resource-state-change', onEscalate);
    const detail: BackgroundTaskRegisterDetail = {
      id,
      label,
      progress: loader.intent.progress,
      loaderState: handle,
    };
    source.dispatchEvent(
      new CustomEvent(BACKGROUND_TASK_REGISTER_EVENT, {
        bubbles: true,
        cancelable: false,
        detail,
      }),
    );

    // Close the loop: when the surface drops this entry, release the handle's
    // loader listeners. The dismiss event bubbles UP from the `<background-tasks>`
    // surface (an ancestor of `source`), so it never reaches `loader.target` — we
    // listen on the shared root the surface bubbles into. `retry()` re-runs on the
    // same handle without re-registering, so listeners stay alive across a retry
    // and detach only on a true dismiss (`user` or transient `auto-clear`). A
    // cancelable dismiss the host kept sticky (`defaultPrevented`) is left alone.
    const root = source.getRootNode();
    const onDismiss = (de: Event): void => {
      const dismiss = de as CustomEvent<BackgroundTaskDismissDetail>;
      if (dismiss.detail.id !== id || dismiss.defaultPrevented) return;
      root.removeEventListener(BACKGROUND_TASK_DISMISS_EVENT, onDismiss);
      handle.dispose();
    };
    root.addEventListener(BACKGROUND_TASK_DISMISS_EVENT, onDismiss);
  };
  // Attached AFTER the handle's own listener (constructor) so that on `loading`
  // the snapshot is already `active` before the surface reads getSnapshot().
  loader.target.addEventListener('resource-state-change', onEscalate);

  return loader.load(fn, traits);
}
