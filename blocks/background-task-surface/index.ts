/**
 * @file blocks/background-task-surface/index.ts
 * @description Public API for the Background Task Surface block.
 */

// Element
export { default as BackgroundTasksElement } from './BackgroundTasksElement';

// Registration
export { registerBackgroundTasks } from './registerBackgroundTasks';

// Traits
export { withBatchAggregation } from './traits/withBatchAggregation';
export { withStickyEntries } from './traits/withStickyEntries';
export { withNavigationGuard } from './traits/withNavigationGuard';
export { withCompletionToast } from './traits/withCompletionToast';
export { withPerTaskRetry } from './traits/withPerTaskRetry';

// Types
export type {
  BackgroundTaskState,
  ProgressMode,
  LoaderSnapshot,
  LoaderStateHandle,
  BackgroundTaskRegisterDetail,
  BackgroundTaskStateChangeDetail,
  BackgroundTaskRetryDetail,
  BackgroundTaskDismissDetail,
  BackgroundTasksConfig,
  BackgroundTaskSurface,
  BackgroundTasksTrait,
  TraitHandle,
} from './types';

export { DEFAULT_CONFIG, FEEDBACK_TOAST_EVENT } from './types';
