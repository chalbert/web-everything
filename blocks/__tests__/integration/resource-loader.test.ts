/**
 * Integration tests for the Resource Loader block.
 *
 * Tests ResourceLoader + InjectorRoot + traits together:
 * - Intent resolution from injector chain
 * - Trait composition (multiple traits on same element)
 * - Debounced timing (fast loads skip loading state)
 * - Abort behavior
 * - Event bubbling through DOM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import resource-loader block
import ResourceLoader from '../../resource-loader/ResourceLoader';
import { withSoftBlocking } from '../../resource-loader/traits/withSoftBlocking';
import { withIndeterminate } from '../../resource-loader/traits/withIndeterminate';
import { withReplacement } from '../../resource-loader/traits/withReplacement';
import type { LoaderIntent, ResourceStateChangeDetail } from '../../resource-loader/types';
import { DEFAULT_INTENT } from '../../resource-loader/types';

// Import plugs
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';

describe('ResourceLoader integration', () => {
  let injectorRoot: InjectorRoot;
  let target: HTMLDivElement;

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

  describe('intent resolution from injector chain', () => {
    it('should resolve intent from ancestor injector', () => {
      const container = document.createElement('section');
      document.body.appendChild(container);
      container.appendChild(target);

      // Provide intent on the container (ancestor)
      const injector = injectorRoot.ensureInjector(container);
      injector.set('customContexts:loaderIntent', {
        strategy: 'replacement',
        scope: 'viewport',
      } as Partial<LoaderIntent>);

      const loader = new ResourceLoader({ target });
      expect(loader.intent.strategy).toBe('replacement');
      expect(loader.intent.scope).toBe('viewport');
      // Defaults fill in the rest
      expect(loader.intent.progress).toBe(DEFAULT_INTENT.progress);
      expect(loader.intent.timing).toBe(DEFAULT_INTENT.timing);
    });

    it('should allow explicit intent to override injected intent', () => {
      const injector = injectorRoot.ensureInjector(target);
      injector.set('customContexts:loaderIntent', {
        strategy: 'replacement',
        timing: 'immediate',
      } as Partial<LoaderIntent>);

      const loader = new ResourceLoader({
        target,
        intent: { strategy: 'soft' },
      });

      // Explicit wins over injected
      expect(loader.intent.strategy).toBe('soft');
      // Injected wins over default
      expect(loader.intent.timing).toBe('immediate');
    });
  });

  describe('trait composition', () => {
    it('should apply withSoftBlocking + withIndeterminate together', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });

      const promise = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('data'), 500)),
        [
          () => withSoftBlocking(target),
          () => withIndeterminate(target),
        ],
      );

      // Both traits active during loading
      expect(target.getAttribute('aria-busy')).toBe('true');
      expect(target.style.pointerEvents).toBe('none');
      expect(target.getAttribute('data-loader-state')).toBe('loading');
      expect(target.getAttribute('data-loader-progress')).toBe('indeterminate');

      // Resolve
      vi.advanceTimersByTime(500);
      await promise;

      // Both traits cleaned up
      expect(target.hasAttribute('aria-busy')).toBe(false);
      expect(target.style.pointerEvents).toBe('');
      expect(target.hasAttribute('data-loader-state')).toBe(false);
      expect(target.hasAttribute('data-loader-progress')).toBe(false);
    });

    it('should apply withReplacement + withIndeterminate together', async () => {
      target.innerHTML = '<p>Original content</p>';

      const fallback = document.createElement('template');
      fallback.innerHTML = '<div class="spinner">Loading...</div>';

      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });

      const promise = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('data'), 300)),
        [
          () => withReplacement(target, { fallback }),
          () => withIndeterminate(target),
        ],
      );

      // Replacement trait: original content inside hidden container, fallback stamped
      const hiddenContainer = target.querySelector('[data-loader-hidden]');
      expect(hiddenContainer).not.toBeNull();
      expect(hiddenContainer!.hasAttribute('hidden')).toBe(true);
      expect(hiddenContainer!.querySelector('p')).not.toBeNull();
      expect(target.querySelector('[data-loader-fallback] .spinner')).not.toBeNull();

      // Indeterminate trait
      expect(target.getAttribute('data-loader-progress')).toBe('indeterminate');

      // Resolve
      vi.advanceTimersByTime(300);
      await promise;

      // Content restored (no hidden container), fallback removed
      expect(target.querySelector('[data-loader-hidden]')).toBeNull();
      expect(target.querySelector('[data-loader-fallback]')).toBeNull();
      expect(target.querySelector('p')!.textContent).toBe('Original content');
      expect(target.hasAttribute('data-loader-progress')).toBe(false);
    });
  });

  describe('debounced timing prevents flash', () => {
    it('should NOT activate traits when load resolves before threshold', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const factorySpy = vi.fn(() => ({ cleanup: vi.fn() }));

      // Fast operation (100ms < 400ms threshold)
      const promise = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('fast'), 100)),
        [factorySpy],
      );

      vi.advanceTimersByTime(100);
      await promise;

      // Trait factory never called — no flash of loading
      expect(factorySpy).not.toHaveBeenCalled();
    });

    it('should activate traits when load exceeds threshold', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const factorySpy = vi.fn(() => ({ cleanup: vi.fn() }));

      const promise = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 1000)),
        [factorySpy],
      );

      // Before threshold
      vi.advanceTimersByTime(300);
      expect(factorySpy).not.toHaveBeenCalled();

      // After threshold
      vi.advanceTimersByTime(100);
      expect(factorySpy).toHaveBeenCalledTimes(1);

      // Resolve
      vi.advanceTimersByTime(600);
      await promise;
    });
  });

  describe('abort behavior', () => {
    it('should clean up all traits when new load aborts previous', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });

      // First load with real traits
      const first = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('first'), 1000)),
        [
          () => withSoftBlocking(target),
          () => withIndeterminate(target),
        ],
      );

      // Traits are active
      expect(target.getAttribute('aria-busy')).toBe('true');
      expect(target.getAttribute('data-loader-progress')).toBe('indeterminate');

      // Second load aborts first, applying different traits
      const second = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve('second'), 100)),
        [() => withSoftBlocking(target)],
      );

      // First load's traits cleaned up, second load's traits applied
      expect(target.getAttribute('aria-busy')).toBe('true'); // still true from second load
      expect(target.hasAttribute('data-loader-progress')).toBe(false); // first trait cleaned up

      // Resolve second load
      vi.advanceTimersByTime(100);
      const result2 = await second;
      const result1 = await first;

      expect(result1.aborted).toBe(true);
      expect(result2.data).toBe('second');

      // All traits fully cleaned up
      expect(target.hasAttribute('aria-busy')).toBe(false);
    });
  });

  describe('event bubbling', () => {
    it('should bubble all events through DOM tree', async () => {
      const container = document.createElement('section');
      document.body.appendChild(container);
      container.appendChild(target);

      const events: string[] = [];

      // Listen on ancestor
      container.addEventListener('resource-load-start', () => events.push('start'));
      container.addEventListener('resource-load-end', () => events.push('end'));
      container.addEventListener('resource-state-change', () => events.push('state-change'));

      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });

      const promise = loader.load(() => Promise.resolve('data'));
      await vi.runAllTimersAsync();
      await promise;

      expect(events).toContain('start');
      expect(events).toContain('end');
      expect(events).toContain('state-change');
    });

    it('should include correct detail in resource-load-end event', async () => {
      let detail: any;
      document.body.addEventListener('resource-load-end', ((e: CustomEvent) => {
        detail = e.detail;
      }) as EventListener);

      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const promise = loader.load(() => Promise.resolve({ users: [1, 2, 3] }));
      await vi.runAllTimersAsync();
      await promise;

      expect(detail.data).toEqual({ users: [1, 2, 3] });
      expect(typeof detail.duration).toBe('number');
    });

    it('should include correct detail in resource-load-error event', async () => {
      let detail: any;
      document.body.addEventListener('resource-load-error', ((e: CustomEvent) => {
        detail = e.detail;
      }) as EventListener);

      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const promise = loader.load(() => Promise.reject(new Error('Network failure')));
      await vi.runAllTimersAsync();
      await promise;

      expect(detail.error.message).toBe('Network failure');
      expect(detail.retryable).toBe(false);
    });
  });

  describe('full lifecycle', () => {
    it('should track complete state transitions for debounced slow load', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'debounced' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(
        () => new Promise(resolve => setTimeout(() => resolve({ items: [1, 2] }), 1000)),
        [
          () => withSoftBlocking(target),
          () => withIndeterminate(target),
        ],
      );

      // Immediate: pending
      expect(states).toEqual(['pending']);

      // At 400ms: loading (traits activated)
      vi.advanceTimersByTime(400);
      expect(states).toEqual(['pending', 'loading']);
      expect(target.getAttribute('aria-busy')).toBe('true');

      // At 1000ms: success → idle (traits cleaned up)
      vi.advanceTimersByTime(600);
      await promise;

      expect(states).toEqual(['pending', 'loading', 'success', 'idle']);
      expect(target.hasAttribute('aria-busy')).toBe(false);
    });

    it('should track complete state transitions for immediate fast load', async () => {
      const loader = new ResourceLoader({ target, intent: { timing: 'immediate' } });
      const states: string[] = [];

      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(() => Promise.resolve('instant'));
      await vi.runAllTimersAsync();
      await promise;

      // immediate timing: pending skipped (0ms), straight to loading → success → idle
      expect(states).toContain('loading');
      expect(states).toContain('success');
      expect(states[states.length - 1]).toBe('idle');
    });

    it('should handle empty result with custom isEmpty', async () => {
      const loader = new ResourceLoader({
        target,
        intent: { timing: 'immediate' },
        isEmpty: (data) => (data as any)?.items?.length === 0,
      });

      const states: string[] = [];
      target.addEventListener('resource-state-change', ((e: CustomEvent<ResourceStateChangeDetail>) => {
        states.push(e.detail.newState);
      }) as EventListener);

      const promise = loader.load(() => Promise.resolve({ items: [] }));
      await vi.runAllTimersAsync();
      await promise;

      expect(states).toContain('empty');
    });
  });
});
