/**
 * @file blocks/resource-loader/index.ts
 * @description Public API for the Resource Loader block.
 */

// Core
export { default as ResourceLoader } from './ResourceLoader';
export type { LoadResult } from './ResourceLoader';

// The Loader → off-view-receiver handoff (producer side + wire contract) is FUI-canonical
// (#1766/#1774): `backgroundLoad`, `ResourceLoaderHandle`, the handoff contract types, and the
// reference receiver / fixtures live in `fui:blocks/resource-loader/`. WE keeps only the loader
// core + its conformance contract, so this index no longer re-exports the handoff surface.

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
