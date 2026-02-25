/**
 * Integration tests: Provider lifecycle — advanced scenarios
 *
 * Tests hot replacement, delete-re-register cycles, HTMLInjector
 * set bypass, dispose cascading, and fluent API.
 *
 * @module webinjectors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';
import HTMLInjector from '../../HTMLInjector';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

describe('Provider lifecycle — advanced', () => {
  let root: HTMLElement;
  let child: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('hot replacement', () => {
    it('should return new value on subsequent consume after hot-replacing a provider', async () => {
      const injector = new TestInjector(root);
      const original = { value: 0 };
      const replacement = { value: 1 };

      injector.set('customContexts:counter', original);
      const first = await injector.consume('customContexts:counter', child);
      expect(first).toBe(original);

      injector.set('customContexts:counter', replacement);
      const second = await injector.consume('customContexts:counter', child);
      expect(second).toBe(replacement);
      expect(second).not.toBe(first);
    });
  });

  describe('delete then re-register', () => {
    it('should lazy-load after delete + re-register cycle', async () => {
      const injector = new TestInjector(root);

      injector.set('customContexts:service', { version: 1 });
      expect(injector.get('customContexts:service')).toEqual({ version: 1 });

      injector.delete('customContexts:service');
      expect(injector.get('customContexts:service')).toBeUndefined();

      const loader = vi.fn(async () => ({ version: 2 }));
      injector.register('customContexts:service' as any, loader);

      const result = await injector.consume('customContexts:service' as any, child);
      expect(result).toEqual({ version: 2 });
      expect(loader).toHaveBeenCalledOnce();
    });
  });

  describe('HTMLInjector.set() bypass', () => {
    it('should not let stale loader overwrite eager set after in-flight load', async () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const htmlInjector = new HTMLInjector(element);

      // Register a delayed loader
      htmlInjector.register('customAttributes' as any, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { source: 'lazy' };
      });

      // Start loading via consume
      const loadPromise = htmlInjector.consume('customAttributes', element);

      // Set eagerly WHILE load is in-flight — clears #loading via super.set()
      htmlInjector.set('customAttributes', { source: 'eager' });

      // Wait for the in-flight load to finish
      await loadPromise;

      // Eager value wins since set() cleared the in-flight state
      expect(htmlInjector.get('customAttributes')).toEqual({ source: 'eager' });
    });
  });

  describe('dispose cascading', () => {
    it('should not affect sibling injector when one child is disposed', async () => {
      const parentEl = document.createElement('div');
      const sibAEl = document.createElement('div');
      const sibBEl = document.createElement('div');
      parentEl.appendChild(sibAEl);
      parentEl.appendChild(sibBEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const sibA = new TestInjector(sibAEl, parent);
      const sibB = new TestInjector(sibBEl, parent);

      sibA.set('customContexts:a', { name: 'A' });
      sibB.set('customContexts:b', { name: 'B' });

      sibA.dispose();

      expect(parent.childInjectors.has(sibA)).toBe(false);
      expect(parent.childInjectors.has(sibB)).toBe(true);
      expect(sibB.get('customContexts:b')).toEqual({ name: 'B' });
    });

    it('should leave child unable to resolve after parent dispose', async () => {
      const parentEl = document.createElement('div');
      const childEl = document.createElement('span');
      parentEl.appendChild(childEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const childInj = new TestInjector(childEl, parent);

      parent.set('customContexts:shared', { data: 'available' });

      // Verify it works first
      const before = await childInj.consume('customContexts:shared', childEl);
      expect(before).toEqual({ data: 'available' });

      parent.dispose();

      // Child still points to parent, but parent's providers are cleared
      await expect(
        childInj.consume('customContexts:shared', childEl),
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('fluent API', () => {
    it('should support chaining set() calls', () => {
      const injector = new TestInjector(root);

      injector
        .set('customContexts:a', 'alpha')
        .set('customContexts:b', 'beta')
        .set('customContexts:c', 'gamma');

      expect(injector.get('customContexts:a')).toBe('alpha');
      expect(injector.get('customContexts:b')).toBe('beta');
      expect(injector.get('customContexts:c')).toBe('gamma');
    });
  });
});
