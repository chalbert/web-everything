/**
 * @file CustomAttribute.test.ts
 * @description Unit tests for CustomAttribute base class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CustomAttribute, { type CustomAttributeOptions } from '../../CustomAttribute';

describe('CustomAttribute', () => {
  class TestAttribute extends CustomAttribute {
    static observedAttributes = ['data-value'];
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
      this.callbackLog.push(`changed:${name}:${oldValue}:${newValue}`);
    }
  }

  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
  });

  describe('Construction', () => {
    it('should create instance with default options', () => {
      const attr = new TestAttribute();
      
      expect(attr).toBeInstanceOf(CustomAttribute);
      expect(attr.options).toEqual({});
      expect(attr.value).toBe('');
    });

    it('should create instance with name option', () => {
      const attr = new TestAttribute({ name: 'data-tooltip' });
      
      expect(attr.name).toBe('data-tooltip');
    });

    it('should create instance with value option', () => {
      const attr = new TestAttribute({ value: 'test value' });
      
      expect(attr.value).toBe('test value');
    });

    it('should create instance with both name and value', () => {
      const attr = new TestAttribute({ name: 'data-id', value: '123' });
      
      expect(attr.name).toBe('data-id');
      expect(attr.value).toBe('123');
    });

    it('should set up Attr prototype chain', () => {
      const attr = new TestAttribute();
      
      // Check that prototype chain includes Attr
      let proto = Object.getPrototypeOf(attr);
      let foundAttr = false;
      
      while (proto && proto !== Object.prototype) {
        if (proto === Attr.prototype) {
          foundAttr = true;
          break;
        }
        proto = Object.getPrototypeOf(proto);
      }
      
      expect(foundAttr).toBe(true);
    });
  });

  describe('Value property', () => {
    it('should get and set value', () => {
      const attr = new TestAttribute();
      
      expect(attr.value).toBe('');
      
      attr.value = 'new value';
      expect(attr.value).toBe('new value');
    });

    it('should sync value to target element when attached', () => {
      const attr = new TestAttribute({ name: 'data-test' });
      attr.attach(element);
      
      attr.value = 'synced value';
      
      expect(element.getAttribute('data-test')).toBe('synced value');
    });

    it('should not sync value when not attached', () => {
      const attr = new TestAttribute({ name: 'data-test' });
      
      attr.value = 'unsynced';
      
      expect(element.hasAttribute('data-test')).toBe(false);
    });

    it('should handle undefined localName gracefully', () => {
      const attr = new TestAttribute();
      // localName will be [[undetermined]] without target
      
      attr.value = 'test';
      
      // Should not throw, just not sync
      expect(attr.value).toBe('test');
    });
  });

  describe('Name property', () => {
    it('should set name on construction', () => {
      const attr = new TestAttribute({ name: 'custom-name' });
      
      expect(attr.name).toBe('custom-name');
    });

    it('should allow setting name after construction', () => {
      const attr = new TestAttribute();
      
      attr.name = 'new-name';
      
      expect(attr.name).toBe('new-name');
    });

    it('should return name or localName', () => {
      const attr = new TestAttribute({ name: 'explicit-name' });
      
      expect(attr.name).toBe('explicit-name');
    });
  });

  describe('Target property', () => {
    it('should return undefined when not attached', () => {
      const attr = new TestAttribute();
      
      expect(attr.target).toBeUndefined();
    });

    it('should return target element when attached', () => {
      const attr = new TestAttribute();
      attr.attach(element);
      
      expect(attr.target).toBe(element);
    });
  });

  describe('attach() method', () => {
    it('should attach to target element', () => {
      const attr = new TestAttribute();
      
      attr.attach(element);
      
      expect(attr.target).toBe(element);
    });

    it('should call attachedCallback', () => {
      const attr = new TestAttribute();
      
      attr.attach(element);
      
      expect(attr.callbackLog).toContain('attached');
    });

    it('should register attribute with element', () => {
      const attr = new TestAttribute();
      
      attr.attach(element);
      
      const attached = CustomAttribute.getAttachedAttributes(element);
      expect(attached).toContain(attr);
    });

    it('should handle multiple attributes on same element', () => {
      const attr1 = new TestAttribute();
      const attr2 = new TestAttribute();
      
      attr1.attach(element);
      attr2.attach(element);
      
      const attached = CustomAttribute.getAttachedAttributes(element);
      expect(attached).toHaveLength(2);
      expect(attached).toContain(attr1);
      expect(attached).toContain(attr2);
    });
  });

  describe('detach() method', () => {
    it('should detach from target element', () => {
      const attr = new TestAttribute();
      attr.attach(element);
      
      attr.detach();
      
      expect(attr.target).toBeUndefined();
    });

    it('should unregister from element', () => {
      const attr = new TestAttribute();
      attr.attach(element);
      
      attr.detach();
      
      const attached = CustomAttribute.getAttachedAttributes(element);
      expect(attached).not.toContain(attr);
    });

    it('should handle detach when not attached', () => {
      const attr = new TestAttribute();
      
      // Should not throw
      expect(() => attr.detach()).not.toThrow();
    });
  });

  describe('localName property', () => {
    it('should return [[undetermined]] when no target', () => {
      const attr = new TestAttribute();
      
      expect(attr.localName).toBe('[[undetermined]]');
    });

    it('should return [[undetermined]] when target but no registry', () => {
      const attr = new TestAttribute();
      attr.attach(element);
      
      // Without a registry providing the name, should be undetermined
      expect(attr.localName).toBe('[[undetermined]]');
    });
  });

  describe('Static methods', () => {
    it('should push and drop ref', () => {
      const ref = TestAttribute.pushRef();
      
      expect(typeof ref).toBe('symbol');
      
      const Attribute = CustomAttribute.dropRef(ref);
      expect(Attribute).toBe(TestAttribute);
    });

    it('should return undefined for unknown ref', () => {
      const unknownRef = Symbol('unknown');
      
      const Attribute = CustomAttribute.dropRef(unknownRef);
      
      expect(Attribute).toBeUndefined();
    });

    it('should convert to symbol via toString', () => {
      const ref = TestAttribute.toString();
      
      expect(typeof ref).toBe('symbol');
      
      const Attribute = CustomAttribute.dropRef(ref);
      expect(Attribute).toBe(TestAttribute);
    });

    it('should create unique refs', () => {
      const ref1 = TestAttribute.pushRef();
      const ref2 = TestAttribute.pushRef();
      
      expect(ref1).not.toBe(ref2);
      
      // Clean up
      CustomAttribute.dropRef(ref1);
      CustomAttribute.dropRef(ref2);
    });
  });

  describe('Static observedAttributes', () => {
    it('should define observed attributes', () => {
      expect(TestAttribute.observedAttributes).toEqual(['data-value']);
    });

    it('should allow undefined observed attributes', () => {
      class SimpleAttribute extends CustomAttribute {}
      
      expect(SimpleAttribute.observedAttributes).toBeUndefined();
    });
  });

  describe('Static formAssociated', () => {
    it('should allow formAssociated flag', () => {
      class FormAttribute extends CustomAttribute {
        static formAssociated = true;
      }
      
      expect(FormAttribute.formAssociated).toBe(true);
    });
  });

  describe('isConnected property', () => {
    it('should default to false', () => {
      const attr = new TestAttribute();
      
      expect(attr.isConnected).toBe(false);
    });

    it('should be settable', () => {
      const attr = new TestAttribute();
      
      attr.isConnected = true;
      
      expect(attr.isConnected).toBe(true);
    });
  });

  describe('getAttachedAttributes()', () => {
    it('should return empty array for element with no attributes', () => {
      const attached = CustomAttribute.getAttachedAttributes(element);
      
      expect(attached).toEqual([]);
    });

    it('should return all attached attributes', () => {
      const attr1 = new TestAttribute();
      const attr2 = new TestAttribute();
      
      attr1.attach(element);
      attr2.attach(element);
      
      const attached = CustomAttribute.getAttachedAttributes(element);
      
      expect(attached).toHaveLength(2);
      expect(attached).toEqual([attr1, attr2]);
    });
  });
});
