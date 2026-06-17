/**
 * stepper block — the **pure-contract half** (#053): the Wizard / multi-step-form flow.
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/stepper` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the `StepperBehavior` (locked-progression realization
 * of the navigation intent's `structure: linear`) — lives next door in `./StepperBehavior.ts`, which
 * re-exports this surface (`export type * from './contract'`) so existing importers keep one site.
 */

export type Progression = 'locked' | 'free';

export interface StepperOptions {
  /** Selector for the step content panels within the host. */
  stepSelector?: string;
  /** Selector for the step indicators (the ordered list items). */
  indicatorSelector?: string;
  /** `locked` (default) = one-at-a-time, gated; `free` = any step anytime (withFreeStepNavigation). */
  progression?: Progression;
  /** The progression gate (withStepValidation): may the user leave `fromIndex`? Default: always. */
  canAdvance?: (fromIndex: number) => boolean;
  /** Indices that may be skipped without blocking completion (withOptionalSteps). */
  optional?: number[];
  /** A polite live region for the "Step N of M" announcement. */
  liveRegion?: HTMLElement;
  /** Human label for a step, used in the announcement. */
  stepLabel?: (index: number) => string;
}
