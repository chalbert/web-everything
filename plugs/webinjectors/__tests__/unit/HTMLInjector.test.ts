/**
 * Unit tests for HTMLInjector
 * 
 * @module webinjectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import HTMLInjector from '../../HTMLInjector';
import HTMLRegistry from '../../HTMLRegistry';

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

describe('HTMLInjector', () => {
  let element: HTMLElement;
  let injector: HTMLInjector;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    injector = new HTMLInjector(element);
  });

  describe('constructor', () => {
    it('should create with HTMLElement target', () => {
      expect(injector.target).toBe(element);
    });

    it('should default to document', () => {
      const defaultInjector = new HTMLInjector();
      expect(defaultInjector.target).toBe(document);
    });

    it('should accept parent injector', () => {
      const parentInjector = new HTMLInjector(element);
      const childElement = document.createElement('span');
      element.appendChild(childElement);
      const childInjector = new HTMLInjector(childElement, parentInjector);
      
      expect(childInjector.parentInjector).toBe(parentInjector);
    });
  });

  describe('set', () => {
    it('should set provider', () => {
      const registry = new TestHTMLRegistry();
      injector.set('testRegistry', registry);
      
      expect(injector.get('testRegistry')).toBe(registry);
    });

    // TODO: Test CustomContext attachment when webcontexts is migrated
    it.skip('should attach CustomContext if target is connected', () => {
      // Will be enabled when CustomContext is available
    });
  });

  describe('isQuerierValid', () => {
    it('should validate based on DOM containment', () => {
      const childElement = document.createElement('span');
      element.appendChild(childElement);
      
      expect(injector.isQuerierValid(childElement)).toBe(true);
    });

    it('should return false for non-contained nodes', () => {
      const outsideElement = document.createElement('div');
      
      expect(injector.isQuerierValid(outsideElement)).toBe(false);
    });

    it('should return true for the target itself', () => {
      expect(injector.isQuerierValid(element)).toBe(true);
    });
  });

  describe('hierarchy', () => {
    it('should maintain parent-child relationships', () => {
      const parentElement = document.createElement('div');
      const childElement = document.createElement('span');
      parentElement.appendChild(childElement);
      document.body.appendChild(parentElement);
      
      const parentInjector = new HTMLInjector(parentElement);
      const childInjector = new HTMLInjector(childElement, parentInjector);
      
      expect(childInjector.parentInjector).toBe(parentInjector);
      expect(parentInjector.childInjectors.has(childInjector)).toBe(true);
    });
  });

  describe('provider resolution', () => {
    it('should resolve providers from parent chain', () => {
      const parentElement = document.createElement('div');
      const childElement = document.createElement('span');
      parentElement.appendChild(childElement);
      document.body.appendChild(parentElement);
      
      const parentInjector = new HTMLInjector(parentElement);
      const childInjector = new HTMLInjector(childElement, parentInjector);
      
      const registry = new TestHTMLRegistry();
      parentInjector.set('testRegistry', registry);
      
      // Child can access parent's provider via consume
      const consumable = childInjector.consume('testRegistry', childElement);
      expect(consumable).toBeTruthy();
    });
  });
});
