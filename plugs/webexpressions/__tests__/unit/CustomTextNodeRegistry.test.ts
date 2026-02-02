/**
 * @file CustomTextNodeRegistry.test.ts
 * @description Unit tests for CustomTextNodeRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';
import CustomTextNode from '../../CustomTextNode';

describe('CustomTextNodeRegistry', () => {
  class ExpressionTextNode extends CustomTextNode {
    callbackLog: string[] = [];

    connectedCallback() {
      this.callbackLog.push('connected');
    }

    disconnectedCallback() {
      this.callbackLog.push('disconnected');
    }

    textChangedCallback(oldValue: string | null, newValue: string | null) {
      this.callbackLog.push(`${oldValue}->${newValue}`);
    }
  }

  class InterpolationTextNode extends CustomTextNode {
    connectedCallback() {
      this.textContent = `[${this.textContent}]`;
    }
  }

  let registry: CustomTextNodeRegistry;
  let container: HTMLDivElement;

  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    registry.downgrade(container);
    container.remove();
  });

  describe('Construction', () => {
    it('should create registry instance', () => {
      expect(registry).toBeInstanceOf(CustomTextNodeRegistry);
    });

    it('should have localName set to customTextNodes', () => {
      expect(registry.localName).toBe('customTextNodes');
    });
  });

  describe('define()', () => {
    it('should register custom text node', () => {
      registry.define('expression', ExpressionTextNode);
      
      const definition = registry.getDefinition('expression');
      expect(definition).toBeDefined();
      expect(definition?.constructor).toBe(ExpressionTextNode);
    });

    it('should store lifecycle callbacks', () => {
      registry.define('expression', ExpressionTextNode);
      
      const definition = registry.getDefinition('expression');
      expect(definition?.connectedCallback).toBeDefined();
      expect(definition?.disconnectedCallback).toBeDefined();
      expect(definition?.textChangedCallback).toBeDefined();
    });

    it('should allow multiple text node types', () => {
      registry.define('expression', ExpressionTextNode);
      registry.define('interpolation', InterpolationTextNode);
      
      expect(registry.getDefinition('expression')).toBeDefined();
      expect(registry.getDefinition('interpolation')).toBeDefined();
    });
  });

  describe('get()', () => {
    it('should retrieve text node constructor', () => {
      registry.define('expression', ExpressionTextNode);
      
      const TextNode = registry.get('expression');
      
      expect(TextNode).toBe(ExpressionTextNode);
    });

    it('should return undefined for unregistered name', () => {
      const TextNode = registry.get('unknown');
      
      expect(TextNode).toBeUndefined();
    });
  });

  describe('upgrade()', () => {
    it('should activate on empty container', () => {
      registry.define('expression', ExpressionTextNode);
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should process existing text nodes', () => {
      registry.define('expression', ExpressionTextNode);
      
      container.textContent = 'Hello World';
      
      // Without parsers, text nodes stay as regular text
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should call connectedCallback on custom text nodes', () => {
      const node = new ExpressionTextNode({ children: 'test' });
      container.appendChild(node);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      expect(node.callbackLog).toContain('connected');
    });

    it('should handle nested elements', () => {
      registry.define('expression', ExpressionTextNode);
      
      container.innerHTML = '<div><span>Text</span></div>';
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });
  });

  describe('downgrade()', () => {
    it('should deactivate text nodes', () => {
      const node = new ExpressionTextNode({ children: 'test' });
      container.appendChild(node);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      registry.downgrade(container);
      
      expect(node.callbackLog).toContain('disconnected');
    });

    it('should stop observing', () => {
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      expect(() => registry.downgrade(container)).not.toThrow();
    });
  });

  describe('MutationObserver behavior', () => {
    it('should observe text content changes', async () => {
      const node = new ExpressionTextNode({ children: 'initial' });
      container.appendChild(node);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      node.callbackLog = []; // Clear initial callbacks
      node.textContent = 'changed';
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(node.callbackLog).toContain('initial->changed');
    });

    it('should observe node removals', async () => {
      const node = new ExpressionTextNode({ children: 'test' });
      container.appendChild(node);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      node.remove();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(node.callbackLog).toContain('disconnected');
    });

    it('should handle multiple text content changes', async () => {
      const node = new ExpressionTextNode({ children: 'first' });
      container.appendChild(node);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      node.callbackLog = [];
      node.textContent = 'second';
      await new Promise(resolve => setTimeout(resolve, 10));
      
      node.textContent = 'third';
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(node.callbackLog).toContain('first->second');
      expect(node.callbackLog).toContain('second->third');
    });

    it('should not observe regular text nodes', async () => {
      const regularNode = document.createTextNode('regular');
      container.appendChild(regularNode);
      
      registry.define('expression', ExpressionTextNode);
      registry.upgrade(container);
      
      regularNode.textContent = 'changed';
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should not throw, just no callback
      expect(regularNode.textContent).toBe('changed');
    });
  });

  describe('Text node creation', () => {
    it('should create text node programmatically', () => {
      const node = new ExpressionTextNode({ children: 'test' });
      
      expect(node).toBeInstanceOf(ExpressionTextNode);
      expect(node.textContent).toBe('test');
    });

    it('should create text node with empty content', () => {
      const node = new ExpressionTextNode({ children: '' });
      
      expect(node.textContent).toBe('');
    });

    it('should create multiple text nodes', () => {
      const node1 = new ExpressionTextNode({ children: 'first' });
      const node2 = new ExpressionTextNode({ children: 'second' });
      
      container.appendChild(node1);
      container.appendChild(node2);
      
      expect(container.textContent).toBe('firstsecond');
    });
  });

  describe('Edge cases', () => {
    it('should handle elements without text nodes', () => {
      registry.define('expression', ExpressionTextNode);
      
      container.innerHTML = '<div></div><span></span>';
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should handle empty container', () => {
      registry.define('expression', ExpressionTextNode);
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should handle multiple upgrades', () => {
      registry.define('expression', ExpressionTextNode);
      
      registry.upgrade(container);
      registry.upgrade(container);
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should handle downgrade without upgrade', () => {
      registry.define('expression', ExpressionTextNode);
      
      expect(() => registry.downgrade(container)).not.toThrow();
    });

    it('should handle text nodes with null content', () => {
      const node = new ExpressionTextNode({ children: 'test' });
      container.appendChild(node);
      
      node.textContent = null;
      
      expect(node.textContent).toBe('null'); // Text nodes stringify null
    });
  });

  describe('Integration with DOM', () => {
    it('should work with appendChild', () => {
      const node = new ExpressionTextNode({ children: 'appended' });
      
      container.appendChild(node);
      
      expect(container.textContent).toBe('appended');
    });

    it('should work with replaceWith', () => {
      const node1 = new ExpressionTextNode({ children: 'first' });
      const node2 = new ExpressionTextNode({ children: 'second' });
      
      container.appendChild(node1);
      node1.replaceWith(node2);
      
      expect(container.textContent).toBe('second');
    });

    it('should work with remove', () => {
      const node = new ExpressionTextNode({ children: 'remove me' });
      
      container.appendChild(node);
      node.remove();
      
      expect(container.textContent).toBe('');
    });

    it('should work with mixed content', () => {
      const element = document.createElement('span');
      element.textContent = 'Element';
      const node = new ExpressionTextNode({ children: ' Text' });
      
      container.appendChild(element);
      container.appendChild(node);
      
      expect(container.textContent).toBe('Element Text');
    });
  });
});
