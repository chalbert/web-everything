/**
 * Unit tests for ViewEngine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ViewEngine from '../../../view/ViewEngine';
import type { ViewToggleEventDetail } from '../../../view/ViewEngine';

describe('ViewEngine', () => {
  let engine: ViewEngine;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new ViewEngine();
  });

  describe('isVisible', () => {
    it('should return true for a visible element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      expect(engine.isVisible(el)).toBe(true);
    });

    it('should return false for an element with hidden attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      expect(engine.isVisible(el)).toBe(false);
    });

    it('should return false for an element with hidden="until-found"', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', 'until-found');
      document.body.appendChild(el);

      expect(engine.isVisible(el)).toBe(false);
    });

    it('should return false for an element hidden via content-visibility mode', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Hide using the engine (sets both CSS and data attribute)
      engine.hide(el);

      expect(engine.isVisible(el)).toBe(false);
    });

    it('should return false for an element with inert attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('inert', '');
      document.body.appendChild(el);

      expect(engine.isVisible(el)).toBe(false);
    });
  });

  describe('show', () => {
    it('should remove hidden attribute and return true', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      const result = engine.show(el);

      expect(result).toBe(true);
      expect(el.hasAttribute('hidden')).toBe(false);
      expect(engine.isVisible(el)).toBe(true);
    });

    it('should remove content-visibility hidden mode', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Hide first using the engine
      engine.hide(el);
      expect(engine.isVisible(el)).toBe(false);

      engine.show(el);

      expect(el.hasAttribute('data-view-hidden')).toBe(false);
      expect(engine.isVisible(el)).toBe(true);
    });

    it('should remove inert attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('inert', '');
      document.body.appendChild(el);

      engine.show(el);

      expect(el.hasAttribute('inert')).toBe(false);
    });

    it('should remove hidden="until-found"', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', 'until-found');
      document.body.appendChild(el);

      engine.show(el);

      expect(el.hasAttribute('hidden')).toBe(false);
    });

    it('should return false if already visible', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const result = engine.show(el);

      expect(result).toBe(false);
    });

    it('should fire beforetoggle and toggle events', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      const beforeToggle = vi.fn();
      const toggle = vi.fn();
      el.addEventListener('beforetoggle', beforeToggle);
      el.addEventListener('toggle', toggle);

      engine.show(el);

      expect(beforeToggle).toHaveBeenCalledTimes(1);
      expect(toggle).toHaveBeenCalledTimes(1);

      const beforeDetail = beforeToggle.mock.calls[0][0].detail as ViewToggleEventDetail;
      expect(beforeDetail.oldState).toBe('hidden');
      expect(beforeDetail.newState).toBe('visible');

      const toggleDetail = toggle.mock.calls[0][0].detail as ViewToggleEventDetail;
      expect(toggleDetail.oldState).toBe('hidden');
      expect(toggleDetail.newState).toBe('visible');
    });

    it('should not toggle if beforetoggle is cancelled', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      el.addEventListener('beforetoggle', (e) => e.preventDefault());

      const result = engine.show(el);

      expect(result).toBe(false);
      expect(el.hasAttribute('hidden')).toBe(true);
    });
  });

  describe('hide', () => {
    it('should apply display hidden mode (hidden attribute)', () => {
      const displayEngine = new ViewEngine({ hiddenMode: 'display' });
      const el = document.createElement('div');
      document.body.appendChild(el);

      displayEngine.hide(el);

      expect(el.hasAttribute('hidden')).toBe(true);
      expect(el.getAttribute('hidden')).toBe('');
    });

    it('should apply content-visibility hidden mode (default)', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      engine.hide(el);

      expect(el.getAttribute('data-view-hidden')).toBe('content-visibility');
      expect(engine.isVisible(el)).toBe(false);
    });

    it('should apply until-found hidden mode', () => {
      const untilFoundEngine = new ViewEngine({ hiddenMode: 'until-found' });
      const el = document.createElement('div');
      document.body.appendChild(el);

      untilFoundEngine.hide(el);

      expect(el.getAttribute('hidden')).toBe('until-found');
    });

    it('should apply inert hidden mode', () => {
      const inertEngine = new ViewEngine({ hiddenMode: 'inert' });
      const el = document.createElement('div');
      document.body.appendChild(el);

      inertEngine.hide(el);

      expect(el.hasAttribute('inert')).toBe(true);
    });

    it('should return false if already hidden', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      const result = engine.hide(el);

      expect(result).toBe(false);
    });

    it('should fire beforetoggle and toggle events', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const beforeToggle = vi.fn();
      const toggle = vi.fn();
      el.addEventListener('beforetoggle', beforeToggle);
      el.addEventListener('toggle', toggle);

      engine.hide(el);

      expect(beforeToggle).toHaveBeenCalledTimes(1);
      expect(toggle).toHaveBeenCalledTimes(1);

      const beforeDetail = beforeToggle.mock.calls[0][0].detail as ViewToggleEventDetail;
      expect(beforeDetail.oldState).toBe('visible');
      expect(beforeDetail.newState).toBe('hidden');
    });

    it('should not toggle if beforetoggle is cancelled', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      el.addEventListener('beforetoggle', (e) => e.preventDefault());

      const result = engine.hide(el);

      expect(result).toBe(false);
      expect(engine.isVisible(el)).toBe(true);
    });

    it('should respect hidden-mode attribute on element', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden-mode', 'inert');
      document.body.appendChild(el);

      engine.hide(el);

      expect(el.hasAttribute('inert')).toBe(true);
    });

    it('should prefer options over element attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden-mode', 'inert');
      document.body.appendChild(el);

      engine.hide(el, { hiddenMode: 'display' });

      expect(el.hasAttribute('hidden')).toBe(true);
      expect(el.hasAttribute('inert')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should show a hidden element', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      const result = engine.toggle(el);

      expect(result).toBe(true);
      expect(engine.isVisible(el)).toBe(true);
    });

    it('should hide a visible element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const result = engine.toggle(el);

      expect(result).toBe(true);
      expect(engine.isVisible(el)).toBe(false);
    });
  });

  describe('exclusive groups', () => {
    it('should hide siblings with same name when showing an element', () => {
      const container = document.createElement('div');
      const panel1 = document.createElement('section');
      panel1.setAttribute('name', 'panels');
      const panel2 = document.createElement('section');
      panel2.setAttribute('name', 'panels');
      panel2.setAttribute('hidden', '');
      const panel3 = document.createElement('section');
      panel3.setAttribute('name', 'panels');
      panel3.setAttribute('hidden', '');

      container.appendChild(panel1);
      container.appendChild(panel2);
      container.appendChild(panel3);
      document.body.appendChild(container);

      // panel1 is visible, show panel2
      engine.show(panel2);

      expect(engine.isVisible(panel1)).toBe(false);
      expect(engine.isVisible(panel2)).toBe(true);
      expect(engine.isVisible(panel3)).toBe(false);
    });

    it('should not affect elements with different name', () => {
      const container = document.createElement('div');
      const panel1 = document.createElement('section');
      panel1.setAttribute('name', 'group-a');
      const panel2 = document.createElement('section');
      panel2.setAttribute('name', 'group-b');

      container.appendChild(panel1);
      container.appendChild(panel2);
      document.body.appendChild(container);

      // Both visible, they're different groups
      expect(engine.isVisible(panel1)).toBe(true);
      expect(engine.isVisible(panel2)).toBe(true);
    });

    it('should not affect elements without name attribute', () => {
      const container = document.createElement('div');
      const panel1 = document.createElement('section');
      const panel2 = document.createElement('section');
      panel2.setAttribute('hidden', '');

      container.appendChild(panel1);
      container.appendChild(panel2);
      document.body.appendChild(container);

      engine.show(panel2);

      // panel1 should still be visible (no name, not in a group)
      expect(engine.isVisible(panel1)).toBe(true);
      expect(engine.isVisible(panel2)).toBe(true);
    });
  });

  describe('getGroupMembers', () => {
    it('should return all elements with same name in same parent', () => {
      const container = document.createElement('div');
      const panel1 = document.createElement('section');
      panel1.setAttribute('name', 'panels');
      const panel2 = document.createElement('section');
      panel2.setAttribute('name', 'panels');
      const panel3 = document.createElement('section');
      panel3.setAttribute('name', 'other');

      container.appendChild(panel1);
      container.appendChild(panel2);
      container.appendChild(panel3);
      document.body.appendChild(container);

      const members = engine.getGroupMembers(panel1);

      expect(members).toHaveLength(2);
      expect(members).toContain(panel1);
      expect(members).toContain(panel2);
      expect(members).not.toContain(panel3);
    });

    it('should return empty array for element without name', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      expect(engine.getGroupMembers(el)).toEqual([]);
    });
  });

  describe('getHiddenMode', () => {
    it('should return element hidden-mode attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden-mode', 'until-found');

      expect(engine.getHiddenMode(el)).toBe('until-found');
    });

    it('should fallback to instance default', () => {
      const el = document.createElement('div');

      expect(engine.getHiddenMode(el)).toBe('content-visibility');
    });

    it('should use constructor default', () => {
      const inertEngine = new ViewEngine({ hiddenMode: 'inert' });
      const el = document.createElement('div');

      expect(inertEngine.getHiddenMode(el)).toBe('inert');
    });

    it('should ignore invalid hidden-mode attribute values', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden-mode', 'invalid');

      expect(engine.getHiddenMode(el)).toBe('content-visibility');
    });
  });

  describe('getGroupName', () => {
    it('should return name attribute value', () => {
      const el = document.createElement('div');
      el.setAttribute('name', 'my-group');

      expect(engine.getGroupName(el)).toBe('my-group');
    });

    it('should return undefined when no name attribute', () => {
      const el = document.createElement('div');

      expect(engine.getGroupName(el)).toBeUndefined();
    });
  });

  describe('view transitions', () => {
    it('should call startViewTransition when enabled', () => {
      const mockTransition = vi.fn((fn: () => void) => fn());
      (document as any).startViewTransition = mockTransition;

      const transitionEngine = new ViewEngine({ transition: true });
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      transitionEngine.show(el);

      expect(mockTransition).toHaveBeenCalledTimes(1);
      expect(engine.isVisible(el)).toBe(true);

      delete (document as any).startViewTransition;
    });

    it('should work without startViewTransition when enabled', () => {
      // Ensure startViewTransition doesn't exist
      delete (document as any).startViewTransition;

      const transitionEngine = new ViewEngine({ transition: true });
      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      // Should still work, just without transition
      transitionEngine.show(el);

      expect(engine.isVisible(el)).toBe(true);
    });

    it('should accept per-call transition override', () => {
      const mockTransition = vi.fn((fn: () => void) => fn());
      (document as any).startViewTransition = mockTransition;

      const el = document.createElement('div');
      el.setAttribute('hidden', '');
      document.body.appendChild(el);

      // Engine default is no transition, but override per call
      engine.show(el, { transition: true });

      expect(mockTransition).toHaveBeenCalledTimes(1);

      delete (document as any).startViewTransition;
    });
  });
});
