/**
 * Unit tests for HTMLRegistry
 * 
 * @module webinjectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import HTMLRegistry, { type ConstructorDefinition } from '../../HTMLRegistry';

// Mock implementation for testing
class TestElement {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class AnotherElement {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
}

interface TestDefinition extends ConstructorDefinition<typeof TestElement> {
  constructor: typeof TestElement;
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
}

class TestHTMLRegistry extends HTMLRegistry<TestDefinition, typeof TestElement> {
  localName = 'testRegistry';
  
  upgrade(node: Node): void {
    // Mock implementation
  }
  
  downgrade(node: Node): void {
    // Mock implementation
  }
}

describe('HTMLRegistry', () => {
  let registry: TestHTMLRegistry;

  beforeEach(() => {
    registry = new TestHTMLRegistry();
  });

  describe('set and get', () => {
    it('should set and get constructor by name', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
        connectedCallback: () => {},
      };
      
      registry.set('test-element', definition);
      
      expect(registry.get('test-element')).toBe(TestElement);
    });

    it('should return undefined for non-existent entries', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should maintain bidirectional mapping', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
      };
      
      registry.set('test-element', definition);
      
      expect(registry.getLocalNameOf(TestElement)).toBe('test-element');
    });
  });

  describe('getLocalNameOf', () => {
    it('should return local name for constructor', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
      };
      
      registry.set('test-element', definition);
      
      expect(registry.getLocalNameOf(TestElement)).toBe('test-element');
    });

    it('should return undefined for unregistered constructor', () => {
      expect(registry.getLocalNameOf(AnotherElement as any)).toBeUndefined();
    });

    it('should handle multiple constructors', () => {
      registry.set('test-element', { constructor: TestElement });
      registry.set('another-element', { constructor: AnotherElement as any });
      
      expect(registry.getLocalNameOf(TestElement)).toBe('test-element');
      expect(registry.getLocalNameOf(AnotherElement as any)).toBe('another-element');
    });
  });

  describe('getDefinition', () => {
    it('should return full definition object', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
        connectedCallback: () => {},
        disconnectedCallback: () => {},
      };
      
      registry.set('test-element', definition);
      
      const retrieved = registry.getDefinition('test-element');
      expect(retrieved).toBe(definition);
      expect(retrieved?.constructor).toBe(TestElement);
      expect(retrieved?.connectedCallback).toBeDefined();
    });

    it('should return undefined for non-existent definitions', () => {
      expect(registry.getDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('inheritance', () => {
    it('should inherit from CustomRegistry', () => {
      expect(registry.has).toBeDefined();
      expect(registry.keys).toBeDefined();
      expect(registry.values).toBeDefined();
      expect(registry.entries).toBeDefined();
      expect(registry.delete).toBeDefined();
      expect(registry.clear).toBeDefined();
    });

    it('should support CustomRegistry methods', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
      };
      
      registry.set('test-element', definition);
      
      expect(registry.has('test-element')).toBe(true);
      expect(Array.from(registry.keys())).toContain('test-element');
    });
  });

  describe('lifecycle callbacks', () => {
    it('should preserve lifecycle callbacks in definition', () => {
      let connected = false;
      let disconnected = false;
      
      const definition: TestDefinition = {
        constructor: TestElement,
        connectedCallback: () => { connected = true; },
        disconnectedCallback: () => { disconnected = true; },
      };
      
      registry.set('test-element', definition);
      
      const retrieved = registry.getDefinition('test-element');
      retrieved?.connectedCallback?.();
      retrieved?.disconnectedCallback?.();
      
      expect(connected).toBe(true);
      expect(disconnected).toBe(true);
    });

    it('should support optional lifecycle callbacks', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
        // No callbacks defined
      };
      
      registry.set('test-element', definition);
      
      const retrieved = registry.getDefinition('test-element');
      expect(retrieved?.connectedCallback).toBeUndefined();
      expect(retrieved?.disconnectedCallback).toBeUndefined();
    });
  });

  describe('abstract methods', () => {
    it('should require localName implementation', () => {
      expect(registry.localName).toBe('testRegistry');
    });

    it('should require upgrade implementation', () => {
      const node = document.createElement('div');
      expect(() => registry.upgrade(node)).not.toThrow();
    });

    it('should require downgrade implementation', () => {
      const node = document.createElement('div');
      expect(() => registry.downgrade(node)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle overwriting existing definitions', () => {
      const def1: TestDefinition = {
        constructor: TestElement,
      };
      const def2: TestDefinition = {
        constructor: AnotherElement as any,
      };
      
      registry.set('test-element', def1);
      registry.set('test-element', def2);
      
      expect(registry.get('test-element')).toBe(AnotherElement);
      expect(registry.getLocalNameOf(AnotherElement as any)).toBe('test-element');
    });

    it('should maintain consistency when deleting', () => {
      const definition: TestDefinition = {
        constructor: TestElement,
      };
      
      registry.set('test-element', definition);
      registry.delete('test-element');
      
      expect(registry.get('test-element')).toBeUndefined();
      // Note: Constructor mapping is not cleaned up on delete in current implementation
      // This matches Plateau behavior
    });
  });
});
