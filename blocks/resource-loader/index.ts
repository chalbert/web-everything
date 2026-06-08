/**
 * @file blocks/resource-loader/index.ts
 * @description Public API for the Resource Loader block.
 */

// Core
export { default as ResourceLoader } from './ResourceLoader';
export type { LoadResult } from './ResourceLoader';

// Background Task Surface handoff (producer side)
export {
  backgroundLoad,
  ResourceLoaderHandle,
  BACKGROUND_TASK_REGISTER_EVENT,
} from './backgroundHandoff';
export type { BackgroundLoadOptions } from './backgroundHandoff';

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
