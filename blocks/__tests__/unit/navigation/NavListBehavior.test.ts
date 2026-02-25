/**
 * Unit tests for NavListBehavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NavListBehavior from '../../../navigation/NavListBehavior';
import CustomAttribute from '../../../../plugs/webbehaviors/CustomAttribute';

describe('NavListBehavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createNav(options?: {
    orientation?: string;
    activeLink?: string;
    withHiddenSection?: boolean;
  }): {
    nav: HTMLElement;
    links: HTMLAnchorElement[];
    behavior: NavListBehavior;
  } {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Main');
    if (options?.orientation) {
      nav.setAttribute('orientation', options.orientation);
    }

    let html = `
      <ul>
        <li><a href="/">Dashboard</a></li>
        <li><a href="/apps">Applications</a></li>
        <li><a href="/libs">Libraries</a></li>
      </ul>
    `;

    if (options?.withHiddenSection) {
      html += `
        <ul hidden>
          <li><a href="/settings">Settings</a></li>
        </ul>
      `;
    }

    nav.innerHTML = html;
    document.body.appendChild(nav);

    // Set aria-current on active link if specified
    if (options?.activeLink) {
      const active = nav.querySelector(`a[href="${options.activeLink}"]`);
      active?.setAttribute('aria-current', 'page');
    }

    const links = Array.from(nav.querySelectorAll('a')) as HTMLAnchorElement[];
    const behavior = new NavListBehavior({ name: 'nav:list' });
    behavior.attach(nav);
    behavior.isConnected = true;

    return { nav, links, behavior };
  }

  describe('creation', () => {
    it('should extend CustomAttribute', () => {
      const behavior = new NavListBehavior({ name: 'nav:list' });
      expect(behavior).toBeInstanceOf(CustomAttribute);
    });
  });

  describe('roving tabindex', () => {
    it('should set tabindex="0" on first item when no active link', () => {
      const { links, behavior } = createNav();
      behavior.connectedCallback?.();

      expect(links[0].getAttribute('tabindex')).toBe('0');
    });

    it('should set tabindex="-1" on non-current items', () => {
      const { links, behavior } = createNav();
      behavior.connectedCallback?.();

      expect(links[1].getAttribute('tabindex')).toBe('-1');
      expect(links[2].getAttribute('tabindex')).toBe('-1');
    });

    it('should set tabindex="0" on aria-current item', () => {
      const { links, behavior } = createNav({ activeLink: '/apps' });
      behavior.connectedCallback?.();

      expect(links[0].getAttribute('tabindex')).toBe('-1');
      expect(links[1].getAttribute('tabindex')).toBe('0');
      expect(links[2].getAttribute('tabindex')).toBe('-1');
    });

    it('should exclude items inside hidden sections', () => {
      const { behavior } = createNav({ withHiddenSection: true });
      behavior.connectedCallback?.();

      // Should only discover 3 visible items, not the hidden Settings link
      expect(behavior.items).toHaveLength(3);
    });
  });

  describe('keyboard navigation (vertical)', () => {
    it('should move to next item on ArrowDown', () => {
      const { nav, links, behavior } = createNav();
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(links[0].getAttribute('tabindex')).toBe('-1');
      expect(links[1].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(1);
    });

    it('should move to previous item on ArrowUp', () => {
      const { nav, links, behavior } = createNav({ activeLink: '/apps' });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );

      expect(links[0].getAttribute('tabindex')).toBe('0');
      expect(links[1].getAttribute('tabindex')).toBe('-1');
    });

    it('should wrap to last item on ArrowUp from first', () => {
      const { nav, links, behavior } = createNav();
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );

      expect(links[2].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(2);
    });

    it('should wrap to first item on ArrowDown from last', () => {
      const { nav, links, behavior } = createNav({ activeLink: '/libs' });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(links[0].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(0);
    });

    it('should jump to first item on Home', () => {
      const { nav, links, behavior } = createNav({ activeLink: '/libs' });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );

      expect(links[0].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(0);
    });

    it('should jump to last item on End', () => {
      const { nav, links, behavior } = createNav();
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );

      expect(links[2].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(2);
    });

    it('should ignore ArrowLeft/ArrowRight in vertical mode', () => {
      const { nav, behavior } = createNav();
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      expect(behavior.currentIndex).toBe(0);
    });
  });

  describe('keyboard navigation (horizontal)', () => {
    it('should respond to ArrowRight', () => {
      const { nav, links, behavior } = createNav({
        orientation: 'horizontal',
      });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      expect(links[1].getAttribute('tabindex')).toBe('0');
      expect(behavior.currentIndex).toBe(1);
    });

    it('should respond to ArrowLeft', () => {
      const { nav, links, behavior } = createNav({
        orientation: 'horizontal',
        activeLink: '/apps',
      });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );

      expect(links[0].getAttribute('tabindex')).toBe('0');
    });

    it('should ignore ArrowUp/ArrowDown in horizontal mode', () => {
      const { nav, behavior } = createNav({ orientation: 'horizontal' });
      behavior.connectedCallback?.();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(behavior.currentIndex).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should default to vertical orientation', () => {
      const { behavior } = createNav();
      behavior.connectedCallback?.();

      expect(behavior.orientation).toBe('vertical');
    });

    it('should read orientation from attribute', () => {
      const { behavior } = createNav({ orientation: 'horizontal' });
      behavior.connectedCallback?.();

      expect(behavior.orientation).toBe('horizontal');
    });
  });

  describe('public API', () => {
    it('should expose items', () => {
      const { behavior } = createNav();
      behavior.connectedCallback?.();

      expect(behavior.items).toHaveLength(3);
    });

    it('should expose currentIndex', () => {
      const { behavior } = createNav();
      behavior.connectedCallback?.();

      expect(behavior.currentIndex).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('should clean up on disconnect', () => {
      const { nav, behavior } = createNav();
      behavior.connectedCallback?.();

      behavior.disconnectedCallback?.();

      // Arrow key should no longer work after disconnect
      const initialIndex = behavior.currentIndex;
      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      expect(behavior.currentIndex).toBe(initialIndex);
    });
  });
});
