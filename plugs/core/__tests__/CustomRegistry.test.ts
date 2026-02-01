import { describe, it, expect, beforeEach } from 'vitest';
import CustomRegistry from '../CustomRegistry';

// Concrete implementation for testing
class TestRegistry extends CustomRegistry<string> {
  localName = 'testRegistry';
}

describe('CustomRegistry', () => {
  let registry: TestRegistry;

  beforeEach(() => {
    registry = new TestRegistry();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      registry.set('test', 'value');
      expect(registry.get('test')).toBe('value');
    });

    it('should return undefined for non-existent keys', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has and hasOwn', () => {
    it('should return true for existing keys', () => {
      registry.set('test', 'value');
      expect(registry.has('test')).toBe(true);
      expect(registry.hasOwn('test')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(registry.has('test')).toBe(false);
      expect(registry.hasOwn('test')).toBe(false);
    });
  });

  describe('size and ownSize', () => {
    it('should track number of entries', () => {
      expect(registry.size).toBe(0);
      expect(registry.ownSize).toBe(0);
      
      registry.set('a', 'value1');
      registry.set('b', 'value2');
      
      expect(registry.size).toBe(2);
      expect(registry.ownSize).toBe(2);
    });
  });

  describe('keys, values, and entries', () => {
    beforeEach(() => {
      registry.set('a', 'value1');
      registry.set('b', 'value2');
    });

    it('should return all keys', () => {
      const keys = Array.from(registry.keys());
      expect(keys).toEqual(['a', 'b']);
    });

    it('should return all values', () => {
      const values = registry.values();
      expect(values).toEqual(['value1', 'value2']);
    });

    it('should return all entries', () => {
      const entries = registry.entries();
      expect(entries).toEqual([['a', 'value1'], ['b', 'value2']]);
    });
  });

  describe('inheritance (extends)', () => {
    let parentRegistry: TestRegistry;
    let childRegistry: TestRegistry;

    beforeEach(() => {
      parentRegistry = new TestRegistry();
      parentRegistry.set('parent', 'parentValue');
      
      childRegistry = new TestRegistry({ extends: [parentRegistry] });
      childRegistry.set('child', 'childValue');
    });

    it('should inherit values from parent registry', () => {
      expect(childRegistry.get('parent')).toBe('parentValue');
      expect(childRegistry.get('child')).toBe('childValue');
    });

    it('should report has() for inherited keys', () => {
      expect(childRegistry.has('parent')).toBe(true);
      expect(childRegistry.has('child')).toBe(true);
    });

    it('should distinguish own vs inherited with hasOwn()', () => {
      expect(childRegistry.hasOwn('parent')).toBe(false);
      expect(childRegistry.hasOwn('child')).toBe(true);
    });

    it('should shadow parent values', () => {
      childRegistry.set('parent', 'overridden');
      expect(childRegistry.get('parent')).toBe('overridden');
      expect(parentRegistry.get('parent')).toBe('parentValue');
    });

    it('should include parent keys in keys()', () => {
      const keys = Array.from(childRegistry.keys());
      expect(keys).toContain('parent');
      expect(keys).toContain('child');
    });

    it('should include parent values in values()', () => {
      const values = childRegistry.values();
      expect(values).toContain('parentValue');
      expect(values).toContain('childValue');
    });
  });

  describe('clear and delete', () => {
    beforeEach(() => {
      registry.set('a', 'value1');
      registry.set('b', 'value2');
    });

    it('should delete individual entries', () => {
      const result = registry.delete('a');
      expect(result).toBe(true);
      expect(registry.has('a')).toBe(false);
      expect(registry.has('b')).toBe(true);
    });

    it('should return false when deleting non-existent key', () => {
      const result = registry.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('should clear all entries', () => {
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.has('a')).toBe(false);
      expect(registry.has('b')).toBe(false);
    });
  });

  describe('define()', () => {
    it('should be an alias for set()', () => {
      registry.define('test', 'value');
      expect(registry.get('test')).toBe('value');
    });
  });
});
