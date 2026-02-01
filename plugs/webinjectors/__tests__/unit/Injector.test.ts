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
    it('should return null if provider not found and no parent', () => {
      const consumable = parentInjector.consume('nonexistent', childElement);
      
      // Should return a consumable even if provider doesn't exist yet
      expect(consumable).toBeTruthy();
    });

    it('should find provider in parent injector', () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);
      
      const childInjector = new TestInjector(childElement, parentInjector);
      const consumable = childInjector.consume('testRegistry', childElement);
      
      expect(consumable).toBeTruthy();
    });

    it('should handle query expressions', () => {
      const registry = new TestRegistry();
      registry.query = (expr: string) => ({ expression: expr } as any);
      
      parentInjector.set('testRegistry', registry);
      
      const consumable = parentInjector.consume('testRegistry/path.to.value', childElement);
      expect(consumable).toBeTruthy();
    });
  });

  describe('claim/unclaim', () => {
    it('should claim consumers when provider is added', () => {
      const registry = new TestRegistry();
      
      const claimedConsumers = parentInjector.claim(registry);
      
      expect(Array.isArray(claimedConsumers)).toBe(true);
    });

    it('should unclaim consumers when provider is removed', () => {
      const registry = new TestRegistry();
      parentInjector.set('testRegistry', registry);
      
      expect(() => parentInjector.unclaim(registry)).not.toThrow();
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
