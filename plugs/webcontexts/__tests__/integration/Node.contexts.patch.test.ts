/**
 * @file Node.contexts.patch.test.ts
 * @description Integration tests for Node.contexts patch
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyNodeContextsPatch, removeNodeContextsPatch, isContextsPatchApplied } from '../../Node.contexts.patch';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches } from '../../../webinjectors/Node.injectors.patch';
import InjectorRoot from '../../../webinjectors/InjectorRoot';
import CustomContext from '../../CustomContext';
import CustomContextRegistry from '../../CustomContextRegistry';
import CustomElementRegistry from '../../../webregistries/CustomElementRegistry';

describe('Node.contexts.patch integration', () => {
  let injectorRoot: InjectorRoot;
  let contextRegistry: CustomContextRegistry;
  let elementRegistry: CustomElementRegistry;

  beforeEach(() => {
    // Apply patches
    applyNodeInjectorsPatches();
    applyNodeContextsPatch();

    // Setup registries
    injectorRoot = new InjectorRoot();
    contextRegistry = new CustomContextRegistry();
    elementRegistry = new CustomElementRegistry();
    
    injectorRoot.attach(document);
    (window as any).customProviders = injectorRoot;
  });

  afterEach(() => {
    // Cleanup
    injectorRoot.detach(document);
    removeNodeContextsPatch();
    removeNodeInjectorsPatches();
    delete (window as any).customProviders;
  });

  describe('patch application', () => {
    it('should apply patch successfully', () => {
      expect(isContextsPatchApplied()).toBe(true);
    });

    it('should warn when applying patch twice', () => {
      const consoleWarn = console.warn;
      let warned = false;
      console.warn = (msg: string) => {
        if (msg.includes('already applied')) warned = true;
      };

      applyNodeContextsPatch();
      expect(warned).toBe(true);

      console.warn = consoleWarn;
    });

    it('should remove patch cleanly', () => {
      removeNodeContextsPatch();
      expect(isContextsPatchApplied()).toBe(false);

      // Re-apply for cleanup
      applyNodeContextsPatch();
    });
  });

  describe('createElement method', () => {
    it('should create standard elements normally', () => {
      const div = document.createElement('div');
      const element = (div as any).createElement('span');
      
      expect(element).toBeInstanceOf(HTMLSpanElement);
      expect(element.tagName).toBe('SPAN');
    });

    it('should create custom elements from injector registry', () => {
      class TestElement extends HTMLElement {
        testProperty = 'test-value';
      }

      elementRegistry.define('test-element', TestElement);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customElements', elementRegistry);

      const element = (container as any).createElement('test-element');
      
      expect(element).toBeInstanceOf(TestElement);
      expect(element.testProperty).toBe('test-value');

      document.body.removeChild(container);
    });

    it('should fall back to document.createElement for undefined custom elements', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customElements', elementRegistry);

      const element = (container as any).createElement('undefined-element');
      
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.tagName).toBe('UNDEFINED-ELEMENT');

      document.body.removeChild(container);
    });

    it('should handle options.is parameter', () => {
      class ExtendedButton extends HTMLButtonElement {
        customProp = 'custom';
      }

      elementRegistry.define('extended-button', ExtendedButton);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customElements', elementRegistry);

      const element = (container as any).createElement('button', { is: 'extended-button' });
      
      expect(element).toBeInstanceOf(ExtendedButton);

      document.body.removeChild(container);
    });
  });

  describe('createContext method', () => {
    it('should create context from registry', () => {
      class AppContext extends CustomContext<{ count: number }> {
        increment() {
          this.value = { count: this.value.count + 1 };
        }
      }

      contextRegistry.define('app', AppContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = (container as any).createContext('app');
      
      expect(context).toBeInstanceOf(AppContext);
      expect(context).toBeInstanceOf(CustomContext);

      document.body.removeChild(container);
    });

    it('should return undefined for unregistered context types', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = (container as any).createContext('nonexistent');
      
      expect(context).toBeUndefined();

      document.body.removeChild(container);
    });

    it('should traverse injector hierarchy to find context type', () => {
      class ThemeContext extends CustomContext<{ theme: string }> {}

      contextRegistry.define('theme', ThemeContext);

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);
      
      // Register at root level
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      rootInjector.set('customContextTypes', contextRegistry);

      // Create from child (should find in parent)
      const context = (child as any).createContext('theme');
      
      expect(context).toBeInstanceOf(ThemeContext);

      document.body.removeChild(root);
    });
  });

  describe('getContext method', () => {
    it('should retrieve existing context from injector', () => {
      class UserContext extends CustomContext<{ name: string }> {}

      contextRegistry.define('user', UserContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      // Create and store a context instance
      const createdContext = new UserContext();
      injector.set('customContexts:user', createdContext);

      // Retrieve it
      const retrievedContext = (container as any).getContext('user');
      
      expect(retrievedContext).toBe(createdContext);
      expect(retrievedContext).toBeInstanceOf(UserContext);

      document.body.removeChild(container);
    });

    it('should return undefined for non-existent contexts', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = (container as any).getContext('nonexistent');
      
      expect(context).toBeUndefined();

      document.body.removeChild(container);
    });

    it('should traverse injector hierarchy to find context', () => {
      class ConfigContext extends CustomContext<{ apiKey: string }> {}

      contextRegistry.define('config', ConfigContext);

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);
      
      // Store context at root
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      rootInjector.set('customContextTypes', contextRegistry);
      
      const configContext = new ConfigContext();
      rootInjector.set('customContexts:config', configContext);

      // Retrieve from child
      const retrieved = (child as any).getContext('config');
      
      expect(retrieved).toBe(configContext);

      document.body.removeChild(root);
    });
  });

  describe('ensureContext method', () => {
    it('should return existing context if present', () => {
      class StateContext extends CustomContext<{ state: string }> {}

      contextRegistry.define('state', StateContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      // Create first context
      const firstContext = new StateContext();
      injector.set('customContexts:state', firstContext);

      // ensureContext should return existing
      const ensured = (container as any).ensureContext('state');
      
      expect(ensured).toBe(firstContext);

      document.body.removeChild(container);
    });
  });


  describe('getOwnContext method', () => {
    it('should return context attached to same node', () => {
      class DirectContext extends CustomContext<{ direct: true }> {}

      contextRegistry.define('direct', DirectContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const directContext = new DirectContext();
      injector.set('customContexts:direct', directContext);

      const own = (container as any).getOwnContext('direct');
      
      expect(own).toBe(directContext);

      document.body.removeChild(container);
    });

    it('should not return context from parent', () => {
      class ParentContext extends CustomContext<{ parent: true }> {}

      contextRegistry.define('parent', ParentContext);

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);
      
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      rootInjector.set('customContextTypes', contextRegistry);

      const parentContext = new ParentContext();
      rootInjector.set('customContexts:parent', parentContext);

      // Child should not see parent's context with getOwnContext
      const own = (child as any).getOwnContext('parent');
      
      expect(own).toBeNull();

      document.body.removeChild(root);
    });
  });

  describe('hasContext method', () => {
    it('should return true if context exists in hierarchy', () => {
      class ExistingContext extends CustomContext<{ exists: true }> {}

      contextRegistry.define('existing', ExistingContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = new ExistingContext();
      injector.set('customContexts:existing', context);

      const has = (container as any).hasContext('existing');
      
      expect(has).toBe(true);

      document.body.removeChild(container);
    });

    it('should return false if context does not exist', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);

      const has = (container as any).hasContext('nonexistent');
      
      expect(has).toBe(false);

      document.body.removeChild(container);
    });
  });

  describe('hasOwnContext method', () => {
    it('should return true for directly attached context', () => {
      class OwnedContext extends CustomContext<{ owned: true }> {}

      contextRegistry.define('owned', OwnedContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = new OwnedContext();
      injector.set('customContexts:owned', context);

      const hasOwn = (container as any).hasOwnContext('owned');
      
      expect(hasOwn).toBe(true);

      document.body.removeChild(container);
    });

    it('should return false for parent context', () => {
      class ParentContext extends CustomContext<{ parent: true }> {}

      contextRegistry.define('parent', ParentContext);

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);
      
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      rootInjector.set('customContextTypes', contextRegistry);

      const parentContext = new ParentContext();
      rootInjector.set('customContexts:parent', parentContext);

      const hasOwn = (child as any).hasOwnContext('parent');
      
      expect(hasOwn).toBe(false);

      document.body.removeChild(root);
    });
  });

  describe('queryContext method', () => {
    it('should query context with path expression', () => {
      class QueryableContext extends CustomContext<{ data: { value: number } }> {}

      contextRegistry.define('queryable', QueryableContext);

      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      injector.set('customContextTypes', contextRegistry);

      const context = new QueryableContext();
      injector.set('customContexts:queryable', context);

      // queryContext should use consume API
      const result = (container as any).queryContext('queryable', 'data/value');
      
      // Result depends on consume implementation
      expect(result).toBeDefined();

      document.body.removeChild(container);
    });
  });


  describe('edge cases', () => {
    it('should handle nodes without injectors gracefully', () => {
      const detached = document.createElement('div');

      // Should not throw
      expect(() => {
        (detached as any).createElement('span');
        (detached as any).createContext('test');
        (detached as any).getContext('test');
      }).not.toThrow();
    });

    it('should handle empty injector hierarchy', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      injectorRoot.ensureInjector(container);

      const element = (container as any).createElement('div');
      expect(element).toBeInstanceOf(HTMLDivElement);

      const context = (container as any).createContext('test');
      expect(context).toBeUndefined();

      document.body.removeChild(container);
    });
  });
});
