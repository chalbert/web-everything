/**
 * Shared types for the Resource Loader block.
 *
 * Implements the types documented in the Loader Intent spec and
 * the Resource Loader block description.
 *
 * @module blocks/resource-loader
 */

// -----------------------------------------------------------------------
// Loader Intent (resolved from injector chain)
// -----------------------------------------------------------------------

/** How the UI is blocked during a pending state */
export type BlockingStrategy = 'optimistic' | 'soft' | 'hard' | 'replacement';

/** What part of the UI is affected by the pending state */
export type LoaderScope = 'element' | 'region' | 'viewport';

/** Whether the user can see measurable progress */
export type LoaderProgress = 'determinate' | 'indeterminate';

/** Whether prior content exists when loading begins */
export type LoaderContext = 'initial' | 'transition';

/**
 * Loader Intent profile — declares how loading states affect the UI.
 * Provided via `customContexts:loaderIntent` on the injector chain.
 *
 * Consumers (Router, forms, etc.) resolve this and select
 * matching Resource Loader traits.
 */
export interface LoaderIntent {
  strategy: BlockingStrategy;
  scope: LoaderScope;
  progress: LoaderProgress;
  context: LoaderContext;
  timing: 'immediate' | 'debounced' | string;
  label?: string;
}

// -----------------------------------------------------------------------
// State machine
// -----------------------------------------------------------------------

/**
 * State machine for loading lifecycle.
 *
 * idle → pending → loading → success | empty | error → idle
 * If resolved before timing threshold: pending → success | empty | error → idle
 * abort() from any state → idle
 */
export type LoaderState = 'idle' | 'pending' | 'loading' | 'success' | 'empty' | 'error' | 'stale';

// -----------------------------------------------------------------------
// Trait types
// -----------------------------------------------------------------------

/**
 * Return value from a trait activation.
 * Call cleanup() to undo all DOM/ARIA/CSS changes the trait applied.
 */
export interface TraitHandle {
  cleanup: () => void;
}

/**
 * A function that activates a trait and returns a cleanup handle.
 * Called only when the timing threshold is reached (prevents flash).
 */
export type TraitFactory = () => TraitHandle;

// -----------------------------------------------------------------------
// Event detail types (follow codebase CustomEvent<T> pattern)
// -----------------------------------------------------------------------

/** Detail for resource-load-start */
export interface ResourceLoadStartDetail {
  timing: string;
  label?: string;
}

/** Detail for resource-load-end */
export interface ResourceLoadEndDetail {
  data: unknown;
  duration: number;
}

/** Detail for resource-load-error */
export interface ResourceLoadErrorDetail {
  error: Error;
  retryable: boolean;
}

/** Detail for resource-state-change */
export interface ResourceStateChangeDetail {
  oldState: LoaderState;
  newState: LoaderState;
}

// -----------------------------------------------------------------------
// ResourceLoader options
// -----------------------------------------------------------------------

/** Default timing thresholds (ms) */
export const DEFAULT_TIMINGS: Record<string, number> = {
  immediate: 0,
  debounced: 400,
};

/** Options for creating a ResourceLoader instance */
export interface ResourceLoaderOptions {
  /** The element that loading state applies to */
  target: HTMLElement;
  /** Explicit intent override (if not provided, resolved from injector chain) */
  intent?: Partial<LoaderIntent>;
  /** Custom timing overrides (e.g., { slow: 1000 }) */
  timings?: Record<string, number>;
  /** Determines if data is "empty". Default: null/undefined/empty-array */
  isEmpty?: (data: unknown) => boolean;
}

/** Default LoaderIntent when none is resolved from the injector chain */
export const DEFAULT_INTENT: LoaderIntent = {
  strategy: 'soft',
  scope: 'region',
  progress: 'indeterminate',
  context: 'transition',
  timing: 'debounced',
};
