/**
 * @file CustomAttributeRegistry.test.ts
 * @description Unit tests for CustomAttributeRegistry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CustomAttributeRegistry from '../../CustomAttributeRegistry';
import CustomAttribute from '../../CustomAttribute';

describe('CustomAttributeRegistry', () => {
  class TooltipAttribute extends CustomAttribute {
    static observedAttributes = ['tooltip'];
    callbackLog: string[] = [];

    attachedCallback() {
      this.callbackLog.push('attached');
    }

    detachedCallback() {
      this.callbackLog.push('detached');
    }

    connectedCallback() {
      this.callbackLog.push('connected');
    }

    disconnectedCallback() {
      this.callbackLog.push('disconnected');
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
      this.callbackLog.push(`${name}:${oldValue}->${newValue}`);
    }
  }

  class ClickableAttribute extends CustomAttribute {
    clickCount = 0;

    attachedCallback() {
      this.target?.addEventListener('click', this.handleClick);
    }

    detachedCallback() {
      this.target?.removeEventListener('click', this.handleClick);
    }

    handleClick = () => {
      this.clickCount++;
    };
  }

  let registry: CustomAttributeRegistry;
  let container: HTMLDivElement;

  beforeEach(() => {
    registry = new CustomAttributeRegistry();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    registry.downgrade(container);
    container.remove();
  });

  describe('Construction', () => {
    it('should create registry instance', () => {
      expect(registry).toBeInstanceOf(CustomAttributeRegistry);
    });

    it('should have localName set to customAttributes', () => {
      expect(registry.localName).toBe('customAttributes');
    });
  });

  describe('define()', () => {
    it('should register custom attribute', () => {
      registry.define('tooltip', TooltipAttribute);
      
      const definition = registry.getDefinition('tooltip');
      expect(definition).toBeDefined();
      expect(definition?.constructor).toBe(TooltipAttribute);
    });

    it('should register with tag name restrictions', () => {
      registry.define('clickable', ClickableAttribute, { tagNames: ['button', 'a'] });
      
      const definition = registry.getDefinition('clickable');
      expect(definition?.tagNames).toEqual(new Set(['button', 'a']));
    });

    it('should normalize tag names to lowercase', () => {
      registry.define('clickable', ClickableAttribute, { tagNames: ['BUTTON', 'DIV'] });
      
      const definition = registry.getDefinition('clickable');
      expect(definition?.tagNames).toEqual(new Set(['button', 'div']));
    });

    it('should store observed attributes', () => {
      registry.define('tooltip', TooltipAttribute);
      
      const definition = registry.getDefinition('tooltip');
      expect(definition?.observedAttributes).toEqual(new Set(['tooltip']));
    });

    it('should store lifecycle callbacks', () => {
      registry.define('tooltip', TooltipAttribute);
      
      const definition = registry.getDefinition('tooltip');
      expect(definition?.connectedCallback).toBeDefined();
      expect(definition?.disconnectedCallback).toBeDefined();
    });
  });

  describe('upgrade()', () => {
    it('should activate attributes on existing elements', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help text"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeInstanceOf(TooltipAttribute);
    });

    it('should call attachedCallback', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      expect(instance.callbackLog).toContain('attached');
    });

    it('should call connectedCallback for connected elements', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      expect(instance.callbackLog).toContain('connected');
      expect(instance.isConnected).toBe(true);
    });

    it('should handle multiple elements', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = `
        <div tooltip="First"></div>
        <span tooltip="Second"></span>
        <p tooltip="Third"></p>
      `;
      
      registry.upgrade(container);
      
      const elements = container.querySelectorAll('[tooltip]');
      expect(elements).toHaveLength(3);
      
      elements.forEach((el) => {
        const instance = registry.getInstance(el as HTMLElement, TooltipAttribute);
        expect(instance).toBeInstanceOf(TooltipAttribute);
      });
    });

    it('should respect tag name restrictions', () => {
      registry.define('clickable', ClickableAttribute, { tagNames: ['button'] });
      
      container.innerHTML = `
        <button clickable>Button</button>
        <div clickable>Div</div>
      `;
      
      registry.upgrade(container);
      
      const button = container.querySelector('button') as HTMLElement;
      const div = container.querySelector('div') as HTMLElement;
      
      expect(registry.getInstance(button, ClickableAttribute)).toBeDefined();
      expect(registry.getInstance(div, ClickableAttribute)).toBeUndefined();
    });

    it('should handle nested elements', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = `
        <div tooltip="Parent">
          <span tooltip="Child">
            <a tooltip="Nested"></a>
          </span>
        </div>
      `;
      
      registry.upgrade(container);
      
      const tooltips = container.querySelectorAll('[tooltip]');
      expect(tooltips).toHaveLength(3);
      
      tooltips.forEach((el) => {
        expect(registry.getInstance(el as HTMLElement, TooltipAttribute)).toBeDefined();
      });
    });
  });

  describe('downgrade()', () => {
    it('should deactivate attributes', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      registry.downgrade(container);
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeUndefined();
    });

    it('should call detachedCallback', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      
      registry.downgrade(container);
      
      expect(instance.callbackLog).toContain('detached');
    });

    it('should call disconnectedCallback', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Help"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      
      registry.downgrade(container);
      
      expect(instance.callbackLog).toContain('disconnected');
      expect(instance.isConnected).toBe(false);
    });
  });

  describe('MutationObserver behavior', () => {
    it('should observe attribute additions', async () => {
      registry.define('tooltip', TooltipAttribute);
      registry.upgrade(container);
      
      const element = document.createElement('div');
      container.appendChild(element);
      
      // Wait for MutationObserver to process
      await new Promise(resolve => setTimeout(resolve, 10));
      
      element.setAttribute('tooltip', 'Added');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeDefined();
    });

    it('should observe attribute removals', async () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Remove me"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      element.removeAttribute('tooltip');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeUndefined();
    });

    it('should observe attribute changes', async () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Initial"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      
      element.setAttribute('tooltip', 'Changed');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(instance.callbackLog).toContain('tooltip:Initial->Changed');
    });

    it('should observe element additions', async () => {
      registry.define('tooltip', TooltipAttribute);
      registry.upgrade(container);
      
      const newElement = document.createElement('div');
      newElement.setAttribute('tooltip', 'New');
      
      container.appendChild(newElement);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const instance = registry.getInstance(newElement, TooltipAttribute);
      expect(instance).toBeInstanceOf(TooltipAttribute);
    });

    it('should observe element removals', async () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Remove me"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      const instance = registry.getInstance(element, TooltipAttribute) as TooltipAttribute;
      
      element.remove();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(instance.callbackLog).toContain('detached');
    });
  });

  describe('getInstance()', () => {
    it('should return attribute instance', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Test"></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeInstanceOf(TooltipAttribute);
    });

    it('should return undefined for non-existent instance', () => {
      const element = document.createElement('div');
      
      const instance = registry.getInstance(element, TooltipAttribute);
      expect(instance).toBeUndefined();
    });
  });

  describe('getInstances()', () => {
    it('should return map of all attribute instances', () => {
      registry.define('tooltip', TooltipAttribute);
      registry.define('clickable', ClickableAttribute);
      
      container.innerHTML = '<div tooltip="Test" clickable></div>';
      const element = container.firstElementChild as HTMLElement;
      
      registry.upgrade(container);
      
      const instances = registry.getInstances(element);
      expect(instances).toBeInstanceOf(Map);
      expect(instances?.size).toBe(2);
    });

    it('should return undefined for element with no instances', () => {
      const element = document.createElement('div');
      
      const instances = registry.getInstances(element);
      expect(instances).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle elements without attributes', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div></div><span></span>';
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should handle empty container', () => {
      registry.define('tooltip', TooltipAttribute);
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });

    it('should handle multiple upgrades', () => {
      registry.define('tooltip', TooltipAttribute);
      
      container.innerHTML = '<div tooltip="Test"></div>';
      
      registry.upgrade(container);
      registry.upgrade(container);
      
      const element = container.firstElementChild as HTMLElement;
      const instances = registry.getInstances(element);
      
      // Should not duplicate instances
      expect(instances?.size).toBe(1);
    });

    it('should handle unregistered attributes', () => {
      container.innerHTML = '<div unknown-attr="value"></div>';
      
      expect(() => registry.upgrade(container)).not.toThrow();
    });
  });
});
