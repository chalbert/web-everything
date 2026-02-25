/**
 * Integration tests: Namespace and domain patterns
 *
 * Tests multi-namespace providers, separate injector trees,
 * key naming edge cases, and namespaced hierarchy resolution.
 *
 * @module webinjectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

describe('Namespace and domain patterns', () => {
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

  describe('multiple namespaces on same injector', () => {
    it('should store and retrieve providers from different namespaces independently', () => {
      const injector = new TestInjector(root);

      const auth = { user: 'admin' };
      const theme = { mode: 'dark' };
      const store = { items: [] };
      const attrs = { onClick: () => {} };

      injector.set('customContexts:auth', auth);
      injector.set('customContexts:theme', theme);
      injector.set('customStores:app' as any, store);
      injector.set('customAttributes' as any, attrs);

      expect(injector.get('customContexts:auth')).toBe(auth);
      expect(injector.get('customContexts:theme')).toBe(theme);
      expect(injector.get('customStores:app')).toBe(store);
      expect(injector.get('customAttributes')).toBe(attrs);

      const entries = Array.from(injector.entries());
      expect(entries).toHaveLength(4);
    });
  });

  describe('separate injector trees', () => {
    it('should maintain independent providers for same key in unrelated trees', async () => {
      const treeARoot = document.createElement('div');
      const treeBRoot = document.createElement('div');
      document.body.appendChild(treeARoot);
      document.body.appendChild(treeBRoot);

      const treeA = new TestInjector(treeARoot);
      const treeB = new TestInjector(treeBRoot);

      treeA.set('customContexts:config', { env: 'development' });
      treeB.set('customContexts:config', { env: 'production' });

      const resultA = await treeA.consume('customContexts:config', treeARoot);
      const resultB = await treeB.consume('customContexts:config', treeBRoot);

      expect(resultA).toEqual({ env: 'development' });
      expect(resultB).toEqual({ env: 'production' });
      expect(resultA).not.toBe(resultB);
    });
  });

  describe('key naming edge cases', () => {
    it('should handle empty string as provider key', () => {
      const injector = new TestInjector(root);
      const value = { empty: true };

      injector.set('' as any, value);
      expect(injector.get('' as any)).toBe(value);
      expect(injector.delete('')).toBe(true);
      expect(injector.get('' as any)).toBeUndefined();
    });

    it('should handle keys with special characters', async () => {
      const injector = new TestInjector(root);

      injector.set('customContexts:my.deep.key' as any, 'dots');
      injector.set('custom/path' as any, 'slashes');
      injector.set('a:b:c' as any, 'multi-colon');

      expect(await injector.consume('customContexts:my.deep.key' as any, child)).toBe('dots');
      expect(await injector.consume('custom/path' as any, child)).toBe('slashes');
      expect(await injector.consume('a:b:c' as any, child)).toBe('multi-colon');
    });
  });

  describe('namespaced consume across hierarchy', () => {
    it('should resolve namespaced providers from parent chain', async () => {
      const parentEl = document.createElement('div');
      const childEl = document.createElement('span');
      parentEl.appendChild(childEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const childInj = new TestInjector(childEl, parent);

      parent.set('customContexts:auth', { role: 'admin' });
      parent.set('customStores:app' as any, { state: {} });

      const auth = await childInj.consume('customContexts:auth', childEl);
      const store = await childInj.consume('customStores:app' as any, childEl);

      expect(auth).toEqual({ role: 'admin' });
      expect(store).toEqual({ state: {} });
    });
  });
});
