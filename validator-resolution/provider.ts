/**
 * Async validator resolution strategy plane — the **runtime-impl half** (#214, the named sibling of #212).
 *
 * The source guard and the two registered strategies — the runtime that fulfils the contract. The
 * pure-contract half (types/interfaces, compile-erased) is its sibling `./contract.ts`, the future
 * `@webeverything/contracts/validator-resolution` entry; the registry + async runner live in
 * `./registry.ts`, the default wiring in `./index.ts`. This file re-exports the contract surface
 * (`export type * from './contract.js'`) so existing `./provider.js` importers keep one import site for
 * both halves; the split is at the *file* seam, not the public surface.
 *
 * The two shipped strategies: **versioning** (the native-first default — stamp a per-field generation
 * token and drop answers older than the current input) and **cancellation** (abort the in-flight request
 * via `AbortController`). The **only** constraint (mirroring #004 OP-1's surface rule) is that a
 * strategy's results feed the same `pending{version}` → `valid|invalid` `SourceResult` the merge plane
 * consumes; `assertResolvedSource` enforces it. Like the validity-merge plane (#212) this is a
 * standalone, dependency-free model — the runtime plug fulfils the same shape.
 */
import type {
  AsyncResult,
  CustomValidatorResolution,
  ResolvedSource,
  ValidationHandle,
  ValidationInput,
} from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

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
