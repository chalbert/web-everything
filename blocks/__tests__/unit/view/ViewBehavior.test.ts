/**
 * Unit tests for ViewBehavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ViewBehavior from '../../../view/ViewBehavior';

describe('ViewBehavior', () => {
  let behavior: ViewBehavior;
  let element: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    element = document.createElement('section');
    element.id = 'test-panel';
    document.body.appendChild(element);

    behavior = new ViewBehavior({ name: 'view' });
    behavior.attach(element);
    behavior.isConnected = true;
    behavior.connectedCallback?.();
  });

  function dispatchCommand(command: string): void {
    const event = new CustomEvent('command', { bubbles: false });
    (event as any).command = command;
    element.dispatchEvent(event);
  }

  describe('command handling', () => {
    it('should show element on --view-show command', () => {
      element.setAttribute('hidden', '');
      expect(behavior.engine.isVisible(element)).toBe(false);

      dispatchCommand('--view-show');

      expect(behavior.engine.isVisible(element)).toBe(true);
    });

    it('should hide element on --view-hide command', () => {
      expect(behavior.engine.isVisible(element)).toBe(true);

      dispatchCommand('--view-hide');

      expect(behavior.engine.isVisible(element)).toBe(false);
    });

    it('should toggle element on --view-toggle command', () => {
      expect(behavior.engine.isVisible(element)).toBe(true);

      dispatchCommand('--view-toggle');
      expect(behavior.engine.isVisible(element)).toBe(false);

      dispatchCommand('--view-toggle');
      expect(behavior.engine.isVisible(element)).toBe(true);
    });

    it('should ignore unknown commands', () => {
      const spy = vi.fn();
      element.addEventListener('toggle', spy);

      dispatchCommand('--some-other-command');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('hidden-mode attribute', () => {
    it('should use hidden-mode from element when hiding', () => {
      element.setAttribute('hidden-mode', 'inert');

      dispatchCommand('--view-hide');

      expect(element.hasAttribute('inert')).toBe(true);
    });

    it('should default to content-visibility when no hidden-mode', () => {
      dispatchCommand('--view-hide');

      expect(element.getAttribute('data-view-hidden')).toBe('content-visibility');
      expect(behavior.engine.isVisible(element)).toBe(false);
    });
  });

  describe('exclusive groups', () => {
    it('should hide siblings with same name when shown', () => {
      const container = document.createElement('div');
      const panel1 = document.createElement('section');
      panel1.setAttribute('name', 'panels');
      const panel2 = document.createElement('section');
      panel2.setAttribute('name', 'panels');
      panel2.setAttribute('hidden', '');

      container.appendChild(panel1);
      container.appendChild(panel2);
      document.body.innerHTML = '';
      document.body.appendChild(container);

      const behavior2 = new ViewBehavior({ name: 'view' });
      behavior2.attach(panel2);
      behavior2.isConnected = true;
      behavior2.connectedCallback?.();

      // Show panel2 via command
      const event = new CustomEvent('command', { bubbles: false });
      (event as any).command = '--view-show';
      panel2.dispatchEvent(event);

      expect(behavior2.engine.isVisible(panel2)).toBe(true);
      expect(behavior2.engine.isVisible(panel1)).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should stop listening on disconnect', () => {
      behavior.disconnectedCallback?.();

      // Commands should no longer work
      element.setAttribute('hidden', '');
      dispatchCommand('--view-show');

      expect(element.hasAttribute('hidden')).toBe(true);
    });
  });
});
