/**
 * Async validator resolution strategy plane — the swappable concern behind *how* an in-flight async
 * check is reconciled when the input keeps changing (#214, the named sibling of #212).
 *
 * #212's validity-merge plane treats `async` as one source that reports `pending{version}` then
 * resolves to `valid|invalid`. But *how* an in-flight async check is resolved when input keeps moving
 * — cancel the stale request? version it and drop late answers? — is its **own** swappable concern: a
 * `CustomValidatorResolution` strategy resolved through a `CustomValidatorResolutionRegistry` (sibling
 * to the `CustomValidityMerge` plane). The **only** constraint (mirroring #004 OP-1's surface rule) is
 * that a strategy's results feed the same `pending{version}` → `valid|invalid` `SourceResult` the merge
 * plane consumes; `assertResolvedSource` enforces it. Vary the resolution policy, never that surface.
 *
 * This module ships the surface types, the surface guard, and the two registered strategies:
 * **versioning** (the native-first default — stamp a per-field generation token and drop answers older
 * than the current input) and **cancellation** (abort the in-flight request via `AbortController`). The
 * registry + the async runner live in `./registry.ts`; the default wiring in `./index.ts`. Like the
 * validity-merge plane (#212) this is a standalone, dependency-free model of the contract — the runtime
 * plug fulfils the same shape.
 */
import type { SourceResult } from '../validity-merge/provider.js';

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

export const RESOLVED_STATES: readonly ResolvedSource['state'][] = ['pending', 'valid', 'invalid'];

/** A strategy/runner emitted a value that is not a conformant `ResolvedSource` (cross-plane contract broken). */
export class SourceContractError extends Error {
  constructor(key: string, why: string) {
    super(`Resolution strategy "${key}" broke the ResolvedSource contract: ${why}`);
    this.name = 'SourceContractError';
  }
}

/** Narrow an unknown value to `ResolvedSource` — the versioned source result the merge plane (#212) consumes. */
export function isResolvedSource(v: unknown): v is ResolvedSource {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.source === 'string' &&
    typeof s.state === 'string' &&
    (RESOLVED_STATES as readonly string[]).includes(s.state) &&
    typeof s.version === 'number' &&
    (s.message === undefined || typeof s.message === 'string')
  );
}

/**
 * Enforce the cross-plane contract on a strategy/runner's emitted source (mirrors #212's
 * `assertMergedValidity`): the resolution policy may vary freely, but if it emits anything other than a
 * versioned `pending|valid|invalid` source the merge plane cannot consume it — so the runner throws
 * rather than feed a malformed source on. Returns the value (typed) when valid; throws otherwise.
 */
export function assertResolvedSource(key: string, v: unknown): ResolvedSource {
  if (!isResolvedSource(v))
    throw new SourceContractError(key, 'output is not a versioned pending|valid|invalid SourceResult');
  return v;
}

/**
 * **Versioning** — the native-first default. Stamps a monotonically increasing generation token per
 * field on every `startValidation`; `onInputChange` bumps it too, so any in-flight handle minted for a
 * now-stale input falls behind the current generation. `shouldApplyResult` applies an answer only when
 * its handle is still the current generation — late answers for superseded input are silently dropped.
 * Pairs with #212's auto-stamped `version`: the generation it stamps IS the `pending{version}` token.
 */
export class VersioningResolution implements CustomValidatorResolution {
  readonly key = 'versioning';
  readonly #generations = new Map<string, number>();

  #bump(fieldId: string): number {
    const next = (this.#generations.get(fieldId) ?? 0) + 1;
    this.#generations.set(fieldId, next);
    return next;
  }

  startValidation(fieldId: string, input: ValidationInput): ValidationHandle {
    return { fieldId, version: this.#bump(fieldId), input };
  }

  shouldApplyResult(handle: ValidationHandle, _result: AsyncResult): boolean {
    return handle.version === this.#generations.get(handle.fieldId);
  }

  onInputChange(fieldId: string, _newInput: ValidationInput): void {
    this.#bump(fieldId); // supersede any in-flight generation for this field
  }
}

/**
 * **Cancellation** — abort the in-flight request via `AbortController`. Each `startValidation` aborts
 * the field's previous controller and mints a fresh one, handing its `signal` to the validator (so a
 * `fetch` is actually torn down, not just ignored). `onInputChange` aborts without starting a new
 * check. `shouldApplyResult` drops any answer whose request was aborted. A monotonic counter still
 * stamps the `version`, so the emitted source carries the `pending{version}` token the merge plane keys on.
 */
export class CancellationResolution implements CustomValidatorResolution {
  readonly key = 'cancellation';
  readonly #controllers = new Map<string, AbortController>();
  #version = 0;

  #abort(fieldId: string): void {
    this.#controllers.get(fieldId)?.abort();
    this.#controllers.delete(fieldId);
  }

  startValidation(fieldId: string, input: ValidationInput): ValidationHandle {
    this.#abort(fieldId); // tear down the prior in-flight request for this field
    const controller = new AbortController();
    this.#controllers.set(fieldId, controller);
    return { fieldId, version: ++this.#version, input, signal: controller.signal };
  }

  shouldApplyResult(handle: ValidationHandle, _result: AsyncResult): boolean {
    return !handle.signal?.aborted;
  }

  onInputChange(fieldId: string, _newInput: ValidationInput): void {
    this.#abort(fieldId); // cancel the in-flight request; the next startValidation opens a fresh one
  }
}
