/**
 * Error Recovery protocol standalone model (#1019/#1052): the dependency-free
 * `CustomRecoveryHandlerRegistry` + the `assertRecoveryResult` trust-boundary guard. The runtime
 * `customRecovery` plug fulfils the same `define`/`values`/`recover` surface as a core `CustomRegistry`;
 * this pins the contract the plug must not drift from. Mirrors `guard/__tests__/registry.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomRecoveryHandlerRegistry,
  UnknownRecoveryHandlerError,
  createDefaultRegistry,
  assertRecoveryResult,
  RecoveryResultError,
  RECOVERY_OUTCOMES,
  FAILURE_DISPOSITIONS,
  type CustomRecoveryHandler,
  type RecoveryContext,
  type RecoveryError,
  type RecoveryResult,
} from '../index.js';

const ctx = (attempt = 0, operationId = 'op-1'): RecoveryContext => ({ error: undefined, attempt, operationId });

/** A handler that accepts only errors of a given `kind`, declining (null) everything else. */
class KindHandler implements CustomRecoveryHandler {
  constructor(
    readonly key: string,
    private readonly kind: string,
    private readonly result: RecoveryResult,
  ) {}
  async tryRecover(error: RecoveryError, _context: RecoveryContext): Promise<RecoveryResult | null> {
    return (error as { kind?: string } | null)?.kind === this.kind ? this.result : null;
  }
}

describe('CustomRecoveryHandlerRegistry (standalone model)', () => {
  it('has the customRecovery localName', () => {
    expect(new CustomRecoveryHandlerRegistry().localName).toBe('customRecovery');
  });

  it('createDefaultRegistry() is empty — the protocol ships no default handlers', () => {
    const registry = createDefaultRegistry();
    expect(registry.keys()).toEqual([]);
    expect(registry.values()).toEqual([]);
  });

  it('define(handler) keys by handler.key and preserves registration (priority) order', () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define(new KindHandler('a', 'x', { outcome: 'retry' }));
    registry.define(new KindHandler('b', 'y', { outcome: 'abort' }));
    expect(registry.keys()).toEqual(['a', 'b']);
    expect(registry.values().map((h) => h.key)).toEqual(['a', 'b']);
    expect(registry.has('a')).toBe(true);
  });

  it('re-registering a key replaces the handler in place (keeps its priority slot)', () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define(new KindHandler('a', 'x', { outcome: 'retry' }));
    registry.define(new KindHandler('b', 'y', { outcome: 'abort' }));
    registry.define(new KindHandler('a', 'x', { outcome: 'queued' })); // re-set 'a'
    expect(registry.keys()).toEqual(['a', 'b']); // slot preserved, not moved to the end
    expect(registry.get('a')).toBeDefined();
  });

  it('resolve(key) returns the named handler; throws UnknownRecoveryHandlerError otherwise', () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define(new KindHandler('a', 'x', { outcome: 'retry' }));
    expect(registry.resolve('a').key).toBe('a');
    expect(() => registry.resolve('nope')).toThrow(UnknownRecoveryHandlerError);
  });
});

describe('recover() — first-that-accepts wins (ordered dispatch)', () => {
  it('returns null when no handler is registered (no recovery)', async () => {
    expect(await new CustomRecoveryHandlerRegistry().recover({ kind: 'x' }, ctx())).toBeNull();
  });

  it('returns null when every handler declines', async () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define(new KindHandler('a', 'x', { outcome: 'retry' }));
    expect(await registry.recover({ kind: 'unrecognized' }, ctx())).toBeNull();
  });

  it('delegates to the first handler that accepts and short-circuits the walk', async () => {
    const registry = new CustomRecoveryHandlerRegistry();
    let secondCalled = false;
    registry.define(new KindHandler('first', 'x', { outcome: 'retry', delay: 100 }));
    registry.define({
      key: 'second',
      async tryRecover() {
        secondCalled = true;
        return { outcome: 'abort' };
      },
    });
    const r = await registry.recover({ kind: 'x' }, ctx());
    expect(r?.outcome).toBe('retry');
    expect(secondCalled).toBe(false); // short-circuited — second never tried
  });

  it('skips a declining handler and tries the next (registration order is priority)', async () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define(new KindHandler('http', 'http', { outcome: 'retry' }));
    registry.define(new KindHandler('offline', 'offline', { outcome: 'queued' }));
    expect((await registry.recover({ kind: 'offline' }, ctx()))?.outcome).toBe('queued');
  });

  it('validates the crossing answer — a malformed result throws RecoveryResultError', async () => {
    const registry = new CustomRecoveryHandlerRegistry();
    registry.define({
      key: 'rogue',
      async tryRecover() {
        return { outcome: 'explode' } as unknown as RecoveryResult; // not a closed-set outcome
      },
    });
    await expect(registry.recover({ kind: 'x' }, ctx())).rejects.toBeInstanceOf(RecoveryResultError);
  });
});

describe('assertRecoveryResult (trust boundary)', () => {
  it('passes null/undefined through as the legitimate decline', () => {
    expect(assertRecoveryResult('h', null)).toBeNull();
    expect(assertRecoveryResult('h', undefined)).toBeNull();
  });

  it('accepts every closed-set outcome', () => {
    for (const outcome of RECOVERY_OUTCOMES) {
      expect(assertRecoveryResult('h', { outcome })).toEqual({ outcome });
    }
  });

  it('accepts the #1032 disposition + phase fields and a registered-extension phase', () => {
    for (const disposition of FAILURE_DISPOSITIONS) {
      expect(assertRecoveryResult('h', { outcome: 'retry', disposition })).toMatchObject({ disposition });
    }
    expect(assertRecoveryResult('h', { outcome: 'retry', phase: 'retrying' })).toMatchObject({ phase: 'retrying' });
    // open meta-schema — a registered extension (no contract break)
    expect(assertRecoveryResult('h', { outcome: 'retry', phase: 'circuit-open' })).toMatchObject({ phase: 'circuit-open' });
  });

  it('strips handler-private extra keys so only contract fields cross', () => {
    const r = assertRecoveryResult('h', { outcome: 'retry', delay: 50, secret: 'leak' } as Record<string, unknown>);
    expect(r).toEqual({ outcome: 'retry', delay: 50 });
    expect(r && 'secret' in r).toBe(false);
  });

  it('rejects a non-object, a bad outcome, a bad disposition, a negative delay, and an empty phase', () => {
    expect(() => assertRecoveryResult('h', 42)).toThrow(RecoveryResultError);
    expect(() => assertRecoveryResult('h', { outcome: 'nope' })).toThrow(RecoveryResultError);
    expect(() => assertRecoveryResult('h', { outcome: 'retry', disposition: 'bogus' })).toThrow(RecoveryResultError);
    expect(() => assertRecoveryResult('h', { outcome: 'retry', delay: -1 })).toThrow(RecoveryResultError);
    expect(() => assertRecoveryResult('h', { outcome: 'retry', phase: '' })).toThrow(RecoveryResultError);
  });
});
