/**
 * Unit tests for NavSectionBehavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NavSectionBehavior from '../../../navigation/NavSectionBehavior';
import CustomAttribute from '../../../../plugs/webbehaviors/CustomAttribute';

describe('NavSectionBehavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createDisclosure(options?: {
    hidden?: boolean;
    useSpan?: boolean;
    noId?: boolean;
  }): {
    trigger: HTMLElement;
    content: HTMLUListElement;
    behavior: NavSectionBehavior;
  } {
    const trigger = options?.useSpan
      ? document.createElement('span')
      : document.createElement('button');
    const content = document.createElement('ul');
    if (!options?.noId) content.id = 'section-items';
    if (options?.hidden) content.setAttribute('hidden', '');
    document.body.appendChild(trigger);
    document.body.appendChild(content);

    const selector = options?.noId ? 'ul' : '#section-items';
    const behavior = new NavSectionBehavior({
      name: 'nav:section',
      value: selector,
    });
    behavior.attach(trigger);
    behavior.isConnected = true;

    return { trigger, content, behavior };
  }

  describe('creation', () => {
    it('should extend CustomAttribute', () => {
      const behavior = new NavSectionBehavior({
        name: 'nav:section',
        value: '#items',
      });
      expect(behavior).toBeInstanceOf(CustomAttribute);
    });
  });

  describe('ARIA setup', () => {
    it('should set aria-controls on trigger', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(trigger.getAttribute('aria-controls')).toBe('section-items');
    });

    it('should set aria-expanded="true" when content is visible', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('should set aria-expanded="false" when content is hidden', () => {
      const { trigger, behavior } = createDisclosure({ hidden: true });
      behavior.connectedCallback?.();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should set role="button" on non-button elements', () => {
      const { trigger, behavior } = createDisclosure({ useSpan: true });
      behavior.connectedCallback?.();

      expect(trigger.getAttribute('role')).toBe('button');
      expect(trigger.getAttribute('tabindex')).toBe('0');
    });

    it('should NOT set role="button" on button elements', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(trigger.hasAttribute('role')).toBe(false);
    });

    it('should generate ID for controlled element without one', () => {
      const { content, behavior } = createDisclosure({ noId: true });
      behavior.connectedCallback?.();

      expect(content.id).toMatch(/^nav-section-\d+$/);
    });
  });

  describe('toggle', () => {
    it('should expand when collapsed', () => {
      const { trigger, content, behavior } = createDisclosure({ hidden: true });
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(false);

      behavior.toggle();

      expect(behavior.isExpanded).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('should collapse when expanded', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);

      behavior.toggle();

      expect(behavior.isExpanded).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('click interaction', () => {
    it('should toggle on click', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);

      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(behavior.isExpanded).toBe(false);
    });
  });

  describe('keyboard interaction', () => {
    it('should toggle on Enter key', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);

      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );

      expect(behavior.isExpanded).toBe(false);
    });

    it('should toggle on Space key', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);

      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      );

      expect(behavior.isExpanded).toBe(false);
    });

    it('should not toggle on other keys', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
      );

      expect(behavior.isExpanded).toBe(true);
    });
  });

  describe('public API', () => {
    it('should expose isExpanded getter', () => {
      const { behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(typeof behavior.isExpanded).toBe('boolean');
    });

    it('should expose controlledElement getter', () => {
      const { content, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.controlledElement).toBe(content);
    });

    it('should expose expand() method', () => {
      const { behavior } = createDisclosure({ hidden: true });
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(false);
      behavior.expand();
      expect(behavior.isExpanded).toBe(true);
    });

    it('should expose collapse() method', () => {
      const { behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);
      behavior.collapse();
      expect(behavior.isExpanded).toBe(false);
    });

    it('expand() should be no-op when already expanded', () => {
      const { behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);
      behavior.expand();
      expect(behavior.isExpanded).toBe(true);
    });

    it('collapse() should be no-op when already collapsed', () => {
      const { behavior } = createDisclosure({ hidden: true });
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(false);
      behavior.collapse();
      expect(behavior.isExpanded).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should clean up event listeners on disconnect', () => {
      const { trigger, behavior } = createDisclosure();
      behavior.connectedCallback?.();

      expect(behavior.isExpanded).toBe(true);

      behavior.disconnectedCallback?.();

      // Click should no longer toggle after disconnect
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(behavior.isExpanded).toBe(true);
    });
  });
});
