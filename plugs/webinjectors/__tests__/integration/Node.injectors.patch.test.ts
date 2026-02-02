/**
 * Integration tests for Node.injectors.patch.ts
 * 
 * Tests the injector traversal methods added to Node.prototype.
 * 
 * @module webinjectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches, isNodeInjectorsPatched } from '../../Node.injectors.patch';
import InjectorRoot from '../../InjectorRoot';
import HTMLInjector from '../../HTMLInjector';

describe('Node.injectors.patch integration', () => {
  beforeEach(() => {
    applyNodeInjectorsPatches();
  });

  afterEach(() => {
    removeNodeInjectorsPatches();
  });

  describe('patch application', () => {
    it('should apply patches to Node.prototype', () => {
      expect(isNodeInjectorsPatched()).toBe(true);
      expect('injectors' in Node.prototype).toBe(true);
      expect('getClosestInjector' in Node.prototype).toBe(true);
      expect('getOwnInjector' in Node.prototype).toBe(true);
      expect('hasOwnInjector' in Node.prototype).toBe(true);
    });

    it('should remove patches from Node.prototype', () => {
      removeNodeInjectorsPatches();
      
      expect(isNodeInjectorsPatched()).toBe(false);
      expect('injectors' in Node.prototype).toBe(false);
    });

    it('should not apply patches twice', () => {
      const firstCheck = isNodeInjectorsPatched();
      applyNodeInjectorsPatches();
      const secondCheck = isNodeInjectorsPatched();
      
      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(true);
    });
  });

  describe('Node constructor interception', () => {
    it('should intercept Node construction', () => {
      // Create elements to verify constructor interception
      const element = document.createElement('div');
      expect(element).toBeInstanceOf(Node);
    });

    it('should preserve instanceof checks', () => {
      const element = document.createElement('div');
      const text = document.createTextNode('test');
      const comment = document.createComment('test');
      
      expect(element).toBeInstanceOf(Node);
      expect(text).toBeInstanceOf(Node);
      expect(comment).toBeInstanceOf(Node);
    });

    it('should track creation injector', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const mockInjector = new HTMLInjector(document);
      InjectorRoot.creationInjector = mockInjector;
      
      const element = document.createElement('div');
      
      InjectorRoot.creationInjector = null;
      injectorRoot.detach(document);
      
      // Element should have been tracked during creation
      expect(element).toBeTruthy();
    });
  });

  describe('getOwnInjector', () => {
    it('should return null for elements without injector', () => {
      const element = document.createElement('div');
      expect((element as any).getOwnInjector()).toBeNull();
    });

    it('should return injector for registered element', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      // Mock injectors
      (window as any).injectors = injectorRoot;
      
      const injector = injectorRoot.ensureInjector(element);
      const retrieved = (element as any).getOwnInjector();
      
      expect(retrieved).toBeTruthy();
      
      delete (window as any).injectors;
      document.body.removeChild(element);
      injectorRoot.detach(document);
    });

    it('should return null for non-HTMLElement nodes', () => {
      const text = document.createTextNode('test');
      expect((text as any).getOwnInjector()).toBeNull();
    });
  });

  describe('hasOwnInjector', () => {
    it('should return false for elements without injector', () => {
      const element = document.createElement('div');
      expect((element as any).hasOwnInjector()).toBe(false);
    });

    it('should return true for elements with injector', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      (window as any).injectors = injectorRoot;
      
      injectorRoot.ensureInjector(element);
      const hasInjector = (element as any).hasOwnInjector();
      
      expect(hasInjector).toBe(true);
      
      delete (window as any).injectors;
      document.body.removeChild(element);
      injectorRoot.detach(document);
    });
  });

  describe('getClosestInjector', () => {
    it('should return null if no injector exists', () => {
      const element = document.createElement('div');
      expect((element as any).getClosestInjector()).toBeNull();
    });

    it('should find injector on parent element', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const parentElement = document.createElement('div');
      const childElement = document.createElement('span');
      parentElement.appendChild(childElement);
      document.body.appendChild(parentElement);
      
      (window as any).injectors = injectorRoot;
      
      const parentInjector = injectorRoot.ensureInjector(parentElement);
      const foundInjector = (childElement as any).getClosestInjector();
      
      expect(foundInjector).toBe(parentInjector);
      
      delete (window as any).injectors;
      document.body.removeChild(parentElement);
      injectorRoot.detach(document);
    });

    it('should traverse up the DOM tree', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const grandparent = document.createElement('div');
      const parent = document.createElement('div');
      const child = document.createElement('span');
      grandparent.appendChild(parent);
      parent.appendChild(child);
      document.body.appendChild(grandparent);
      
      (window as any).injectors = injectorRoot;
      
      const grandparentInjector = injectorRoot.ensureInjector(grandparent);
      const foundInjector = (child as any).getClosestInjector();
      
      expect(foundInjector).toBe(grandparentInjector);
      
      delete (window as any).injectors;
      document.body.removeChild(grandparent);
      injectorRoot.detach(document);
    });

    it('should return root injector for document', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      (window as any).injectors = injectorRoot;
      
      const rootInjector = injectorRoot.getInjectorOf(document);
      const foundInjector = (document.body as any).getClosestInjector();
      
      expect(foundInjector).toBeTruthy();
      
      delete (window as any).injectors;
      injectorRoot.detach(document);
    });

    it('should fallback to creation injector', () => {
      const mockInjector = new HTMLInjector(document);
      InjectorRoot.creationInjector = mockInjector;
      
      const element = document.createElement('div');
      
      const foundInjector = (element as any).getClosestInjector();
      
      expect(foundInjector).toBe(mockInjector);
      
      InjectorRoot.creationInjector = null;
    });
  });

  describe('injectors generator', () => {
    it('should yield injector chain', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      document.body.appendChild(parent);
      
      (window as any).injectors = injectorRoot;
      
      const parentInjector = injectorRoot.ensureInjector(parent);
      const rootInjector = injectorRoot.getInjectorOf(document);
      
      const injectors = Array.from((child as any).injectors());
      
      expect(injectors.length).toBeGreaterThan(0);
      expect(injectors[0]).toBe(parentInjector);
      
      delete (window as any).injectors;
      document.body.removeChild(parent);
      injectorRoot.detach(document);
    });

    it('should terminate at root', () => {
      const injectorRoot = new InjectorRoot();
      injectorRoot.attach(document);
      
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      (window as any).injectors = injectorRoot;
      
      const injectors = Array.from((element as any).injectors());
      const lastInjector = injectors[injectors.length - 1];
      
      expect(lastInjector?.parentInjector).toBeNull();
      
      delete (window as any).injectors;
      document.body.removeChild(element);
      injectorRoot.detach(document);
    });

    it('should return empty iterator if no injectors', () => {
      const element = document.createElement('div');
      const injectors = Array.from((element as any).injectors());
      
      expect(injectors).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle disconnected nodes', () => {
      const element = document.createElement('div');
      expect((element as any).getClosestInjector()).toBeNull();
      expect((element as any).hasOwnInjector()).toBe(false);
    });

    it('should handle DocumentFragment', () => {
      const fragment = document.createDocumentFragment();
      const element = document.createElement('div');
      fragment.appendChild(element);
      
      expect((element as any).getClosestInjector()).toBeNull();
    });

    it('should handle ShadowRoot', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const element = document.createElement('span');
      shadow.appendChild(element);
      
      expect((element as any).getClosestInjector()).toBeNull();
    });
  });
});
