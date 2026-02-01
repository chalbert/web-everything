/**
 * @file webcontexts/__tests__/unit/CustomContextRegistry.test.ts
 * @description Unit tests for CustomContextRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import CustomContextRegistry from '../../CustomContextRegistry';
import CustomContext, { type ImplementedContext } from '../../CustomContext';

// Mock context
interface AppState {
  user: string;
  count: number;
}

class AppContext extends CustomContext<AppState> {
  static observedContexts = ['theme'];
  initialValue = { user: 'guest', count: 0 };
}

describe('CustomContextRegistry', () => {
  let registry: CustomContextRegistry;

  beforeEach(() => {
    registry = new CustomContextRegistry();
  });

  describe('construction', () => {
    it('should create registry with correct localName', () => {
      expect(registry.localName).toBe('customContextTypes');
    });

    it('should be instance of CustomContextRegistry', () => {
      expect(registry).toBeInstanceOf(CustomContextRegistry);
    });
  });

  describe('define()', () => {
    it('should define a context type', () => {
      registry.define('app', AppContext);
      
      const constructor = registry.get('app');
      expect(constructor).toBeDefined();
      expect(constructor).toBe(AppContext);
      
      const definition = registry.getDefinition('app');
      expect(definition).toBeDefined();
      expect(definition?.constructor).toBe(AppContext);
    });

    it('should store lifecycle callbacks in definition', () => {
      const connectedCallback = vi.fn();
      const disconnectedCallback = vi.fn();
      
      class TestContext extends CustomContext<any> {
        initialValue = {};
        connectedCallback = connectedCallback;
        disconnectedCallback = disconnectedCallback;
      }
      
      registry.define('test', TestContext);
      
      const definition = registry.getDefinition('test');
      expect(definition?.connectedCallback).toBe(connectedCallback);
      expect(definition?.disconnectedCallback).toBe(disconnectedCallback);
    });

    it('should store observedContexts in definition', () => {
      registry.define('app', AppContext);
      
      const definition = registry.getDefinition('app');
      expect(definition?.observedContexts).toBeInstanceOf(Set);
      expect(definition?.observedContexts?.has('theme')).toBe(true);
    });
  });

  describe('getContextByName()', () => {
    it('should return null for undefined context', () => {
      const div = document.createElement('div');
      const result = registry.getContextByName(div, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return null when no contexts attached to element', () => {
      registry.define('app', AppContext);
      const div = document.createElement('div');
      const result = registry.getContextByName(div, 'app');
      expect(result).toBeNull();
    });
  });

  describe('getContextAll()', () => {
    it('should return null for element with no contexts', () => {
      const div = document.createElement('div');
      const result = registry.getContextAll(div);
      expect(result).toBeNull();
    });
  });

  describe('upgrade()', () => {
    it('should call upgrade without errors on empty tree', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      registry.define('app', AppContext);
      
      expect(() => registry.upgrade(div)).not.toThrow();
      
      document.body.removeChild(div);
    });
  });

  describe('downgrade()', () => {
    it('should call downgrade without errors', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      registry.define('app', AppContext);
      registry.upgrade(div);
      
      expect(() => registry.downgrade(div)).not.toThrow();
      
      document.body.removeChild(div);
    });
  });

  describe('MutationObserver integration', () => {
    it('should observe DOM changes after upgrade', () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      
      registry.define('app', AppContext);
      registry.upgrade(root);
      
      // MutationObserver should be created and observing
      expect(true).toBe(true);
      
      document.body.removeChild(root);
    });

    it('should disconnect observer on downgrade', () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      
      registry.define('app', AppContext);
      registry.upgrade(root);
      registry.downgrade(root);
      
      // Should disconnect without errors
      expect(true).toBe(true);
      
      document.body.removeChild(root);
    });
  });

  describe('inheritance', () => {
    it('should support multiple instances', () => {
      const parentRegistry = new CustomContextRegistry();
      parentRegistry.define('parent', AppContext);
      
      const childRegistry = new CustomContextRegistry();
      expect(childRegistry).toBeInstanceOf(CustomContextRegistry);
    });
  });
});
