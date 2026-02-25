/**
 * Integration tests for the Navigation block.
 *
 * Tests NavListBehavior + NavSectionBehavior + RouteLinkBehavior working
 * together in a sidebar navigation pattern with:
 * - Roving tabindex across links and section triggers
 * - Disclosure sections expanding/collapsing
 * - aria-current tracking after route changes
 *
 * Uses happy-dom (History API fallback path).
 */

import 'urlpattern-polyfill';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import NavListBehavior from '../../navigation/NavListBehavior';
import NavSectionBehavior from '../../navigation/NavSectionBehavior';
import RouteLinkBehavior from '../../router/behaviors/RouteLinkBehavior';
import RouteViewElement from '../../router/elements/RouteViewElement';
import CustomAttributeRegistry from '../../../plugs/webbehaviors/CustomAttributeRegistry';

// Register custom elements once
if (!customElements.get('route-view')) {
  customElements.define('route-view', RouteViewElement);
}

describe('Navigation integration', () => {
  let attributes: CustomAttributeRegistry;

  beforeEach(() => {
    document.body.innerHTML = '';
    attributes = new CustomAttributeRegistry();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * Build a sidebar nav matching the navigation demo pattern.
   * Returns all elements and behaviors for testing.
   */
  function createSidebarNav(): {
    nav: HTMLElement;
    links: HTMLAnchorElement[];
    linkBehaviors: RouteLinkBehavior[];
    catalogTrigger: HTMLButtonElement;
    catalogSection: NavSectionBehavior;
    adminTrigger: HTMLButtonElement;
    adminSection: NavSectionBehavior;
    navList: NavListBehavior;
  } {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Main');
    nav.innerHTML = `
      <ul>
        <li><a href="/">Dashboard</a></li>
      </ul>
      <button id="catalog-trigger">Catalog</button>
      <ul id="catalog-items">
        <li><a href="/apps">Applications</a></li>
        <li><a href="/libraries">Libraries</a></li>
      </ul>
      <button id="admin-trigger">Admin</button>
      <ul id="admin-items" hidden>
        <li><a href="/users">Users</a></li>
        <li><a href="/settings">Settings</a></li>
      </ul>
    `;
    document.body.appendChild(nav);

    const links = Array.from(nav.querySelectorAll('a')) as HTMLAnchorElement[];

    // Attach RouteLinkBehavior to each link
    const linkBehaviors = links.map((anchor) => {
      const href = anchor.getAttribute('href')!;
      const behavior = new RouteLinkBehavior({
        name: 'route:link',
        value: href,
      });
      behavior.attach(anchor);
      behavior.isConnected = true;
      behavior.connectedCallback?.();
      return behavior;
    });

    // Attach NavSectionBehavior to section triggers
    const catalogTrigger = nav.querySelector(
      '#catalog-trigger',
    )! as HTMLButtonElement;
    const catalogSection = new NavSectionBehavior({
      name: 'nav:section',
      value: '#catalog-items',
    });
    catalogSection.attach(catalogTrigger);
    catalogSection.isConnected = true;
    catalogSection.connectedCallback?.();

    const adminTrigger = nav.querySelector(
      '#admin-trigger',
    )! as HTMLButtonElement;
    const adminSection = new NavSectionBehavior({
      name: 'nav:section',
      value: '#admin-items',
    });
    adminSection.attach(adminTrigger);
    adminSection.isConnected = true;
    adminSection.connectedCallback?.();

    // Attach NavListBehavior to the nav element
    const navList = new NavListBehavior({ name: 'nav:list' });
    navList.attach(nav);
    navList.isConnected = true;
    navList.connectedCallback?.();

    return {
      nav,
      links,
      linkBehaviors,
      catalogTrigger,
      catalogSection,
      adminTrigger,
      adminSection,
      navList,
    };
  }

  describe('roving tabindex across navigation', () => {
    it('should set tabindex on visible links and section triggers', () => {
      const { navList } = createSidebarNav();

      // Dashboard + catalog trigger + 2 catalog links = 4 visible items
      // (admin trigger is also visible, admin links are hidden)
      // Total visible: Dashboard, catalog trigger, Apps, Libraries, admin trigger = 5
      expect(navList.items.length).toBeGreaterThanOrEqual(3);

      // First item (Dashboard) should have tabindex=0
      expect(navList.items[0].getAttribute('tabindex')).toBe('0');

      // Other items should have tabindex=-1
      for (let i = 1; i < navList.items.length; i++) {
        expect(navList.items[i].getAttribute('tabindex')).toBe('-1');
      }
    });

    it('should focus aria-current item when present', () => {
      // happy-dom starts at "/" so Dashboard should be active
      const { links, navList } = createSidebarNav();

      // Dashboard link should have aria-current="page" (set by RouteLinkBehavior)
      expect(links[0].getAttribute('aria-current')).toBe('page');

      // NavListBehavior should pick this as the active item
      const activeItem = navList.items[navList.currentIndex];
      expect(activeItem).toBe(links[0]);
    });
  });

  describe('section disclosure + nav list interaction', () => {
    it('should expand admin section and discover new items on keydown', () => {
      const { nav, adminSection, navList } = createSidebarNav();
      const initialCount = navList.items.length;

      // Expand admin section
      adminSection.expand();
      expect(adminSection.isExpanded).toBe(true);

      // Arrow navigation should re-discover items including the newly visible ones
      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );

      // After re-discovery, there should be more items
      expect(navList.items.length).toBeGreaterThan(initialCount);
    });

    it('should collapse section and lose items on next keydown', () => {
      const { nav, catalogSection, navList } = createSidebarNav();
      const initialCount = navList.items.length;

      // Collapse catalog section
      catalogSection.collapse();
      expect(catalogSection.isExpanded).toBe(false);

      // Arrow navigation should re-discover items without the hidden ones
      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );

      expect(navList.items.length).toBeLessThan(initialCount);
    });
  });

  describe('aria-current tracking with RouteLinkBehavior', () => {
    it('should have aria-current on active link', () => {
      const { links } = createSidebarNav();

      // happy-dom is at "/", so Dashboard should be active
      expect(links[0].getAttribute('aria-current')).toBe('page');

      // Other links should NOT have aria-current
      for (let i = 1; i < links.length; i++) {
        expect(links[i].hasAttribute('aria-current')).toBe(false);
      }
    });
  });

  describe('keyboard navigation through full nav', () => {
    it('should navigate through all visible items with ArrowDown', () => {
      const { nav, navList } = createSidebarNav();
      const totalItems = navList.items.length;

      // Start at index 0
      expect(navList.currentIndex).toBe(0);

      // Press ArrowDown for each item
      for (let i = 1; i < totalItems; i++) {
        nav.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
        expect(navList.currentIndex).toBe(i);
      }

      // One more ArrowDown should wrap to 0
      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      expect(navList.currentIndex).toBe(0);
    });

    it('should jump to last item on End', () => {
      const { nav, navList } = createSidebarNav();

      nav.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );

      expect(navList.currentIndex).toBe(navList.items.length - 1);
    });
  });

  describe('ARIA attributes comprehensive check', () => {
    it('should have correct ARIA on section triggers', () => {
      const { catalogTrigger, adminTrigger } = createSidebarNav();

      // Catalog section is expanded
      expect(catalogTrigger.getAttribute('aria-expanded')).toBe('true');
      expect(catalogTrigger.getAttribute('aria-controls')).toBe(
        'catalog-items',
      );

      // Admin section is collapsed
      expect(adminTrigger.getAttribute('aria-expanded')).toBe('false');
      expect(adminTrigger.getAttribute('aria-controls')).toBe('admin-items');
    });

    it('should have aria-label on nav element', () => {
      const { nav } = createSidebarNav();
      expect(nav.getAttribute('aria-label')).toBe('Main');
    });
  });

  describe('lifecycle cleanup', () => {
    it('should clean up all behaviors without errors', () => {
      const {
        navList,
        catalogSection,
        adminSection,
        linkBehaviors,
      } = createSidebarNav();

      // Disconnect everything — should not throw
      expect(() => {
        linkBehaviors.forEach((b) => b.disconnectedCallback?.());
        catalogSection.disconnectedCallback?.();
        adminSection.disconnectedCallback?.();
        navList.disconnectedCallback?.();
      }).not.toThrow();
    });
  });
});
