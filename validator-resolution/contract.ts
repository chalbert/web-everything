/**
 * Async validator resolution strategy plane — the **pure-contract half** (#214, the named sibling of #212).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/validator-resolution` entry (#872/#874) that FUI depends on, superseding
 * byte-replication. The runtime half — the source guard and the two shipped strategies — lives in
 * `./provider.ts` (impl, → FUI); the registry + async runner in `./registry.ts`; the default wiring in
 * `./index.ts`.
 *
 * #212's validity-merge plane treats `async` as one source that reports `pending{version}` then resolves
 * to `valid|invalid`. *How* an in-flight async check is resolved when input keeps moving — cancel the
 * stale request? version it and drop late answers? — is its **own** swappable concern. The **only**
 * constraint (mirroring #004 OP-1's surface rule) is that a strategy's results feed the same
 * `pending{version}` → `valid|invalid` `SourceResult` the merge plane consumes; `assertResolvedSource`
 * (in `./provider.ts`) enforces it. Vary the resolution policy, never that surface.
 */
import type { SourceResult } from '../validity-merge/contract.js';

/** The field input under validation. Opaque to the plane — a strategy tracks generations, never inspects it. */
export type ValidationInput = unknown;

/** What an async validator eventually resolves to — the terminal half of `pending → valid|invalid`. */
export interface AsyncResult {
  state: 'valid' | 'invalid';
  /** Human-facing message when `state === 'invalid'`. */
  message?: string;
}

/**
 * A handle for one in-flight validation generation. `startValidation` mints it; the runner threads it
 * back through `shouldApplyResult` so a strategy can decide whether a late answer is still current.
 * `version` is the generation token stamped onto the `pending{version}` source result (the merge
 * plane's stable id); `signal` is present only for the cancellation strategy.
 */
export interface ValidationHandle {
  fieldId: string;
  version: number;
  input: ValidationInput;
  signal?: AbortSignal;
}

/**
 * The injectable contract every resolution strategy satisfies — one interface, swappable impls
 * (versioning, cancellation, custom). `key` names it for registration. `startValidation` opens a
 * generation for a field's current input; `shouldApplyResult` decides whether a freshly-arrived answer
 * is still current (the heart of stale-drop); `onInputChange` tells the strategy the input moved on
 * while a check was in flight (bump the generation / abort the request).
 */
export interface CustomValidatorResolution {
  readonly key: string;
  startValidation(fieldId: string, input: ValidationInput): ValidationHandle;
  shouldApplyResult(handle: ValidationHandle, result: AsyncResult): boolean;
  onInputChange(fieldId: string, newInput: ValidationInput): void;
}

/**
 * What the resolution plane emits into the merge plane: a `pending`/`valid`/`invalid` `SourceResult`
 * carrying a generation `version` — exactly the source result #212 consumes. Never `idle`.
 */
export type ResolvedSource = SourceResult & { state: 'pending' | 'valid' | 'invalid'; version: number };
