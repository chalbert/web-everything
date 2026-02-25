/**
 * Unit tests for Injector base class
 *
 * @module webinjectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Injector from '../../Injector';
import CustomRegistry from '../../../core/CustomRegistry';

// Mock implementation for testing
class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

class TestRegistry extends CustomRegistry<any> {
  localName = 'testRegistry';
}

describe('Injector', () => {
  let parentElement: HTMLElement;
  let childElement: HTMLElement;
  let parentInjector: TestInjector;

  beforeEach(() => {
    parentElement = document.createElement('div');
    childElement = document.createElement('span');
    parentElement.appendChild(childElement);
    document.body.appendChild(parentElement);

    parentInjector = new TestInjector(parentElement);
  });

  describe('constructor', () => {
    it('should create injector with target', () => {
      expect(parentInjector.target).toBe(parentElement);
    });

    it('should throw if target is null', () => {
      expect(() => new TestInjector(null as any)).toThrow('Injector target must be provided');
    });

    it('should link to parent injector', () => {
      const childInjector = new TestInjector(childElement, parentInjector);

      expect(childInjector.parentInjector).toBe(parentInjector);
      expect(parentInjector.childInjectors.has(childInjector)).toBe(true);
    });

    it('should prevent setting itself as parent', () => {
      const injector = new TestInjector(parentElement);

      expect(() => {
        injector.parentInjector = injector;
      }).toThrow('Cannot set itself as own parent');
    });
  });

  describe('provider management', () => {
    it('should set and get providers', () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);

      expect(parentInjector.get('testRegistry')).toBe(registry);
    });

    it('should delete providers', () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);

      expect(parentInjector.delete('testRegistry')).toBe(true);
      expect(parentInjector.get('testRegistry')).toBeUndefined();
    });

    it('should iterate provider entries', () => {
      const registry1 = new TestRegistry();
      const registry2 = new TestRegistry();
      registry2.localName = 'testRegistry2';

      parentInjector.set('testRegistry', registry1);
      parentInjector.set('testRegistry2', registry2);

      const entries = Array.from(parentInjector.entries());
      expect(entries).toHaveLength(2);
    });

    it('should iterate provider values', () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);

      const values = Array.from(parentInjector.values());
      expect(values).toContain(registry);
    });
  });

  describe('hierarchy', () => {
    it('should maintain child injectors', () => {
      const child1 = new TestInjector(childElement, parentInjector);
      const child2Element = document.createElement('span');
      parentElement.appendChild(child2Element);
      const child2 = new TestInjector(child2Element, parentInjector);

      expect(parentInjector.childInjectors.size).toBe(2);
      expect(parentInjector.childInjectors.has(child1)).toBe(true);
      expect(parentInjector.childInjectors.has(child2)).toBe(true);
    });

    it('should update parent injector', () => {
      const childInjector = new TestInjector(childElement, parentInjector);
      const newParentElement = document.createElement('div');
      const newParentInjector = new TestInjector(newParentElement);

      childInjector.parentInjector = newParentInjector;

      expect(childInjector.parentInjector).toBe(newParentInjector);
    });
  });

  describe('consume', () => {
    it('should return loaded provider immediately', async () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);

      const result = await parentInjector.consume('testRegistry', childElement);
      expect(result).toBe(registry);
    });

    it('should find provider in parent injector', async () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);

      const childInjector = new TestInjector(childElement, parentInjector);
      const result = await childInjector.consume('testRegistry', childElement);
      expect(result).toBe(registry);
    });

    it('should throw for unknown provider', async () => {
      await expect(
        parentInjector.consume('nonexistent', childElement),
      ).rejects.toThrow('Unknown provider: nonexistent');
    });

    it('should throw for unknown provider even with parent', async () => {
      const childInjector = new TestInjector(childElement, parentInjector);

      await expect(
        childInjector.consume('nonexistent', childElement),
      ).rejects.toThrow('Unknown provider: nonexistent');
    });
  });

  describe('register + lazy loading', () => {
    it('should lazy-load a registered provider on first consume', async () => {
      const registry = new TestRegistry();
      parentInjector.register('testRegistry', async () => registry);

      const result = await parentInjector.consume('testRegistry', childElement);
      expect(result).toBe(registry);
    });

    it('should cache loaded provider for subsequent get() calls', async () => {
      const registry = new TestRegistry();
      parentInjector.register('testRegistry', async () => registry);

      await parentInjector.consume('testRegistry', childElement);
      expect(parentInjector.get('testRegistry')).toBe(registry);
    });

    it('should dedup concurrent loads for the same key', async () => {
      let loadCount = 0;
      const registry = new TestRegistry();
      parentInjector.register('testRegistry', async () => {
        loadCount++;
        return registry;
      });

      const [r1, r2] = await Promise.all([
        parentInjector.consume('testRegistry', childElement),
        parentInjector.consume('testRegistry', childElement),
      ]);

      expect(r1).toBe(registry);
      expect(r2).toBe(registry);
      expect(loadCount).toBe(1);
    });

    it('should resolve registered provider from parent chain', async () => {
      const registry = new TestRegistry();
      parentInjector.register('testRegistry', async () => registry);

      const childInjector = new TestInjector(childElement, parentInjector);
      const result = await childInjector.consume('testRegistry', childElement);
      expect(result).toBe(registry);
    });

    it('should prefer loaded provider over registered loader', async () => {
      const eager = new TestRegistry();
      eager.localName = 'eager';
      const lazy = new TestRegistry();
      lazy.localName = 'lazy';

      parentInjector.register('testRegistry', async () => lazy);
      parentInjector.set('testRegistry', eager);

      const result = await parentInjector.consume('testRegistry', childElement);
      expect(result).toBe(eager);
    });

    it('should support deep dependency resolution', async () => {
      const depB = { name: 'depB' };
      const depA = { name: 'depA', dep: null as any };

      parentInjector.register('customContexts:b' as any, async () => depB);
      parentInjector.register('customContexts:a' as any, async () => {
        // Loading A requires B
        depA.dep = await parentInjector.consume('customContexts:b' as any, childElement);
        return depA;
      });

      const result = await parentInjector.consume('customContexts:a' as any, childElement);
      expect(result).toBe(depA);
      expect(result.dep).toBe(depB);
    });
  });

  describe('set clears registration', () => {
    it('should clear lazy registration when set is called', async () => {
      let loaded = false;
      parentInjector.register('testRegistry', async () => {
        loaded = true;
        return new TestRegistry();
      });

      const eager = new TestRegistry();
      parentInjector.set('testRegistry', eager);

      const result = await parentInjector.consume('testRegistry', childElement);
      expect(result).toBe(eager);
      expect(loaded).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should clear all state', () => {
      parentInjector.set('testRegistry', new TestRegistry());
      parentInjector.register('customContexts:lazy' as any, async () => ({}));

      parentInjector.dispose();

      expect(parentInjector.get('testRegistry')).toBeUndefined();
    });

    it('should disconnect from parent', () => {
      const childInjector = new TestInjector(childElement, parentInjector);
      expect(parentInjector.childInjectors.has(childInjector)).toBe(true);

      childInjector.dispose();
      expect(parentInjector.childInjectors.has(childInjector)).toBe(false);
    });

    it('should throw on consume after dispose', async () => {
      parentInjector.set('testRegistry', new TestRegistry());
      parentInjector.dispose();

      await expect(
        parentInjector.consume('testRegistry', childElement),
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('isQuerierValid', () => {
    it('should validate queriers based on containment', () => {
      expect(parentInjector.isQuerierValid(childElement)).toBe(true);

      const outsideElement = document.createElement('div');
      expect(parentInjector.isQuerierValid(outsideElement)).toBe(false);
    });
  });
});
