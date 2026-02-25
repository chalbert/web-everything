/**
 * Unit tests for ResourceLoader core orchestrator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResourceLoader from '../../../resource-loader/ResourceLoader';
import InjectorRoot from '../../../../plugs/webinjectors/InjectorRoot';
import type { LoaderIntent, TraitFactory, ResourceStateChangeDetail } from '../../../resource-loader/types';
import { DEFAULT_INTENT } from '../../../resource-loader/types';

describe('ResourceLoader', () => {
  let target: HTMLDivElement;
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    target = document.createElement('div');
    document.body.appendChild(target);

    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
  });

  afterEach(() => {
    injectorRoot.detach(document);
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  /** Helper: create a promise that resolves after awaiting microtasks */
  function createDelayedPromise<T>(value: T, ms: number): (signal: AbortSignal) => Promise<T> {
    return () => new Promise(resolve => setTimeout(() => resolve(value), ms));
  }

  function createImmediatePromise<T>(value: T): (signal: AbortSignal) => Promise<T> {
    return () => Promise.resolve(value);
  }

  function createFailingPromise(error: Error): (signal: AbortSignal) => Promise<never> {
    return () => Promise.reject(error);
  }

  describe('construction', () => {
    it('should initialize in idle state', () => {
      const loader = new ResourceLoader({ target });
      expect(loader.state).toBe('idle');
    });

    it('should accept target element', () => {
      const loader = new ResourceLoader({ target });
      expect(loader.target).toBe(target);
    });
  });

  describe('intent resolution', () => {
    it('should return DEFAULT_INTENT when no injector provides one', () => {
      const loader = new ResourceLoader({ target });
      expect(loader.intent).toEqual(DEFAULT_INTENT);
    });

    it('should resolve intent from injector chain', () => {
      const injector = injectorRoot.ensureInjector(target);
      injector.set('customContexts:loaderIntent', { strategy: 'replacement' });

      const loader = new ResourceLoader({ target });
      expect(loader.intent.strategy).toBe('replacement');
      expect(loader.intent.timing).toBe('debounced'); // rest from default
    });

    it('should merge explicit intent over injected intent', () => {
      const injector = injectorRoot.ensureInjector(target);
      injector.set('customContexts:loaderIntent', { strategy: 'replacement', timing: 'immediate' });

      const loader = new ResourceLoader({
        target,
        intent: { strategy: 'soft' },
      });
      expect(loader.intent.strategy).toBe('soft');
      expect(loader.intent.timing).toBe('immediate'); // from injected
    });

    it('should merge both over DEFAULT_INTENT', () => {
      const loader = new ResourceLoader({
        target,
        intent: { timing: 'immediate' },
      });
      expect(loader.intent.strategy).toBe('soft'); // from default
      expect(loader.intent.timing).toBe('immediate'); // from explicit
    });
  });

  describe('state machine', () => {
    it('should transition idle → pending on load()', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createImmediatePromise({ ok: true }));
      await vi.runAllTimersAsync();
      await promise;

      // Should see: pending (skipped in immediate), loading, success, idle
      // or for immediate: loading, success, idle
      expect(states).toContain('success');
      expect(states[states.length - 1]).toBe('idle');
    });

    it('should transition to loading after timing threshold', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createDelayedPromise({ ok: true }, 1000));

      // Before threshold: only pending
      expect(states).toContain('pending');
      expect(states).not.toContain('loading');

      // Advance past debounce threshold
      vi.advanceTimersByTime(400);
      expect(states).toContain('loading');

      // Advance past async resolution
      vi.advanceTimersByTime(600);
      await promise;

      expect(states).toContain('success');
    });

    it('should skip loading state when resolved before threshold', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      // Fast promise (100ms < 400ms threshold)
      const promise = loader.load(createDelayedPromise({ ok: true }, 100));

      vi.advanceTimersByTime(100);
      await promise;

      expect(states).toContain('pending');
      expect(states).not.toContain('loading');
      expect(states).toContain('success');
    });

    it('should transition to empty when isEmpty returns true', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createImmediatePromise(null));
      await vi.runAllTimersAsync();
      await promise;

      expect(states).toContain('empty');
    });

    it('should transition to error on rejection', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createFailingPromise(new Error('fail')));
      await vi.runAllTimersAsync();
      await promise;

      expect(states).toContain('error');
    });

    it('should dispatch resource-state-change on every transition', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const events: ResourceStateChangeDetail[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        events.push(e.detail);
      }) as EventListener);

      const promise = loader.load(createImmediatePromise({ data: 1 }));
      await vi.runAllTimersAsync();
      await promise;

      // Should have multiple transitions
      expect(events.length).toBeGreaterThan(0);
      // Last transition should be to idle
      expect(events[events.length - 1].newState).toBe('idle');
    });
  });

  describe('timing', () => {
    it('should use immediate timing (0ms) when intent says immediate', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createDelayedPromise('data', 100));

      // Should go straight to loading without waiting
      expect(states).toContain('loading');

      vi.advanceTimersByTime(100);
      await promise;
    });

    it('should debounce at 400ms when intent says debounced', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createDelayedPromise('data', 1000));

      // At 200ms: still pending
      vi.advanceTimersByTime(200);
      expect(states).not.toContain('loading');

      // At 400ms: should transition to loading
      vi.advanceTimersByTime(200);
      expect(states).toContain('loading');

      vi.advanceTimersByTime(600);
      await promise;
    });

    it('should accept custom timing values', async () => {
      const loader = new ResourceLoader({
        target,
        intent: { timing: 'slow' },
        timings: { slow: 1000 },
      });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(createDelayedPromise('data', 2000));

      vi.advanceTimersByTime(500);
      expect(states).not.toContain('loading');

      vi.advanceTimersByTime(500);
      expect(states).toContain('loading');

      vi.advanceTimersByTime(1000);
      await promise;
    });
  });

  describe('abort', () => {
    it('should abort previous load when load() called again', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      let firstAborted = false;

      const first = loader.load(async (signal) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve('first'), 1000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            firstAborted = true;
          });
        });
      });

      // Start second load immediately (should abort first)
      const second = loader.load(createDelayedPromise('second', 100));

      vi.advanceTimersByTime(100);
      const result1 = await first;
      const result2 = await second;

      expect(result1.aborted).toBe(true);
      expect(result2.data).toBe('second');
    });

    it('should transition to idle on abort', () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });

      loader.load(createDelayedPromise('data', 1000));
      expect(loader.state).not.toBe('idle');

      loader.abort();
      expect(loader.state).toBe('idle');
    });

    it('should clean up traits on abort', () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const cleanupSpy = vi.fn();
      const traitFactory: TraitFactory = () => ({ cleanup: cleanupSpy });

      loader.load(createDelayedPromise('data', 1000), [traitFactory]);
      loader.abort();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('trait activation', () => {
    it('should not call trait factories in pending state', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const factorySpy = vi.fn(() => ({ cleanup: vi.fn() }));

      loader.load(createDelayedPromise('data', 100), [factorySpy]);

      // Still in pending, before 400ms threshold
      expect(factorySpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });

    it('should call trait factories when entering loading state', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const factorySpy = vi.fn(() => ({ cleanup: vi.fn() }));

      const promise = loader.load(createDelayedPromise('data', 1000), [factorySpy]);

      // Advance past threshold
      vi.advanceTimersByTime(400);
      expect(factorySpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600);
      await promise;
    });

    it('should call cleanup on all traits when load resolves', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const promise = loader.load(createDelayedPromise('data', 100), [
        () => ({ cleanup: cleanup1 }),
        () => ({ cleanup: cleanup2 }),
      ]);

      vi.advanceTimersByTime(100);
      await promise;

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should cleanup traits in reverse order (LIFO)', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const order: number[] = [];

      const promise = loader.load(createDelayedPromise('data', 100), [
        () => ({ cleanup: () => order.push(1) }),
        () => ({ cleanup: () => order.push(2) }),
        () => ({ cleanup: () => order.push(3) }),
      ]);

      vi.advanceTimersByTime(100);
      await promise;

      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('events', () => {
    it('should dispatch resource-load-start when entering loading state', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const events: Event[] = [];

      target.addEventListener('resource-load-start', (e) => events.push(e));

      const promise = loader.load(createDelayedPromise('data', 100));

      // Should fire immediately (immediate timing)
      expect(events.length).toBe(1);

      vi.advanceTimersByTime(100);
      await promise;
    });

    it('should dispatch resource-load-end on success', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      let detail: any;

      target.addEventListener('resource-load-end', ((e: CustomEvent) => {
        detail = e.detail;
      }) as EventListener);

      const promise = loader.load(createImmediatePromise({ name: 'test' }));
      await vi.runAllTimersAsync();
      await promise;

      expect(detail).toBeDefined();
      expect(detail.data).toEqual({ name: 'test' });
      expect(typeof detail.duration).toBe('number');
    });

    it('should dispatch resource-load-error on failure', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      let detail: any;

      target.addEventListener('resource-load-error', ((e: CustomEvent) => {
        detail = e.detail;
      }) as EventListener);

      const promise = loader.load(createFailingPromise(new Error('test error')));
      await vi.runAllTimersAsync();
      await promise;

      expect(detail).toBeDefined();
      expect(detail.error.message).toBe('test error');
    });

    it('should not dispatch resource-load-start if resolved before threshold', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const events: Event[] = [];

      target.addEventListener('resource-load-start', (e) => events.push(e));

      const promise = loader.load(createDelayedPromise('fast', 100));

      vi.advanceTimersByTime(100);
      await promise;

      expect(events.length).toBe(0);
    });

    it('should bubble all events', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const events: string[] = [];

      document.body.addEventListener('resource-load-start', () => events.push('start'));
      document.body.addEventListener('resource-load-end', () => events.push('end'));

      const promise = loader.load(createImmediatePromise('data'));
      await vi.runAllTimersAsync();
      await promise;

      expect(events).toContain('start');
      expect(events).toContain('end');
    });
  });

  describe('isEmpty', () => {
    it('should consider null as empty', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createImmediatePromise(null));
      await vi.runAllTimersAsync();
      expect(result.state).toBe('empty');
    });

    it('should consider undefined as empty', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createImmediatePromise(undefined));
      await vi.runAllTimersAsync();
      expect(result.state).toBe('empty');
    });

    it('should consider empty array as empty', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createImmediatePromise([]));
      await vi.runAllTimersAsync();
      expect(result.state).toBe('empty');
    });

    it('should consider non-empty object as non-empty', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createImmediatePromise({ id: 1 }));
      await vi.runAllTimersAsync();
      expect(result.state).toBe('success');
    });

    it('should use custom isEmpty function when provided', async () => {
      const loader = new ResourceLoader({
        target,
        intent: { timing: 'immediate' },
        isEmpty: (data) => (data as any)?.count === 0,
      });

      const result = await loader.load(createImmediatePromise({ count: 0 }));
      await vi.runAllTimersAsync();
      expect(result.state).toBe('empty');
    });
  });

  describe('destroy', () => {
    it('should abort current load', () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      loader.load(createDelayedPromise('data', 1000));

      loader.destroy();
      expect(loader.state).toBe('idle');
    });
  });

  describe('LoadResult', () => {
    it('should return data on success', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createImmediatePromise({ id: 42 }));
      await vi.runAllTimersAsync();

      expect(result.state).toBe('success');
      expect(result.data).toEqual({ id: 42 });
      expect(result.aborted).toBe(false);
      expect(typeof result.duration).toBe('number');
    });

    it('should return error on failure', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const result = await loader.load(createFailingPromise(new Error('boom')));
      await vi.runAllTimersAsync();

      expect(result.state).toBe('error');
      expect(result.error?.message).toBe('boom');
      expect(result.aborted).toBe(false);
    });
  });
});
