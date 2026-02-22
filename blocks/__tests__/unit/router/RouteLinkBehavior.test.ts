/**
 * Unit tests for RouteLinkBehavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RouteLinkBehavior from '../../../router/behaviors/RouteLinkBehavior';
import CustomAttribute from '../../../../plugs/webbehaviors/CustomAttribute';

describe('RouteLinkBehavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createLink(path: string): { anchor: HTMLAnchorElement; behavior: RouteLinkBehavior } {
    const anchor = document.createElement('a');
    anchor.setAttribute('route:link', path);
    document.body.appendChild(anchor);

    const behavior = new RouteLinkBehavior({ name: 'route:link', value: path });
    behavior.attach(anchor);
    behavior.isConnected = true;

    return { anchor, behavior };
  }

  describe('creation', () => {
    it('should extend CustomAttribute', () => {
      const behavior = new RouteLinkBehavior({ name: 'route:link', value: '/home' });
      expect(behavior).toBeInstanceOf(CustomAttribute);
    });
  });

  describe('connectedCallback', () => {
    it('should set href on the anchor element', () => {
      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();

      expect(anchor.getAttribute('href')).toBe('/about');
    });

    it('should intercept click and push to history', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');

      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true, button: 0 });
      anchor.dispatchEvent(event);

      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/about');
      pushStateSpy.mockRestore();
    });

    it('should not intercept ctrl+click', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');

      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();

      const event = new MouseEvent('click', {
        bubbles: true,
        button: 0,
        ctrlKey: true,
      });
      anchor.dispatchEvent(event);

      expect(pushStateSpy).not.toHaveBeenCalled();
      pushStateSpy.mockRestore();
    });

    it('should not intercept meta+click', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');

      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();

      const event = new MouseEvent('click', {
        bubbles: true,
        button: 0,
        metaKey: true,
      });
      anchor.dispatchEvent(event);

      expect(pushStateSpy).not.toHaveBeenCalled();
      pushStateSpy.mockRestore();
    });

    it('should not intercept right click', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');

      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true, button: 2 });
      anchor.dispatchEvent(event);

      expect(pushStateSpy).not.toHaveBeenCalled();
      pushStateSpy.mockRestore();
    });
  });

  describe('active state', () => {
    it('should report isActive based on class', () => {
      const { anchor, behavior } = createLink('/');
      behavior.connectedCallback?.();

      // happy-dom starts at "/" so this should be active
      expect(behavior.isActive).toBe(true);
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('should not be active for non-matching path', () => {
      const { behavior } = createLink('/some-other-path');
      behavior.connectedCallback?.();

      expect(behavior.isActive).toBe(false);
    });
  });

  describe('disconnectedCallback', () => {
    it('should remove event listeners', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');

      const { anchor, behavior } = createLink('/about');
      behavior.connectedCallback?.();
      behavior.disconnectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true, button: 0 });
      anchor.dispatchEvent(event);

      expect(pushStateSpy).not.toHaveBeenCalled();
      pushStateSpy.mockRestore();
    });
  });
});
