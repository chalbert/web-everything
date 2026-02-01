import { describe, it, expect, beforeEach, vi } from 'vitest';
import HTMLRegistry, { ConstructorDefinition } from '../HTMLRegistry';

// Mock constructor for testing
class MockElement {}

interface MockDefinition extends ConstructorDefinition<typeof MockElement> {
  constructor: typeof MockElement;
}

// Concrete implementation for testing
class TestHTMLRegistry extends HTMLRegistry<MockDefinition, typeof MockElement> {
  localName = 'testHTMLRegistry';
  
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

  describe('constructor-to-name bidirectional mapping', () => {
    it('should store constructor when setting definition', () => {
      const definition: MockDefinition = {
        constructor: MockElement,
      };
      
      registry.set('mock-element', definition);
      
      expect(registry.getLocalNameOf(MockElement)).toBe('mock-element');
    });

    it('should return constructor when getting by name', () => {
      const definition: MockDefinition = {
        constructor: MockElement,
      };
      
      registry.set('mock-element', definition);
      
      expect(registry.get('mock-element')).toBe(MockElement);
    });
  });

  describe('getDefinition()', () => {
    it('should return full definition object', () => {
      const definition: MockDefinition = {
        constructor: MockElement,
        connectedCallback: vi.fn(),
        disconnectedCallback: vi.fn(),
      };
      
      registry.set('mock-element', definition);
      
      const retrieved = registry.getDefinition('mock-element');
      expect(retrieved).toBe(definition);
      expect(retrieved?.connectedCallback).toBeDefined();
      expect(retrieved?.disconnectedCallback).toBeDefined();
    });

    it('should return undefined for non-existent definitions', () => {
      expect(registry.getDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('lifecycle callbacks', () => {
    it('should preserve connectedCallback in definition', () => {
      const connectedCallback = vi.fn();
      const definition: MockDefinition = {
        constructor: MockElement,
        connectedCallback,
      };
      
      registry.set('mock-element', definition);
      
      const retrieved = registry.getDefinition('mock-element');
      expect(retrieved?.connectedCallback).toBe(connectedCallback);
    });

    it('should preserve disconnectedCallback in definition', () => {
      const disconnectedCallback = vi.fn();
      const definition: MockDefinition = {
        constructor: MockElement,
        disconnectedCallback,
      };
      
      registry.set('mock-element', definition);
      
      const retrieved = registry.getDefinition('mock-element');
      expect(retrieved?.disconnectedCallback).toBe(disconnectedCallback);
    });

    it('should preserve adoptedCallback in definition', () => {
      const adoptedCallback = vi.fn();
      const definition: MockDefinition = {
        constructor: MockElement,
        adoptedCallback,
      };
      
      registry.set('mock-element', definition);
      
      const retrieved = registry.getDefinition('mock-element');
      expect(retrieved?.adoptedCallback).toBe(adoptedCallback);
    });
  });

  describe('abstract methods', () => {
    it('should have upgrade method', () => {
      expect(typeof registry.upgrade).toBe('function');
    });

    it('should have downgrade method', () => {
      expect(typeof registry.downgrade).toBe('function');
    });
  });

  describe('inheritance from CustomRegistry', () => {
    it('should inherit all CustomRegistry methods', () => {
      expect(typeof registry.set).toBe('function');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.has).toBe('function');
      expect(typeof registry.delete).toBe('function');
      expect(typeof registry.clear).toBe('function');
    });

    it('should work with parent registry', () => {
      const parentRegistry = new TestHTMLRegistry();
      const ParentElement = class {};
      
      parentRegistry.set('parent-element', {
        constructor: ParentElement as any,
      });
      
      const childRegistry = new TestHTMLRegistry({ extends: [parentRegistry as any] });
      
      expect(childRegistry.get('parent-element')).toBe(ParentElement);
    });
  });
});
