/**
 * Integration tests: Concurrency and error handling
 *
 * Tests loader failures, retry behavior, concurrent consumption,
 * dispose during in-flight loads, and cross-injector concurrency.
 *
 * @module webinjectors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

describe('Concurrency and error handling', () => {
  let root: HTMLElement;
  let child: HTMLElement;
  let injector: TestInjector;

  beforeEach(() => {
    root = document.createElement('div');
    child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
    injector = new TestInjector(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('loader errors', () => {
    it('should reject consume() when loader throws an error', async () => {
      injector.register('customContexts:broken' as any, async () => {
        throw new Error('network timeout');
      });

      await expect(
        injector.consume('customContexts:broken' as any, child),
      ).rejects.toThrow('network timeout');
    });

    it('should allow retry after loader failure', async () => {
      let callCount = 0;
      injector.register('customContexts:flaky' as any, async () => {
        callCount++;
        if (callCount === 1) throw new Error('first attempt failed');
        return { status: 'ok' };
      });

      // First attempt fails
      await expect(
        injector.consume('customContexts:flaky' as any, child),
      ).rejects.toThrow('first attempt failed');

      // Second attempt retries with fresh loader call
      const result = await injector.consume('customContexts:flaky' as any, child);
      expect(result).toEqual({ status: 'ok' });
      expect(callCount).toBe(2);
    });

    it('should reject all concurrent consumers when loader fails', async () => {
      const loader = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw new Error('load failed');
      });

      injector.register('customContexts:service' as any, loader);

      const results = await Promise.allSettled([
        injector.consume('customContexts:service' as any, child),
        injector.consume('customContexts:service' as any, child),
        injector.consume('customContexts:service' as any, child),
      ]);

      expect(results.every((r) => r.status === 'rejected')).toBe(true);
      expect(loader).toHaveBeenCalledOnce();
    });
  });

  describe('dispose during load', () => {
    it('should not write to providers after dispose', async () => {
      injector.register('customContexts:slow' as any, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { data: 'loaded' };
      });

      const consumePromise = injector.consume('customContexts:slow' as any, child);

      // Dispose immediately while load is in-flight
      injector.dispose();
      expect(injector.get('customContexts:slow')).toBeUndefined();

      // Wait for the load to complete — value still resolves but not stored
      const value = await consumePromise;
      expect(value).toEqual({ data: 'loaded' });

      // Providers remain empty after dispose — no zombie state
      expect(injector.get('customContexts:slow')).toBeUndefined();
    });
  });

  describe('register during in-flight load', () => {
    it('should document behavior when register() is called during in-flight load', async () => {
      injector.register('customContexts:service' as any, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { version: 1 };
      });

      // Start loading
      const firstConsume = injector.consume('customContexts:service' as any, child);

      // Re-register with new loader while first is in-flight
      injector.register('customContexts:service' as any, async () => {
        return { version: 2 };
      });

      // First consume completes with version 1 (already in-flight)
      const result = await firstConsume;
      expect(result).toEqual({ version: 1 });
    });
  });

  describe('concurrent cross-injector loads', () => {
    it('should resolve concurrent lazy loads across parent and child independently', async () => {
      const parentEl = document.createElement('div');
      const childEl = document.createElement('span');
      parentEl.appendChild(childEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const childInj = new TestInjector(childEl, parent);

      parent.register('customContexts:auth' as any, async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { user: 'admin' };
      });

      childInj.register('customContexts:theme' as any, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { mode: 'dark' };
      });

      const [auth, theme] = await Promise.all([
        childInj.consume('customContexts:auth' as any, childEl),
        childInj.consume('customContexts:theme' as any, childEl),
      ]);

      expect(auth).toEqual({ user: 'admin' });
      expect(theme).toEqual({ mode: 'dark' });
    });
  });
});
