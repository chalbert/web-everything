/**
 * Unit tests for InjectorRoot
 * 
 * @module webinjectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import InjectorRoot from '../../InjectorRoot';
import HTMLRegistry from '../../HTMLRegistry';
import CustomRegistry from '../../../core/CustomRegistry';

// Mock HTMLRegistry for testing
class TestHTMLRegistry extends HTMLRegistry<any, any> {
  localName = 'testRegistry';
  
  upgrade(node: Node): void {
    // Mock implementation
  }
  
  downgrade(node: Node): void {
    // Mock implementation
  }
}

describe('InjectorRoot', () => {
  let injectorRoot: InjectorRoot;
  let rootElement: HTMLElement;

  beforeEach(() => {
    rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    injectorRoot = new InjectorRoot();
  });

  afterEach(() => {
    document.body.removeChild(rootElement);
  });

  describe('static methods', () => {
    describe('getInjectorRootOf', () => {
      it('should return undefined for nodes without InjectorRoot', () => {
        const element = document.createElement('div');
        expect(InjectorRoot.getInjectorRootOf(element)).toBeUndefined();
      });

      it('should return InjectorRoot after attach', () => {
        injectorRoot.attach(document);
        expect(InjectorRoot.getInjectorRootOf(rootElement)).toBe(injectorRoot);
      });
    });

    describe('getProviderOf', () => {
      it('should return undefined if no injectors exist', () => {
        const element = document.createElement('div');
        const result = InjectorRoot.getProviderOf(element, 'testRegistry');
        expect(result).toBeUndefined();
      });

      // Integration test - requires Node patches to be applied
      it.skip('should find provider in injector chain', () => {
        // Will be tested in integration tests
      });
    });

    describe('getProvidersOf', () => {
      it('should return empty map if no injectors exist', () => {
        const element = document.createElement('div');
        const providers = InjectorRoot.getProvidersOf(element);
        expect(providers.size).toBe(0);
      });
    });

    describe('creationInjector', () => {
      it('should be initially null', () => {
        expect(InjectorRoot.creationInjector).toBeNull();
      });

      it('should be settable', () => {
        const injector = injectorRoot.getInjectorOf(document);
        InjectorRoot.creationInjector = injector;
        expect(InjectorRoot.creationInjector).toBe(injector);
        InjectorRoot.creationInjector = null;
      });
    });
  });

  describe('instance methods', () => {
    describe('attach/detach', () => {
      it('should attach InjectorRoot to document', () => {
        injectorRoot.attach(document);
        
        expect(InjectorRoot.getInjectorRootOf(document.body)).toBe(injectorRoot);
      });

      it('should create root injector on attach', () => {
        injectorRoot.attach(document);
        
        const rootInjector = injectorRoot.getInjectorOf(document);
        expect(rootInjector).toBeTruthy();
        expect(rootInjector?.target).toBe(document);
      });

      it('should remove InjectorRoot on detach', () => {
        injectorRoot.attach(document);
        injectorRoot.detach(document);
        
        expect(InjectorRoot.getInjectorRootOf(document.body)).toBeUndefined();
      });
    });

    describe('register/unregister', () => {
      beforeEach(() => {
        injectorRoot.attach(document);
      });

      afterEach(() => {
        injectorRoot.detach(document);
      });

      it('should register provider on element', () => {
        const element = document.createElement('div');
        const registry = new TestHTMLRegistry();
        
        injectorRoot.register(element, registry);
        
        const injector = injectorRoot.getInjectorOf(element);
        expect(injector).toBeTruthy();
      });

      it('should unregister provider from element', () => {
        const element = document.createElement('div');
        const registry = new TestHTMLRegistry();
        
        injectorRoot.register(element, registry);
        injectorRoot.unregister(element, registry);
        
        const injector = injectorRoot.getInjectorOf(element);
        expect(injector?.get('testRegistry')).toBeUndefined();
      });
    });

    describe('upgrade/downgrade', () => {
      beforeEach(() => {
        injectorRoot.attach(document);
      });

      afterEach(() => {
        injectorRoot.detach(document);
      });

      it('should upgrade element tree', () => {
        const element = document.createElement('div');
        element.setAttribute('injectors', 'test');
        document.body.appendChild(element);
        
        expect(() => injectorRoot.upgrade(element)).not.toThrow();
        
        document.body.removeChild(element);
      });

      it('should downgrade element tree', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        
        injectorRoot.upgrade(element);
        expect(() => injectorRoot.downgrade(element)).not.toThrow();
        
        document.body.removeChild(element);
      });

      it('should not upgrade/downgrade root nodes', () => {
        // Root nodes (getRootNode() === itself) should be skipped
        expect(() => injectorRoot.upgrade(document)).not.toThrow();
        expect(() => injectorRoot.downgrade(document)).not.toThrow();
      });
    });

    describe('ensureInjector', () => {
      beforeEach(() => {
        injectorRoot.attach(document);
      });

      afterEach(() => {
        injectorRoot.detach(document);
      });

      it('should create injector if not exists', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        
        const injector = injectorRoot.ensureInjector(element);
        
        expect(injector).toBeTruthy();
        expect(injector.target).toBe(element);
        
        document.body.removeChild(element);
      });

      it('should return existing injector', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        
        const injector1 = injectorRoot.ensureInjector(element);
        const injector2 = injectorRoot.ensureInjector(element);
        
        expect(injector1).toBe(injector2);
        
        document.body.removeChild(element);
      });

      it('should wire injector into hierarchy', () => {
        const parentElement = document.createElement('div');
        const childElement = document.createElement('span');
        parentElement.appendChild(childElement);
        document.body.appendChild(parentElement);
        
        const parentInjector = injectorRoot.ensureInjector(parentElement);
        const childInjector = injectorRoot.ensureInjector(childElement, parentInjector);
        
        expect(childInjector.parentInjector).toBeTruthy();
        
        document.body.removeChild(parentElement);
      });
    });

    describe('getInjectorOf', () => {
      it('should return null if no injector exists', () => {
        const element = document.createElement('div');
        expect(injectorRoot.getInjectorOf(element)).toBeNull();
      });

      it('should return injector after registration', () => {
        injectorRoot.attach(document);
        
        const element = document.createElement('div');
        const registry = new TestHTMLRegistry();
        injectorRoot.register(element, registry);
        
        const injector = injectorRoot.getInjectorOf(element);
        expect(injector).toBeTruthy();
        
        injectorRoot.detach(document);
      });
    });
  });

  describe('localName', () => {
    it('should have correct localName', () => {
      expect(injectorRoot.localName).toBe('customProviders');
    });
  });
});
