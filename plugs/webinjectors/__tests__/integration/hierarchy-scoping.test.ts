/**
 * Integration tests: Hierarchy and scoping
 *
 * Tests multi-level injector chains, provider shadowing,
 * sibling isolation, reparenting, and mixed Module+HTML hierarchies.
 *
 * @module webinjectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';
import HTMLInjector from '../../HTMLInjector';
import ModuleInjector from '../../ModuleInjector';
import InjectorRoot from '../../InjectorRoot';
import CustomRegistry from '../../../core/CustomRegistry';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

const createMeta = (url = 'file:///test.ts'): ImportMeta => ({ url } as ImportMeta);

describe('Hierarchy and scoping', () => {
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

  describe('deep inheritance', () => {
    it('should resolve provider from great-grandparent through 3 intermediate injectors', async () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      const el3 = document.createElement('div');
      const el4 = document.createElement('div');
      el1.appendChild(el2);
      el2.appendChild(el3);
      el3.appendChild(el4);
      document.body.appendChild(el1);

      const greatGrandparent = new TestInjector(el1);
      const grandparent = new TestInjector(el2, greatGrandparent);
      const parent = new TestInjector(el3, grandparent);
      const leaf = new TestInjector(el4, parent);

      greatGrandparent.set('customContexts:root-only', { origin: 'great-grandparent' });

      const result = await leaf.consume('customContexts:root-only', el4);
      expect(result).toEqual({ origin: 'great-grandparent' });
    });
  });

  describe('provider shadowing', () => {
    it('should return closest provider when each level has the same key', async () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      const el3 = document.createElement('div');
      el1.appendChild(el2);
      el2.appendChild(el3);
      document.body.appendChild(el1);

      const rootInj = new TestInjector(el1);
      const midInj = new TestInjector(el2, rootInj);
      const leafInj = new TestInjector(el3, midInj);

      rootInj.set('customContexts:theme', 'root');
      midInj.set('customContexts:theme', 'mid');
      leafInj.set('customContexts:theme', 'leaf');

      expect(await leafInj.consume('customContexts:theme', el3)).toBe('leaf');
      expect(await midInj.consume('customContexts:theme', el2)).toBe('mid');
      expect(await rootInj.consume('customContexts:theme', el1)).toBe('root');
    });
  });

  describe('sibling isolation', () => {
    it('should prevent siblings from seeing each other\'s providers', async () => {
      const parentEl = document.createElement('div');
      const sibAEl = document.createElement('div');
      const sibBEl = document.createElement('div');
      const grandchildEl = document.createElement('span');
      parentEl.appendChild(sibAEl);
      parentEl.appendChild(sibBEl);
      sibAEl.appendChild(grandchildEl);
      document.body.appendChild(parentEl);

      const parentInj = new TestInjector(parentEl);
      const sibA = new TestInjector(sibAEl, parentInj);
      const sibB = new TestInjector(sibBEl, parentInj);
      const grandchild = new TestInjector(grandchildEl, sibA);

      sibA.set('customContexts:secret', 'a-secret');
      sibB.set('customContexts:secret', 'b-secret');

      expect(sibA.get('customContexts:secret')).toBe('a-secret');
      expect(sibB.get('customContexts:secret')).toBe('b-secret');
      expect(parentInj.get('customContexts:secret')).toBeUndefined();

      // Grandchild of sibA sees sibA's provider
      const result = await grandchild.consume('customContexts:secret', grandchildEl);
      expect(result).toBe('a-secret');
    });
  });

  describe('reparenting', () => {
    it('should resolve from new parent after reparenting', async () => {
      const elA = document.createElement('div');
      const elB = document.createElement('div');
      const elChild = document.createElement('span');
      elA.appendChild(elChild);
      document.body.appendChild(elA);
      document.body.appendChild(elB);

      const parentA = new TestInjector(elA);
      const parentB = new TestInjector(elB);
      const childInj = new TestInjector(elChild, parentA);

      parentA.set('customContexts:config', { env: 'dev' });
      parentB.set('customContexts:config', { env: 'prod' });

      expect(await childInj.consume('customContexts:config', elChild)).toEqual({ env: 'dev' });

      childInj.parentInjector = parentB;

      expect(await childInj.consume('customContexts:config', elChild)).toEqual({ env: 'prod' });
    });

    it('should remove child from old parent\'s childInjectors on reparent', () => {
      const elA = document.createElement('div');
      const elB = document.createElement('div');
      const elChild = document.createElement('span');
      elA.appendChild(elChild);
      document.body.appendChild(elA);
      document.body.appendChild(elB);

      const parentA = new TestInjector(elA);
      const parentB = new TestInjector(elB);
      const childInj = new TestInjector(elChild, parentA);

      expect(parentA.childInjectors.has(childInj)).toBe(true);

      childInj.parentInjector = parentB;

      // BUG: Old parent still references the child — memory leak
      // Expected: parentA.childInjectors should no longer contain childInj
      expect(parentA.childInjectors.has(childInj)).toBe(false);
    });
  });

  describe('mixed Module + HTML hierarchy', () => {
    let injectorRoot: InjectorRoot;

    afterEach(() => {
      injectorRoot?.detach(document);
    });

    it('should resolve through Module→HTML→HTML chain', async () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);
      moduleInjector.set('customContexts:apiKey', 'secret-123');

      injectorRoot = new InjectorRoot();
      injectorRoot.attach(document, moduleInjector);

      const container = document.createElement('div');
      document.body.appendChild(container);

      const rootInjector = injectorRoot.getInjectorOf(document)!;
      const result = await rootInjector.consume('customContexts:apiKey', container);
      expect(result).toBe('secret-123');
    });

    it('should shadow module provider at HTML level', async () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);
      moduleInjector.set('customContexts:locale', 'en');

      injectorRoot = new InjectorRoot();
      injectorRoot.attach(document, moduleInjector);

      const rootInjector = injectorRoot.getInjectorOf(document)!;
      rootInjector.set('customContexts:locale', 'fr');

      const container = document.createElement('div');
      document.body.appendChild(container);

      const result = await rootInjector.consume('customContexts:locale', container);
      expect(result).toBe('fr');
    });
  });

  describe('empty injectors in chain', () => {
    it('should skip empty injectors and find provider in ancestor', async () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      const el3 = document.createElement('div');
      el1.appendChild(el2);
      el2.appendChild(el3);
      document.body.appendChild(el1);

      const grandparent = new TestInjector(el1);
      const emptyParent = new TestInjector(el2, grandparent);
      const leaf = new TestInjector(el3, emptyParent);

      // Only grandparent has the provider
      grandparent.set('customContexts:theme', { mode: 'dark' });

      const result = await leaf.consume('customContexts:theme', el3);
      expect(result).toEqual({ mode: 'dark' });
    });
  });
});
