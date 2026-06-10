/**
 * Registry + async runner (#214): named strategies register and resolve, custom strategies are
 * first-class, and the runner drives an async validator under a strategy — emitting `pending{version}`
 * then the terminal answer only when it is still current, and enforcing the cross-plane source contract
 * at the emit boundary.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomValidatorResolutionRegistry,
  AsyncValidationRunner,
  UnknownResolutionError,
} from '../registry.js';
import {
  VersioningResolution,
  CancellationResolution,
  type AsyncResult,
  type CustomValidatorResolution,
  type ResolvedSource,
} from '../provider.js';
import { createDefaultRegistry, createDefaultRunner } from '../index.js';

/** A promise whose resolution we drive by hand, to interleave overlapping in-flight checks. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('CustomValidatorResolutionRegistry', () => {
  it('registers, resolves by name, and falls back to the default', () => {
    const registry = new CustomValidatorResolutionRegistry();
    registry.define(new VersioningResolution(), true);
    registry.define(new CancellationResolution());

    expect(registry.keys()).toEqual(['versioning', 'cancellation']);
    expect(registry.resolve('cancellation').key).toBe('cancellation');
    expect(registry.resolve().key).toBe('versioning'); // default
  });

  it('the first registered strategy becomes the default when none is flagged', () => {
    const registry = new CustomValidatorResolutionRegistry();
    registry.define(new CancellationResolution());
    expect(registry.resolve().key).toBe('cancellation');
  });

  it('throws on an unknown strategy rather than substituting silently', () => {
    const registry = createDefaultRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownResolutionError);
    expect(() => new CustomValidatorResolutionRegistry().resolve()).toThrow(UnknownResolutionError);
  });

  it('treats a custom strategy as first-class', () => {
    let starts = 0;
    const everyAnswerCounts: CustomValidatorResolution = {
      key: 'apply-all',
      startValidation: (fieldId, input) => ({ fieldId, input, version: ++starts }),
      shouldApplyResult: () => true,
      onInputChange: () => {},
    };
    const registry = createDefaultRegistry();
    registry.define(everyAnswerCounts);
    expect(registry.resolve('apply-all').key).toBe('apply-all');
  });
});

describe('AsyncValidationRunner', () => {
  it('emits pending then the resolved source, both stamped with the same generation version', async () => {
    const emitted: ResolvedSource[] = [];
    const runner = new AsyncValidationRunner(new VersioningResolution(), { emit: (s) => emitted.push(s), sourceName: 'async' });
    const r = await runner.validate('email', 'a@x', async () => ({ state: 'invalid', message: 'taken' }));

    expect(emitted.map((s) => s.state)).toEqual(['pending', 'invalid']);
    expect(emitted[0].version).toBe(emitted[1].version); // pending{v} → invalid{v} for one generation
    expect(r).toMatchObject({ source: 'async', state: 'invalid', message: 'taken' });
  });

  it('versioning drops a late answer for superseded input', async () => {
    const runner = createDefaultRunner(); // versioning default
    const slow = deferred<AsyncResult>();
    const p1 = runner.validate('email', 'a@x', () => slow.promise); // generation 1, still in flight

    const r2 = await runner.validate('email', 'ab@x', async () => ({ state: 'invalid', message: 'taken' })); // generation 2
    expect(r2?.state).toBe('invalid');

    slow.resolve({ state: 'valid' }); // the stale generation-1 answer finally arrives
    expect(await p1).toBeNull(); // dropped — its generation was superseded
  });

  it('cancellation aborts the in-flight request and drops its answer', async () => {
    const runner = new AsyncValidationRunner(createDefaultRegistry().resolve('cancellation'));
    const slow = deferred<AsyncResult>();
    let captured: AbortSignal | undefined;
    const p1 = runner.validate('email', 'a@x', (_input, signal) => {
      captured = signal;
      return slow.promise;
    });

    const r2 = await runner.validate('email', 'ab@x', async () => ({ state: 'valid' })); // aborts the prior request
    expect(captured?.aborted).toBe(true);
    expect(r2?.state).toBe('valid');

    slow.resolve({ state: 'invalid', message: 'late' });
    expect(await p1).toBeNull(); // dropped — its request was aborted
  });

  it('treats an aborted (rejecting) validator as a dropped generation, not a failure', async () => {
    const runner = new AsyncValidationRunner(new CancellationResolution());
    const onAbort = (signal?: AbortSignal) =>
      new Promise<AsyncResult>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    const p1 = runner.validate('email', 'a@x', (_input, signal) => onAbort(signal));
    await runner.validate('email', 'ab@x', async () => ({ state: 'valid' })); // aborts p1's request
    await expect(p1).resolves.toBeNull();
  });

  it('onInputChange supersedes an in-flight check (versioning)', async () => {
    const runner = createDefaultRunner();
    const slow = deferred<AsyncResult>();
    const p1 = runner.validate('email', 'a@x', () => slow.promise);
    runner.onInputChange('email', 'ab@x'); // user kept typing; no new check started yet
    slow.resolve({ state: 'valid' });
    expect(await p1).toBeNull();
  });

  it('swaps strategy at runtime (scope re-resolution)', async () => {
    const runner = new AsyncValidationRunner(new VersioningResolution());
    runner.useStrategy(new CancellationResolution());
    const r = await runner.validate('email', 'a@x', async () => ({ state: 'valid' }));
    expect(r?.state).toBe('valid');
  });

  it('enforces the ResolvedSource contract at the emit boundary', async () => {
    const rogue: CustomValidatorResolution = {
      key: 'rogue',
      // a handle with no numeric version → the emitted pending source breaks the cross-plane contract
      startValidation: (fieldId, input) => ({ fieldId, input, version: undefined as unknown as number }),
      shouldApplyResult: () => true,
      onInputChange: () => {},
    };
    const runner = new AsyncValidationRunner(rogue);
    await expect(runner.validate('email', 'a@x', async () => ({ state: 'valid' }))).rejects.toThrow(/ResolvedSource contract/);
  });
});
