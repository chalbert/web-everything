/**
 * Integration tests for the unplugged API with real registries
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  register,
  upgrade,
  downgrade,
  reset,
  hasPlug,
  isUpgraded,
  getPlugs,
} from '../unplugged';
import CustomAttributeRegistry from '../webbehaviors/CustomAttributeRegistry';
import CustomAttribute from '../webbehaviors/CustomAttribute';
import type { Plug } from '../core/Plug';

describe('unplugged integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    reset();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    reset();
    container.remove();
  });

  describe('with CustomAttributeRegistry', () => {
    it('should register and upgrade a real CustomAttributeRegistry', () => {
      const registry = new CustomAttributeRegistry();

      register(registry);

      expect(hasPlug('customAttributes')).toBe(true);
    });

    it('should activate custom attributes on upgrade', () => {
      const attachedCalls: HTMLElement[] = [];

      class TestAttribute extends CustomAttribute {
        attachedCallback() {
          attachedCalls.push(this.target!);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test-attr', TestAttribute);

      container.innerHTML = '<div test-attr="value"></div>';

      register(registry);
      upgrade(document);

      expect(attachedCalls.length).toBeGreaterThanOrEqual(1);
      expect(attachedCalls[0].getAttribute('test-attr')).toBe('value');
    });

    it('should deactivate custom attributes on downgrade', () => {
      const detachedCalls: HTMLElement[] = [];

      class TestAttribute extends CustomAttribute {
        detachedCallback() {
          detachedCalls.push(this.target!);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test-attr', TestAttribute);

      container.innerHTML = '<div test-attr="value"></div>';

      register(registry);
      upgrade(document);
      downgrade(document);

      expect(detachedCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple attributes in single registry', () => {
      const activatedAttrs: string[] = [];

      class AttrA extends CustomAttribute {
        attachedCallback() {
          activatedAttrs.push('attr-a');
        }
      }

      class AttrB extends CustomAttribute {
        attachedCallback() {
          activatedAttrs.push('attr-b');
        }
      }

      // Single registry with multiple attributes
      const registry = new CustomAttributeRegistry();
      registry.define('attr-a', AttrA);
      registry.define('attr-b', AttrB);

      container.innerHTML = '<div attr-a attr-b></div>';

      register(registry);
      upgrade(document);

      expect(activatedAttrs).toContain('attr-a');
      expect(activatedAttrs).toContain('attr-b');
    });

    it('should handle nested elements with attributes', () => {
      const activatedElements: string[] = [];

      class TestAttribute extends CustomAttribute {
        attachedCallback() {
          activatedElements.push(this.target!.id);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test-attr', TestAttribute);

      container.innerHTML = `
        <div id="parent" test-attr>
          <div id="child" test-attr>
            <div id="grandchild" test-attr></div>
          </div>
        </div>
      `;

      register(registry);
      upgrade(document);

      expect(activatedElements).toContain('parent');
      expect(activatedElements).toContain('child');
      expect(activatedElements).toContain('grandchild');
    });
  });

  describe('with multiple different plug types', () => {
    // Create mock plugs with different localNames to test ordering
    class MockPlugA implements Plug {
      localName = 'plugA';
      upgradeOrder: string[];
      downgradeOrder: string[];

      constructor(upgradeOrder: string[], downgradeOrder: string[]) {
        this.upgradeOrder = upgradeOrder;
        this.downgradeOrder = downgradeOrder;
      }

      upgrade(_root: RootNode) {
        this.upgradeOrder.push('plugA');
      }

      downgrade(_root: RootNode) {
        this.downgradeOrder.push('plugA');
      }
    }

    class MockPlugB implements Plug {
      localName = 'plugB';
      upgradeOrder: string[];
      downgradeOrder: string[];

      constructor(upgradeOrder: string[], downgradeOrder: string[]) {
        this.upgradeOrder = upgradeOrder;
        this.downgradeOrder = downgradeOrder;
      }

      upgrade(_root: RootNode) {
        this.upgradeOrder.push('plugB');
      }

      downgrade(_root: RootNode) {
        this.downgradeOrder.push('plugB');
      }
    }

    it('should upgrade multiple plug types in registration order', () => {
      const upgradeOrder: string[] = [];
      const downgradeOrder: string[] = [];

      const plugA = new MockPlugA(upgradeOrder, downgradeOrder);
      const plugB = new MockPlugB(upgradeOrder, downgradeOrder);

      register(plugA);
      register(plugB);
      upgrade(document);

      expect(upgradeOrder).toEqual(['plugA', 'plugB']);
    });

    it('should downgrade multiple plug types in reverse order', () => {
      const upgradeOrder: string[] = [];
      const downgradeOrder: string[] = [];

      const plugA = new MockPlugA(upgradeOrder, downgradeOrder);
      const plugB = new MockPlugB(upgradeOrder, downgradeOrder);

      register(plugA);
      register(plugB);
      upgrade(document);
      downgrade(document);

      expect(downgradeOrder).toEqual(['plugB', 'plugA']);
    });

    it('should track all registered plugs', () => {
      const upgradeOrder: string[] = [];
      const downgradeOrder: string[] = [];

      const plugA = new MockPlugA(upgradeOrder, downgradeOrder);
      const plugB = new MockPlugB(upgradeOrder, downgradeOrder);
      const registry = new CustomAttributeRegistry();

      register(plugA);
      register(plugB);
      register(registry);

      const plugs = getPlugs();
      expect(plugs.length).toBe(3);
      expect(plugs.map(p => p.localName)).toContain('plugA');
      expect(plugs.map(p => p.localName)).toContain('plugB');
      expect(plugs.map(p => p.localName)).toContain('customAttributes');
    });
  });

  describe('shadow DOM support', () => {
    it('should upgrade shadow roots independently', () => {
      const activatedRoots: string[] = [];

      class TestAttribute extends CustomAttribute {
        attachedCallback() {
          const root = this.target!.getRootNode();
          activatedRoots.push(root === document ? 'document' : 'shadow');
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test-attr', TestAttribute);

      // Element in document
      container.innerHTML = '<div test-attr></div>';

      // Element in shadow DOM
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div test-attr></div>';
      container.appendChild(host);

      register(registry);
      upgrade(document);
      upgrade(shadow);

      expect(activatedRoots).toContain('document');
      expect(activatedRoots).toContain('shadow');
    });

    it('should downgrade shadow roots independently', () => {
      const detachedRoots: string[] = [];

      class TestAttribute extends CustomAttribute {
        detachedCallback() {
          const root = this.target!.getRootNode();
          detachedRoots.push(root === document ? 'document' : 'shadow');
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test-attr', TestAttribute);

      container.innerHTML = '<div test-attr></div>';

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div test-attr></div>';
      container.appendChild(host);

      register(registry);
      upgrade(document);
      upgrade(shadow);

      // Only downgrade shadow
      downgrade(shadow);

      expect(detachedRoots).toContain('shadow');
      expect(detachedRoots).not.toContain('document');
    });
  });

  describe('lifecycle tracking', () => {
    it('should track upgrade state correctly', () => {
      const registry = new CustomAttributeRegistry();
      register(registry);

      expect(isUpgraded(document)).toBe(false);

      upgrade(document);
      expect(isUpgraded(document)).toBe(true);

      downgrade(document);
      expect(isUpgraded(document)).toBe(false);
    });

    it('should track multiple roots independently', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });

      const registry = new CustomAttributeRegistry();
      register(registry);

      upgrade(document);
      expect(isUpgraded(document)).toBe(true);
      expect(isUpgraded(shadow)).toBe(false);

      upgrade(shadow);
      expect(isUpgraded(document)).toBe(true);
      expect(isUpgraded(shadow)).toBe(true);

      downgrade(document);
      expect(isUpgraded(document)).toBe(false);
      expect(isUpgraded(shadow)).toBe(true);
    });
  });

  describe('registry replacement', () => {
    it('should replace registry with same localName', () => {
      const registry1 = new CustomAttributeRegistry();
      const registry2 = new CustomAttributeRegistry();

      register(registry1);
      expect(hasPlug('customAttributes')).toBe(true);

      register(registry2);
      expect(hasPlug('customAttributes')).toBe(true);
      expect(getPlugs().length).toBe(1); // Still only one
    });
  });
});
