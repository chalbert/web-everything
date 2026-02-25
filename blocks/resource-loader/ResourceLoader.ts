/**
 * ResourceLoader — Core orchestrator for async loading lifecycle.
 *
 * Manages the state machine (idle → pending → loading → success/empty/error),
 * timing (debounced vs immediate), AbortController, trait activation, and
 * event dispatching. Consumers (Router, forms, data grids) create an instance
 * and call `load()`.
 *
 * Traits (withSoftBlocking, withReplacement, etc.) are passed as factory
 * functions and only activated when the timing threshold is reached, preventing
 * flash-of-loading for fast operations.
 *
 * @module blocks/resource-loader
 *
 * @example
 * ```typescript
 * const loader = new ResourceLoader({ target: element });
 * const result = await loader.load(async (signal) => {
 *   const res = await fetch('/api/data', { signal });
 *   return res.json();
 * }, [
 *   () => withSoftBlocking(element),
 *   () => withIndeterminate(element),
 * ]);
 *
 * if (result.state === 'success') {
 *   renderData(result.data);
 * }
 * ```
 */

import InjectorRoot from '../../plugs/webinjectors/InjectorRoot';
import type {
  LoaderIntent,
  LoaderState,
  ResourceLoaderOptions,
  ResourceLoadStartDetail,
  ResourceLoadEndDetail,
  ResourceLoadErrorDetail,
  ResourceStateChangeDetail,
  TraitHandle,
  TraitFactory,
} from './types';
import { DEFAULT_INTENT, DEFAULT_TIMINGS } from './types';

/**
 * Result returned by load().
 */
export interface LoadResult<T = unknown> {
  state: 'success' | 'empty' | 'error';
  data?: T;
  error?: Error;
  duration: number;
  aborted: boolean;
}

export default class ResourceLoader {
  #target: HTMLElement;
  #options: ResourceLoaderOptions;
  #state: LoaderState = 'idle';
  #abortController: AbortController | null = null;
  #timingTimeout: ReturnType<typeof setTimeout> | null = null;
  #activeTraits: TraitHandle[] = [];
  #resolvedIntent: LoaderIntent | null = null;

  constructor(options: ResourceLoaderOptions) {
    this.#target = options.target;
    this.#options = options;
  }

  /** Current state of the loader */
  get state(): LoaderState {
    return this.#state;
  }

  /** The target element */
  get target(): HTMLElement {
    return this.#target;
  }

  /** The resolved LoaderIntent (lazily resolved on first access) */
  get intent(): LoaderIntent {
    if (!this.#resolvedIntent) {
      this.#resolvedIntent = this.#resolveIntent();
    }
    return this.#resolvedIntent;
  }

