/**
 * @file blocks/resource-loader/index.ts
 * @description Public API for the Resource Loader block.
 */

// Core
export { default as ResourceLoader } from './ResourceLoader';
export type { LoadResult } from './ResourceLoader';

// Loader → off-view-receiver handoff (producer side)
export {
  backgroundLoad,
  ResourceLoaderHandle,
  BACKGROUND_TASK_REGISTER_EVENT,
  BACKGROUND_TASK_DISMISS_EVENT,
} from './backgroundHandoff';
export type { BackgroundLoadOptions } from './backgroundHandoff';
// The producer-owned wire contract (the standard handoff seam)
export type {
  LoaderSnapshot,
  LoaderStateHandle,
  BackgroundTaskRegisterDetail,
  BackgroundTaskDismissDetail,
} from './handoffContract';

// Traits
export { withSoftBlocking } from './traits/withSoftBlocking';
export type { SoftBlockingOptions } from './traits/withSoftBlocking';
export { withReplacement } from './traits/withReplacement';
export type { ReplacementOptions } from './traits/withReplacement';
export { withIndeterminate } from './traits/withIndeterminate';
export type { IndeterminateOptions } from './traits/withIndeterminate';

// Types
export type {
  LoaderIntent,
  LoaderState,
  BlockingStrategy,
  LoaderScope,
  LoaderProgress,
  LoaderContext,
  TraitHandle,
  TraitFactory,
  ResourceLoaderOptions,
  ResourceLoadStartDetail,
  ResourceLoadEndDetail,
  ResourceLoadErrorDetail,
  ResourceStateChangeDetail,
} from './types';

export { DEFAULT_INTENT, DEFAULT_TIMINGS } from './types';
