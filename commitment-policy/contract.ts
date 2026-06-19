/**
 * Commitment-policy contract (#1112, webvalidation completion #1090).
 *
 * Spec: `we:src/_includes/project-webvalidation.njk` (§"Commitment Strategy Registry"). When an invalid
 * value enters form state is a **per-field, per-event, per-validity** decision — apps register commitment
 * strategies and a control consults the resolved one before writing to form state. This file is the pure,
 * dependency-free contract (mirroring `validity-merge/contract.ts`): the `CommitContext` a control hands
 * the policy and the `CommitmentPolicy` interface every strategy satisfies. Types only — no element wiring.
 */
import type { MergedValidity } from '../validity-merge/contract.js';
import type { InteractionState } from '../interaction-state/model.js';

/** The event that prompted a commit decision. */
export type CommitEvent = 'input' | 'blur' | 'submit' | 'explicit';

/** Whether displayed validation is in sync with the buffered value (the deferred-commit staleness signal). */
export type ValidationSync = 'current' | 'stale';

/**
 * Everything a {@link CommitmentPolicy} needs to decide whether `value` may enter form state for one field
 * on one event — the full per-field/per-event/per-validity context the spec enumerates.
 */
export interface CommitContext {
  fieldId: string;
  event: CommitEvent;
  value: unknown;
  /** The merged validity (includes severity) at decision time. */
  validity: MergedValidity;
  interaction: InteractionState;
  submitted: boolean;
  validationPending: boolean;
}

/**
 * A commitment strategy — decides when a value is committed to form state, and exposes the staleness
 * observables a deferred-commit client needs. `key` names the strategy (`'full'`, `'deferred'`, …) so the
 * registry can register it value-first, mirroring `CustomValidityMergeStrategy`.
 */
export interface CommitmentPolicy {
  readonly key: string;

  /** Per-field, per-event, per-validity decision: may `value` enter form state now? */
  shouldCommit(fieldId: string, value: unknown, context: CommitContext): boolean;

  /** A value-input arrived — bump and return the field's input generation. */
  onValueInput(fieldId: string, newValue: unknown): number;

  /** Whether the field's displayed validation is current or stale vs the latest input. */
  getValidationSync(fieldId: string): ValidationSync;
  /** The field's current input generation. */
  getValidationGeneration(fieldId: string): number;
  /** ISO timestamp of the field's last value-input. */
  getValidationTimestamp(fieldId: string): string;

  /** Release any per-field bookkeeping (the field was removed). */
  dispose(fieldId: string): void;
}