  /**
   * Execute an async loading operation with full lifecycle management.
   *
   * - Aborts any in-progress load
   * - Transitions through the state machine
   * - Activates trait factories only when timing threshold reached
   * - Dispatches events
   * - Returns LoadResult
   *
   * @param fn - Async function receiving an AbortSignal
   * @param traits - Optional trait factories, activated when entering 'loading' state
   * @returns LoadResult with state, data/error, and duration
   */
  async load<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    traits?: TraitFactory[],
  ): Promise<LoadResult<T>> {
    // Abort previous load
    this.abort();

    // Create new AbortController
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    // Transition to pending
    this.#transition('pending');

    const startTime = performance.now();
    const timingMs = this.#resolveTimingMs();
    const traitFactories = traits ?? [];

    // Track whether traits were activated (for cleanup)
    let traitsActivated = false;

    // Schedule transition to 'loading' after timing threshold
    if (timingMs > 0) {
      this.#timingTimeout = setTimeout(() => {
        if (this.#state === 'pending' && !signal.aborted) {
          this.#transition('loading');
          this.#activateTraits(traitFactories);
          traitsActivated = true;
          this.#dispatchLoadStart();
        }
      }, timingMs);
    } else {
      // Immediate: go straight to loading
      this.#transition('loading');
      this.#activateTraits(traitFactories);
      traitsActivated = true;
      this.#dispatchLoadStart();
    }

    try {
      // Race fn against the abort signal so load() always resolves,
      // even if the consumer function doesn't handle abort itself.
      const data = await Promise.race([
        fn(signal),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        }),
      ]);

      if (signal.aborted) {
        return { state: 'error', aborted: true, duration: performance.now() - startTime };
      }

      this.#clearTimingTimeout();
      const duration = performance.now() - startTime;
      const isEmpty = this.#checkEmpty(data);

      // Cleanup traits
      if (traitsActivated) {
        this.#deactivateTraits();
      }

      // Transition to final state then idle
      const finalState = isEmpty ? 'empty' : 'success';
      this.#transition(finalState);
      this.#dispatchLoadEnd(data, duration);
      this.#transition('idle');

      return { state: finalState, data, duration, aborted: false };
    } catch (error) {
      if (signal.aborted) {
        return { state: 'error', aborted: true, duration: performance.now() - startTime };
      }

      this.#clearTimingTimeout();
      const duration = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      // Cleanup traits
      if (traitsActivated) {
        this.#deactivateTraits();
      }

      // Transition to error then idle
      this.#transition('error');
      this.#dispatchLoadError(err);
      this.#transition('idle');

      return { state: 'error', error: err, duration, aborted: false };
    }
  }

  /**
   * Abort the current loading operation.
   * Cleans up all traits and resets state to idle.
   */
  abort(): void {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    this.#clearTimingTimeout();
    this.#deactivateTraits();
    if (this.#state !== 'idle') {
      this.#transition('idle');
    }
  }

  /**
   * Destroy the loader. Aborts any in-progress load and clears all state.
   */
  destroy(): void {
    this.abort();
    this.#resolvedIntent = null;
  }

  // ---- Private: Intent Resolution ----

  #resolveIntent(): LoaderIntent {
    const explicit = this.#options.intent;

    const injected = InjectorRoot.getProviderOf(
      this.#target,
      'customContexts:loaderIntent' as any,
    ) as Partial<LoaderIntent> | undefined;

    return {
      ...DEFAULT_INTENT,
      ...(injected ?? {}),
      ...(explicit ?? {}),
    };
  }

  // ---- Private: State Machine ----

  #transition(newState: LoaderState): void {
    const oldState = this.#state;
    if (oldState === newState) return;
    this.#state = newState;

    this.#target.dispatchEvent(
      new CustomEvent<ResourceStateChangeDetail>('resource-state-change', {
        bubbles: true,
        cancelable: false,
        detail: { oldState, newState },
      }),
    );
  }

  // ---- Private: Timing ----

  #resolveTimingMs(): number {
    const timing = this.intent.timing;
    const customTimings = this.#options.timings ?? {};
    const allTimings = { ...DEFAULT_TIMINGS, ...customTimings };

    if (timing in allTimings) {
      return allTimings[timing];
    }

    const parsed = Number(timing);
    if (!Number.isNaN(parsed)) return parsed;

    return allTimings['debounced'];
  }

  #clearTimingTimeout(): void {
    if (this.#timingTimeout !== null) {
      clearTimeout(this.#timingTimeout);
      this.#timingTimeout = null;
    }
  }

  // ---- Private: Trait Management ----

  #activateTraits(factories: TraitFactory[]): void {
    this.#activeTraits = factories.map(factory => factory());
  }

  #deactivateTraits(): void {
    // Cleanup in reverse order (LIFO) to properly restore stacked state
    for (let i = this.#activeTraits.length - 1; i >= 0; i--) {
      this.#activeTraits[i].cleanup();
    }
    this.#activeTraits = [];
  }

  // ---- Private: Empty Check ----

  #checkEmpty(data: unknown): boolean {
    if (this.#options.isEmpty) {
      return this.#options.isEmpty(data);
    }
    if (data === null || data === undefined) return true;
    if (Array.isArray(data) && data.length === 0) return true;
    return false;
  }

  // ---- Private: Event Dispatching ----

  #dispatchLoadStart(): void {
    this.#target.dispatchEvent(
      new CustomEvent<ResourceLoadStartDetail>('resource-load-start', {
        bubbles: true,
        cancelable: false,
        detail: { timing: this.intent.timing, label: this.intent.label },
      }),
    );
  }

  #dispatchLoadEnd(data: unknown, duration: number): void {
    this.#target.dispatchEvent(
      new CustomEvent<ResourceLoadEndDetail>('resource-load-end', {
        bubbles: true,
        cancelable: false,
        detail: { data, duration },
      }),
    );
  }

  #dispatchLoadError(error: Error): void {
    this.#target.dispatchEvent(
      new CustomEvent<ResourceLoadErrorDetail>('resource-load-error', {
        bubbles: true,
        cancelable: false,
        detail: { error, retryable: false },
      }),
    );
  }
}
