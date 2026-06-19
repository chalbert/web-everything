/**
 * Built-in commitment strategies + the surface guard (#1112, webvalidation completion #1090).
 *
 * The two shipped strategies the spec requires at minimum:
 *   - `full`     — commit on every input event (the eager default).
 *   - `deferred` — buffer locally; commit only on blur, submit, or an explicit event.
 *
 * Both share the per-field staleness bookkeeping (input generation + timestamp + sync) the
 * {@link CommitmentPolicy} observables expose. Pure model — no DOM, no element wiring; the runtime plug
 * (a `CustomRegistry`) consumes these verbatim so the policy logic has one home and cannot drift.
 */
import type { CommitContext, CommitmentPolicy, ValidationSync } from './contract.js';

/** Per-field bookkeeping shared by the built-ins. */
interface FieldState {
  generation: number;
  timestamp: string;
  sync: ValidationSync;
}

/**
 * Common base: tracks per-field input generation + timestamp + sync. `onValueInput` bumps the generation
 * and marks the field `stale` (a new value the displayed validation hasn't caught up to); a commit
 * decision taken while validation is settled (`!validationPending`) marks it `current` again. Subclasses
 * supply only {@link shouldCommit}.
 */
abstract class BaseCommitmentPolicy implements CommitmentPolicy {
  abstract readonly key: string;
  readonly #fields = new Map<string, FieldState>();
  readonly #now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.#now = now;
  }

  abstract shouldCommit(fieldId: string, value: unknown, context: CommitContext): boolean;

  /** Update staleness from a decision's context — settled validation makes the field current. */
  protected reconcile(context: CommitContext): void {
    if (!context.validationPending) this.#state(context.fieldId).sync = 'current';
  }

  #state(fieldId: string): FieldState {
    let s = this.#fields.get(fieldId);
    if (!s) {
      s = { generation: 0, timestamp: this.#now(), sync: 'current' };
      this.#fields.set(fieldId, s);
    }
    return s;
  }

  onValueInput(fieldId: string, _newValue: unknown): number {
    const s = this.#state(fieldId);
    s.generation += 1;
    s.timestamp = this.#now();
    s.sync = 'stale'; // a new value the displayed validation has not yet reflected
    return s.generation;
  }

  getValidationSync(fieldId: string): ValidationSync {
    return this.#state(fieldId).sync;
  }
  getValidationGeneration(fieldId: string): number {
    return this.#state(fieldId).generation;
  }
  getValidationTimestamp(fieldId: string): string {
    return this.#state(fieldId).timestamp;
  }
  dispose(fieldId: string): void {
    this.#fields.delete(fieldId);
  }
}

/** `full` — values are committed to form state on every input event (the eager strategy). */
export class FullCommitmentPolicy extends BaseCommitmentPolicy {
  readonly key = 'full';
  shouldCommit(_fieldId: string, _value: unknown, context: CommitContext): boolean {
    this.reconcile(context);
    return true;
  }
}

/** `deferred` — values buffered locally; committed only on blur, submit, or an explicit event. */
export class DeferredCommitmentPolicy extends BaseCommitmentPolicy {
  readonly key = 'deferred';
  shouldCommit(_fieldId: string, _value: unknown, context: CommitContext): boolean {
    this.reconcile(context);
    return context.event !== 'input';
  }
}

/** Guard a custom policy's identity — a strategy must self-name with a non-empty `key`. */
export function assertCommitmentPolicy(policy: CommitmentPolicy): CommitmentPolicy {
  if (!policy || typeof policy.key !== 'string' || !policy.key.trim()) {
    throw new Error('CommitmentPolicy must declare a non-empty string `key`.');
  }
  if (typeof policy.shouldCommit !== 'function') {
    throw new Error(`CommitmentPolicy "${policy.key}" must implement shouldCommit().`);
  }
  return policy;
}
