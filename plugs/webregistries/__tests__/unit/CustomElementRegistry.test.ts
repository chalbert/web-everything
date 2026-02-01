import { describe, it, expect, beforeEach, vi } from 'vitest';
import CustomElementRegistry, { ImplementedElement } from '../../CustomElementRegistry';
import CustomElement from '../../../webcomponents/CustomElement';

describe('CustomElementRegistry', () => {
  let registry: CustomElementRegistry;

  beforeEach(() => {
    registry = new CustomElementRegistry();
  });

  describe('define()', () => {
    it('should define a custom element', () => {
      class TestElement extends CustomElement {
        connectedCallback() {
          // Test callback
        }
      }

      registry.define('test-element', TestElement);
      
      expect(registry.has('test-element')).toBe(true);
      expect(registry.get('test-element')).toBe(TestElement);
    });

    it('should store element definition with metadata', () => {
      class TestElement extends CustomElement {
        static observedAttributes = ['name', 'value'];
        static formAssociated = true;
      }

      registry.define('test-element', TestElement);
      
      const definition = registry.getDefinition('test-element');
      expect(definition).toBeDefined();
      expect(definition?.localName).toBe('test-element');
      expect(definition?.formAssociated).toBe(true);
      expect(definition?.observedAttributes).toBeInstanceOf(Set);
      expect(definition?.observedAttributes?.has('name')).toBe(true);
      expect(definition?.observedAttributes?.has('value')).toBe(true);
    });

    it('should support element definition options (extends)', () => {
      class TestButton extends CustomElement {}

      registry.define('test-button', TestButton, { extends: 'button' });
      
      const definition = registry.getDefinition('test-button');
      expect(definition?.options).toEqual({ extends: 'button' });
    });

    it('should preserve lifecycle callbacks in definition', () => {
      const connectedCallback = vi.fn();
      const disconnectedCallback = vi.fn();
      const adoptedCallback = vi.fn();

      class TestElement extends CustomElement {
        connectedCallback = connectedCallback;
        disconnectedCallback = disconnectedCallback;
        adoptedCallback = adoptedCallback;
      }

      registry.define('test-element', TestElement);
      
      const definition = registry.getDefinition('test-element');
      expect(definition?.connectedCallback).toBe(connectedCallback);
      expect(definition?.disconnectedCallback).toBe(disconnectedCallback);
      expect(definition?.adoptedCallback).toBe(adoptedCallback);
    });

    it('should preserve form-associated callbacks', () => {
      const formAssociatedCallback = vi.fn();
      const formDisabledCallback = vi.fn();
      const formResetCallback = vi.fn();
      const formStateRestoreCallback = vi.fn();

      class TestElement extends CustomElement {
        static formAssociated = true;
        formAssociatedCallback = formAssociatedCallback;
        formDisabledCallback = formDisabledCallback;
        formResetCallback = formResetCallback;
        formStateRestoreCallback = formStateRestoreCallback;
      }

      registry.define('test-element', TestElement);
      
      const definition = registry.getDefinition('test-element');
      expect(definition?.formAssociatedCallback).toBe(formAssociatedCallback);
      expect(definition?.formDisabledCallback).toBe(formDisabledCallback);
      expect(definition?.formResetCallback).toBe(formResetCallback);
      expect(definition?.formStateRestoreCallback).toBe(formStateRestoreCallback);
    });

    it('should preserve attributeChangedCallback', () => {
      const attributeChangedCallback = vi.fn();

      class TestElement extends CustomElement {
        static observedAttributes = ['value'];
        attributeChangedCallback = attributeChangedCallback;
      }

      registry.define('test-element', TestElement);
      
      const definition = registry.getDefinition('test-element');
      expect(definition?.attributeChangedCallback).toBe(attributeChangedCallback);
    });
  });

  describe('get()', () => {
    it('should return constructor for defined elements', () => {
      class TestElement extends CustomElement {}
      registry.define('test-element', TestElement);
      
      expect(registry.get('test-element')).toBe(TestElement);
    });

    it('should return undefined for non-existent elements', () => {
      expect(registry.get('nonexistent-element')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('should return true for defined elements', () => {
      class TestElement extends CustomElement {}
      registry.define('test-element', TestElement);
      
      expect(registry.has('test-element')).toBe(true);
    });

    it('should return false for non-existent elements', () => {
      expect(registry.has('nonexistent-element')).toBe(false);
    });
  });

  describe('getLocalNameOf()', () => {
    it('should return local name for a constructor', () => {
      class TestElement extends CustomElement {}
      registry.define('test-element', TestElement);
      
      expect(registry.getLocalNameOf(TestElement)).toBe('test-element');
    });

    it('should return undefined for unregistered constructors', () => {
      class UnregisteredElement extends CustomElement {}
      
      expect(registry.getLocalNameOf(UnregisteredElement)).toBeUndefined();
    });
  });

  describe('registry inheritance (extends)', () => {
    let parentRegistry: CustomElementRegistry;
    let childRegistry: CustomElementRegistry;

    beforeEach(() => {
      parentRegistry = new CustomElementRegistry();
      childRegistry = new CustomElementRegistry({ extends: [parentRegistry] });
    });

    it('should inherit definitions from parent registry', () => {
      class ParentElement extends CustomElement {}
      parentRegistry.define('parent-element', ParentElement);
      
      expect(childRegistry.has('parent-element')).toBe(true);
      expect(childRegistry.get('parent-element')).toBe(ParentElement);
    });

    it('should allow child to shadow parent definitions', () => {
      class ParentElement extends CustomElement {}
      class ChildElement extends CustomElement {}
      
      parentRegistry.define('shared-element', ParentElement);
      childRegistry.define('shared-element', ChildElement);
      
      expect(childRegistry.get('shared-element')).toBe(ChildElement);
      expect(parentRegistry.get('shared-element')).toBe(ParentElement);
    });

    it('should distinguish own vs inherited with hasOwn()', () => {
      class ParentElement extends CustomElement {}
      class ChildElement extends CustomElement {}
      
      parentRegistry.define('parent-element', ParentElement);
      childRegistry.define('child-element', ChildElement);
      
      expect(childRegistry.hasOwn('parent-element')).toBe(false);
      expect(childRegistry.hasOwn('child-element')).toBe(true);
      expect(childRegistry.has('parent-element')).toBe(true);
      expect(childRegistry.has('child-element')).toBe(true);
    });
  });

  describe('whenDefined()', () => {
    it.skip('should resolve when element is already defined', async () => {
      class TestElement extends CustomElement {}
      registry.define('test-element', TestElement);
      
      const result = await registry.whenDefined('test-element');
      expect(result).toBe(TestElement);
    });

    it('should reject for unimplemented promise (temporary)', async () => {
      await expect(registry.whenDefined('undefined-element')).rejects.toThrow();
    });
  });

  describe('localName property', () => {
    it('should have localName of "customElements"', () => {
      expect(registry.localName).toBe('customElements');
    });
  });

  describe('upgrade() and downgrade()', () => {
    it('should have upgrade method', () => {
      expect(typeof registry.upgrade).toBe('function');
    });

    it('should have downgrade method', () => {
      expect(typeof registry.downgrade).toBe('function');
    });

    // TODO: Add integration tests for upgrade/downgrade when DOM patching is implemented
  });
});
