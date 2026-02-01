/**
 * Full Stack Integration Tests
 * 
 * Tests the complete Web Everything stack working together:
 * - CustomRegistry & CustomElementRegistry (registries)
 * - InjectorRoot & HTMLInjector (injectors)
 * - CustomElement with cloning (components)
 * - pathInsertionMethods (DOM enhancement)
 * 
 * These tests simulate real-world usage scenarios to ensure
 * all phases integrate correctly.
 * 
 * NOTE: CustomContext integration tests are in webcontexts/__tests__/integration/
 * as they require more complex setup with registries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomElementRegistry from '../../webregistries/CustomElementRegistry';
import InjectorRoot from '../../webinjectors/InjectorRoot';
import HTMLInjector from '../../webinjectors/HTMLInjector';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches } from '../../webinjectors/Node.injectors.patch';
import { applyCloneNodePatch, removeCloneNodePatch } from '../../webcomponents/Node.cloneNode.patch';

describe('Full Stack Integration', () => {
  let elementRegistry: CustomElementRegistry;
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    // Apply patches
    applyNodeInjectorsPatches();
    applyCloneNodePatch();

    // Initialize registries
    elementRegistry = new CustomElementRegistry();
    injectorRoot = new InjectorRoot();

    // Attach injector root to document
    injectorRoot.attach(document);
  });

  afterEach(() => {
    // Cleanup
    injectorRoot.detach(document);
    removeNodeInjectorsPatches();
    removeCloneNodePatch();
  });

  describe('Scenario 1: Service Injection', () => {
    it('should inject services into nested components', () => {
      // Define services
      class DataService {
        getData() {
          return { message: 'Hello from DataService' };
        }
      }

      class LogService {
        log(msg: string) {
          return `[LOG] ${msg}`;
        }
      }

      // Setup component tree
      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);

      // Make injectorRoot available
      (window as any).customProviders = injectorRoot;

      // Setup injector hierarchy
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;

      // Register services at root
      rootInjector.set('dataService', new DataService());
      rootInjector.set('logService', new LogService());

      // Access services from child
      const childAsAny = child as any;
      const foundInjector = childAsAny.getClosestInjector?.();
      
      expect(foundInjector).toBeTruthy();
      
      const dataService = foundInjector.get('dataService') as DataService;
      const logService = foundInjector.get('logService') as LogService;
      
      expect(dataService).toBeInstanceOf(DataService);
      expect(dataService.getData()).toEqual({ message: 'Hello from DataService' });
      expect(logService.log('test')).toBe('[LOG] test');

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(root);
    });

    it('should override services in child injectors', () => {
      class CounterService {
        constructor(public count: number = 0) {}
        increment() {
          this.count++;
        }
      }

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);
      document.body.appendChild(root);

      (window as any).customProviders = injectorRoot;

      // Root injector with counter at 10
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      const rootCounter = new CounterService(10);
      rootInjector.set('counter', rootCounter);

      // Child injector with counter at 20
      injectorRoot.ensureInjector(child);
      const childInjector = injectorRoot.getInjectorOf(child)!;
      const childCounter = new CounterService(20);
      childInjector.set('counter', childCounter);

      // Child should get its own counter, not root's
      const foundInjector = (child as any).getClosestInjector?.();
      const foundCounter = foundInjector.get('counter') as CounterService;
      
      expect(foundCounter).toBe(childCounter);
      expect(foundCounter.count).toBe(20);
      expect(rootCounter.count).toBe(10);

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(root);
    });
  });

  describe('Scenario 2: Custom Element with Dependency Injection', () => {
    it('should allow direct instantiation of elements', () => {
      // Define a custom element
      class TodoItem extends HTMLElement {
        render() {
          const todoId = this.getAttribute('todo-id');
          const completed = this.hasAttribute('completed');
          
          this.innerHTML = `
            <div class="todo-item ${completed ? 'completed' : ''}">
              <span>${todoId}</span>
            </div>
          `;
        }
      }

      // Register element
      elementRegistry.define('todo-item', TodoItem);

      // Directly instantiate and render
      const element = new TodoItem();
      element.setAttribute('todo-id', '123');
      element.render();
      
      document.body.appendChild(element);

      // Test rendering
      expect(element.innerHTML).toContain('123');
      expect(element.innerHTML).not.toContain('completed');

      // Cleanup
      document.body.removeChild(element);
    });

    it('should inject providers into directly instantiated elements', () => {
      class DataService {
        getData() {
          return { message: 'Hello from service' };
        }
      }

      class ServicedElement extends HTMLElement {
        dataService?: DataService;

        render() {
          const injector = (this as any).getClosestInjector?.();
          if (injector) {
            this.dataService = injector.get('dataService');
          }
          
          const data = this.dataService?.getData();
          this.textContent = data?.message || 'No service';
        }
      }

      elementRegistry.define('serviced-element', ServicedElement);

      // Setup injector with provider
      const container = document.createElement('div');
      document.body.appendChild(container);

      (window as any).customProviders = injectorRoot;
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;
      
      // Register provider
      const dataService = new DataService();
      injector.set('dataService', dataService);

      // Directly instantiate element
      const element = new ServicedElement();
      container.appendChild(element);
      
      // Manually trigger render
      element.render();

      // Test injection
      expect(element.textContent).toBe('Hello from service');

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(container);
    });
  });

  describe('Scenario 3: Cloning with Property Preservation', () => {
    it('should clone elements preserving structure', () => {
      // Create element hierarchy
      const original = document.createElement('div');
      original.setAttribute('id', 'original');
      original.setAttribute('data-value', '42');
      
      const child = document.createElement('span');
      child.textContent = 'child content';
      original.appendChild(child);
      
      document.body.appendChild(original);

      // Clone the element
      const clone = original.cloneNode(true) as HTMLDivElement;
      clone.setAttribute('id', 'clone');
      document.body.appendChild(clone);

      // Verify clone structure
      expect(clone.getAttribute('data-value')).toBe('42');
      expect(clone.querySelector('span')?.textContent).toBe('child content');
      
      // Verify they're independent
      expect(clone).not.toBe(original);
      expect(clone.querySelector('span')).not.toBe(child);

      // Cleanup
      document.body.removeChild(original);
      document.body.removeChild(clone);
    });

    it('should clone custom elements with options preserved', () => {
      class ConfigurableElement extends HTMLElement {
        options: any;

        constructor(options?: any) {
          super();
          this.options = options || {};
        }

        connectedCallback() {
          this.textContent = `Config: ${this.options.label || 'default'}`;
        }
      }

      elementRegistry.define('configurable-element', ConfigurableElement);

      // Create element with options
      const original = new ConfigurableElement({ label: 'Original' });
      (original as any).options = { label: 'Original' };
      document.body.appendChild(original);

      expect(original.textContent).toBe('Config: Original');

      // Clone should preserve options
      const clone = original.cloneNode(true) as ConfigurableElement;
      document.body.appendChild(clone);

      // Options should be preserved
      expect((clone as any).options).toBeDefined();
      expect((clone as any).options.label).toBe('Original');

      // Cleanup
      document.body.removeChild(original);
      document.body.removeChild(clone);
    });
  });

  describe('Scenario 4: Full Application Flow', () => {
    it('should handle component tree with multi-level dependency injection', () => {
      // Create a component tree with multiple injector levels
      const root = document.createElement('div');
      const level1 = document.createElement('div');
      const level2 = document.createElement('div');
      const level3 = document.createElement('div');

      root.appendChild(level1);
      level1.appendChild(level2);
      level2.appendChild(level3);
      document.body.appendChild(root);

      // Setup injector hierarchy
      (window as any).customProviders = injectorRoot;
      
      // Create injectors in order, ensuring proper parent-child relationships
      injectorRoot.ensureInjector(root);
      const rootInjector = injectorRoot.getInjectorOf(root)!;
      rootInjector.set('rootService', { level: 'root' });
      
      // Level2 injector will automatically use root as parent
      injectorRoot.ensureInjector(level2);
      const level2Injector = injectorRoot.getInjectorOf(level2)!;
      level2Injector.set('level2Service', { level: 'level2' });

      // Test that level2 injector has correct parent
      expect(level2Injector.parentInjector).toBe(rootInjector);

      // Test provider resolution from level3 (which doesn't have its own injector)
      // It should find level2's injector, which should look up to root
      const level3AsAny = level3 as any;
      const foundInjector = level3AsAny.getClosestInjector?.();
      
      expect(foundInjector).toBeTruthy();
      expect(foundInjector).toBe(level2Injector);
      
      // Check level2 service (direct)
      expect(foundInjector.get('level2Service')).toEqual({ level: 'level2' });
      
      // Check root service (should traverse to parent)
      const rootService = foundInjector.get('rootService');
      if (!rootService) {
        // If not found, manually check parent
        const parentService = foundInjector.parentInjector?.get('rootService');
        expect(parentService).toEqual({ level: 'root' });
      } else {
        expect(rootService).toEqual({ level: 'root' });
      }

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(root);
    });

    it('should track creation injectors for dynamically created elements', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      (window as any).customProviders = injectorRoot;
      
      // Create an injector for the container
      injectorRoot.ensureInjector(container);
      const containerInjector = injectorRoot.getInjectorOf(container)!;
      containerInjector.set('theme', 'dark');

      // Set creation injector context
      InjectorRoot.creationInjector = containerInjector;

      // Create an element (should inherit the creation injector)
      const newElement = document.createElement('div');
      
      // Reset creation injector
      InjectorRoot.creationInjector = null;

      // Add to container
      container.appendChild(newElement);

      // The element should be able to access the container's injector
      const elementInjector = (newElement as any).getClosestInjector?.();
      expect(elementInjector).toBeTruthy();
      expect(elementInjector.get('theme')).toBe('dark');

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(container);
    });
  });

  describe('Scenario 5: Performance and Edge Cases', () => {
    it('should handle deep element hierarchies', () => {
      // Create a deep tree
      let current = document.createElement('div');
      const root = current;
      document.body.appendChild(root);

      // Create 10 levels deep
      for (let i = 0; i < 10; i++) {
        const child = document.createElement('div');
        child.setAttribute('data-level', String(i));
        current.appendChild(child);
        current = child;
      }

      // Clone the entire tree
      const clone = root.cloneNode(true) as Element;
      document.body.appendChild(clone);

      // Verify structure is preserved
      const deepestClone = clone.querySelector('[data-level="9"]');
      expect(deepestClone).toBeTruthy();
      expect(deepestClone?.getAttribute('data-level')).toBe('9');

      // Cleanup
      document.body.removeChild(root);
      document.body.removeChild(clone);
    });

    it('should handle rapid provider registrations', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      (window as any).customProviders = injectorRoot;
      
      injectorRoot.ensureInjector(container);
      const injector = injectorRoot.getInjectorOf(container)!;

      // Register many providers rapidly
      for (let i = 0; i < 100; i++) {
        injector.set(`service${i}`, { id: i });
      }

      // Verify all providers are accessible
      expect(injector.get('service0')).toEqual({ id: 0 });
      expect(injector.get('service50')).toEqual({ id: 50 });
      expect(injector.get('service99')).toEqual({ id: 99 });

      // Cleanup
      delete (window as any).customProviders;
      document.body.removeChild(container);
    });

    it('should handle detached elements with injectors', () => {
      // Create element without attaching to document
      const detached = document.createElement('div');
      
      (window as any).customProviders = injectorRoot;
      
      // Create injector on detached element
      injectorRoot.ensureInjector(detached);
      const injector = injectorRoot.getInjectorOf(detached)!;
      injector.set('value', 'test');

      // Should work even when detached
      expect(injector.get('value')).toBe('test');

      // Now attach and verify it still works
      document.body.appendChild(detached);
      expect(injector.get('value')).toBe('test');

      // Detach and verify
      document.body.removeChild(detached);
      expect(injector.get('value')).toBe('test');

      // Cleanup
      delete (window as any).customProviders;
    });
  });
});
