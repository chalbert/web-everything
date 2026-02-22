/**
 * Unit tests for RouteOutletElement.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RouteOutletElement from '../../../router/elements/RouteOutletElement';

// Register the custom element once
if (!customElements.get('route-outlet')) {
  customElements.define('route-outlet', RouteOutletElement);
}

describe('RouteOutletElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('element creation', () => {
    it('should be a custom element', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      expect(el).toBeInstanceOf(RouteOutletElement);
      expect(el).toBeInstanceOf(HTMLElement);
    });

    it('should have observed attributes', () => {
      expect(RouteOutletElement.observedAttributes).toEqual(['name']);
    });
  });

  describe('name attribute', () => {
    it('should return empty string when no name attribute', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      expect(el.name).toBe('');
    });

    it('should return the name attribute value', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      el.setAttribute('name', 'sidebar');
      expect(el.name).toBe('sidebar');
    });
  });

  describe('activeContent', () => {
    it('should return empty array when no content stamped', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      expect(el.activeContent).toEqual([]);
    });

    it('should return stamped content nodes', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      const p = document.createElement('p');
      p.textContent = 'Stamped';

      // Simulate RouteViewElement stamping
      (el as any).__routeStampedContent = [p];
      el.appendChild(p);

      expect(el.activeContent).toHaveLength(1);
      expect(el.activeContent[0]).toBe(p);
    });
  });

  describe('activeRoute', () => {
    it('should return null when no route matched', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      expect(el.activeRoute).toBeNull();
    });
  });

  describe('display', () => {
    it('should set display: block on connect', () => {
      const el = document.createElement('route-outlet') as RouteOutletElement;
      document.body.appendChild(el);

      expect(el.style.display).toBe('block');
    });
  });
});
