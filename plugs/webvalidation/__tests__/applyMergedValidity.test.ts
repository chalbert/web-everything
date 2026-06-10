/**
 * The `MergedValidity` → `ElementInternals.setValidity` bridge (#215). Tested over a fake sink so the
 * mapping is verified without a live form-associated element; the demo proves the native styling.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyMergedValidity, type ValiditySink } from '../applyMergedValidity';
import { createDefaultValidityMergeRegistry } from '../CustomValidityMergeRegistry';
import { ValiditySourceOrchestrator } from '../../../validity-merge/registry.js';
import type { MergedValidity } from '../../../validity-merge/provider.js';

function fakeSink(): ValiditySink & { setValidity: ReturnType<typeof vi.fn> } {
  return { setValidity: vi.fn() };
}

const merged = (over: Partial<MergedValidity>): MergedValidity => ({
  state: 'idle',
  valid: false,
  pending: false,
  messages: [],
  blocking: null,
  version: 0,
  ...over,
});

describe('applyMergedValidity', () => {
  it('valid → setValidity({}) (clears) and returns no message', () => {
    const sink = fakeSink();
    const msg = applyMergedValidity(sink, merged({ state: 'valid', valid: true }));
    expect(sink.setValidity).toHaveBeenCalledWith({});
    expect(msg).toBe('');
  });

  it('idle → setValidity({}) (the platform treats "nothing said yet" as valid)', () => {
    const sink = fakeSink();
    applyMergedValidity(sink, merged({ state: 'idle' }));
    expect(sink.setValidity).toHaveBeenCalledWith({});
  });

  it('pending → customError with a transient "Validating…" message (blocks submit)', () => {
    const sink = fakeSink();
    const msg = applyMergedValidity(sink, merged({ state: 'pending', pending: true }));
    expect(sink.setValidity).toHaveBeenCalledWith({ customError: true }, 'Validating…', undefined);
    expect(msg).toBe('Validating…');
  });

  it('invalid → customError with the blocking source\'s message', () => {
    const sink = fakeSink();
    const m = merged({
      state: 'invalid',
      blocking: 'async',
      messages: [
        { source: 'schema', message: 'Bad format' },
        { source: 'async', message: 'Email already taken' },
      ],
    });
    const msg = applyMergedValidity(sink, m);
    expect(sink.setValidity).toHaveBeenCalledWith({ customError: true }, 'Email already taken', undefined);
    expect(msg).toBe('Email already taken');
  });

  it('invalid with no matching blocking message falls back to the first message', () => {
    const sink = fakeSink();
    const m = merged({
      state: 'invalid',
      blocking: 'native',
      messages: [{ source: 'schema', message: 'Bad format' }],
    });
    applyMergedValidity(sink, m);
    expect(sink.setValidity).toHaveBeenCalledWith({ customError: true }, 'Bad format', undefined);
  });

  it('invalid with no messages at all falls back to a generic string', () => {
    const sink = fakeSink();
    applyMergedValidity(sink, merged({ state: 'invalid', blocking: 'native' }));
    expect(sink.setValidity).toHaveBeenCalledWith({ customError: true }, 'Invalid', undefined);
  });

  it('passes the anchor through to setValidity', () => {
    const sink = fakeSink();
    const anchor = { tagName: 'INPUT' } as unknown as HTMLElement;
    applyMergedValidity(sink, merged({ state: 'invalid', blocking: 'x', messages: [{ source: 'x', message: 'no' }] }), anchor);
    expect(sink.setValidity).toHaveBeenCalledWith({ customError: true }, 'no', anchor);
  });

  it('end-to-end: orchestrator output drives the sink (source-reduction strictest-wins)', () => {
    const sink = fakeSink();
    const registry = createDefaultValidityMergeRegistry();
    const orchestrator = new ValiditySourceOrchestrator(registry.resolve());

    orchestrator.set('native', { state: 'valid' });
    applyMergedValidity(sink, orchestrator.set('schema', { state: 'valid' }));
    expect(sink.setValidity).toHaveBeenLastCalledWith({});

    // An async check goes in flight → pending wins over the valid sources.
    applyMergedValidity(sink, orchestrator.set('async', { state: 'pending' }));
    expect(sink.setValidity).toHaveBeenLastCalledWith({ customError: true }, 'Validating…', undefined);

    // The check resolves invalid → invalid, blocking on async.
    applyMergedValidity(sink, orchestrator.set('async', { state: 'invalid', message: 'Taken' }));
    expect(sink.setValidity).toHaveBeenLastCalledWith({ customError: true }, 'Taken', undefined);
  });

  it('swapping to last-write-wins changes the merged result with no source-feeding edits', () => {
    const sink = fakeSink();
    const registry = createDefaultValidityMergeRegistry();
    const orchestrator = new ValiditySourceOrchestrator(registry.resolve('source-reduction'));

    orchestrator.set('native', { state: 'invalid', message: 'Native says no' });
    applyMergedValidity(sink, orchestrator.set('manual', { state: 'valid' }));
    // source-reduction: any invalid fails → invalid.
    expect(sink.setValidity).toHaveBeenLastCalledWith({ customError: true }, 'Native says no', undefined);

    // Swap strategy only — same sources.
    orchestrator.useStrategy(registry.resolve('last-write-wins'));
    applyMergedValidity(sink, orchestrator.merged());
    // last-write-wins: the most recent write ('manual' valid) wins → valid.
    expect(sink.setValidity).toHaveBeenLastCalledWith({});
  });
});
