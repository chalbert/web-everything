/**
 * @file blocks/background-task-surface/registerBackgroundTasks.ts
 * @description Registration helper for the Background Task Surface. Defines the
 * `<background-tasks>` custom element with its default tag name. Idempotent —
 * safe to call more than once (e.g. across HMR or repeated bootstrap).
 */

import BackgroundTasksElement from './BackgroundTasksElement';

/**
 * Register `<background-tasks>` with its default tag name.
 *
 * @example
 * ```typescript
 * import { registerBackgroundTasks } from 'blocks/background-task-surface';
 * registerBackgroundTasks();
 * // …or with a custom tag:
 * customElements.define('app-tasks', BackgroundTasksElement);
 * ```
 */
export function registerBackgroundTasks(): void {
  if (!customElements.get('background-tasks')) {
    customElements.define('background-tasks', BackgroundTasksElement);
  }
}
