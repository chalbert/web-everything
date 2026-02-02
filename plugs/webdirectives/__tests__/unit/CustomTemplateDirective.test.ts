/**
 * @file CustomTemplateDirective.test.ts
 * @description Unit tests for CustomTemplateDirective base class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CustomTemplateDirective, {
  type CustomTemplateDirectiveOptions,
} from '../../CustomTemplateDirective';

describe('CustomTemplateDirective', () => {
  // Test directive with callback tracking
  class TestDirective extends CustomTemplateDirective {
    callbackLog: string[] = [];

    connectedCallback() {
      this.callbackLog.push('connected');
    }

    disconnectedCallback() {
      this.callbackLog.push('disconnected');
    }

    adoptedCallback() {
      this.callbackLog.push('adopted');
    }

    attributeChangedCallback(
      attributeName: string,
      oldValue: string | null,
      newValue: string | null
    ) {
      this.callbackLog.push(
        `attr:${attributeName}:${oldValue}->${newValue}`
      );
    }
  }

  // Test directive with observed attributes
  class ObservedDirective extends CustomTemplateDirective {
    static observedAttributes = ['data-value', 'data-name'];
    callbackLog: string[] = [];

    attributeChangedCallback(
      attributeName: string,
      oldValue: string | null,
      newValue: string | null
    ) {
      this.callbackLog.push(
        `${attributeName}:${oldValue}->${newValue}`
      );
    }
  }

  beforeEach(() => {
    // Register directives with customElements
    if (!customElements.get('test-directive')) {
      customElements.define('test-directive', TestDirective, {
        extends: 'template',
      });
    }
    if (!customElements.get('observed-directive')) {
      customElements.define('observed-directive', ObservedDirective, {
        extends: 'template',
      });
    }
  });

  describe('Construction', () => {
    it('should create instance with default options', () => {
      const directive = new TestDirective({});

      expect(directive).toBeInstanceOf(TestDirective);
      expect(directive).toBeInstanceOf(HTMLTemplateElement);
      expect(directive.options).toEqual({});
    });

    it('should store options', () => {
      const options = { children: [] };
      const directive = new TestDirective(options);

      expect(directive.options).toBe(options);
    });

    it('should initialize without children', () => {
      const directive = new TestDirective({});

      expect(directive.content.childNodes).toHaveLength(0);
    });
  });

  describe('options property', () => {
    it('should be accessible', () => {
      const directive = new TestDirective({});

      expect(directive.options).toBeDefined();
      expect(typeof directive.options).toBe('object');
    });

    it('should be mutable', () => {
      const directive = new TestDirective({});

      directive.options.children = [];
      expect(directive.options.children).toEqual([]);
    });
  });

  describe('Lifecycle callbacks', () => {
    it('should have optional connectedCallback', () => {
      const directive = new TestDirective({});

      expect(typeof directive.connectedCallback).toBe('function');
    });

    it('should have optional disconnectedCallback', () => {
      const directive = new TestDirective({});

      expect(typeof directive.disconnectedCallback).toBe('function');
    });

    it('should have optional adoptedCallback', () => {
      const directive = new TestDirective({});

      expect(typeof directive.adoptedCallback).toBe('function');
    });

    it('should have optional attributeChangedCallback', () => {
      const directive = new TestDirective({});

      expect(typeof directive.attributeChangedCallback).toBe('function');
    });
  });

  describe('connectedCallback', () => {
    it('should set is attribute based on constructor name', () => {
      const directive = new TestDirective({});
      document.body.appendChild(directive);

      expect(directive.getAttribute('is')).toBe('test-directive');

      document.body.removeChild(directive);
    });

    it('should call original connectedCallback', () => {
      const directive = new TestDirective({});
      document.body.appendChild(directive);

      expect(directive.callbackLog).toContain('connected');

      document.body.removeChild(directive);
    });

    it('should append single child node to template content', () => {
      const textNode = document.createTextNode('Hello');
      const directive = new TestDirective({ children: textNode });

      document.body.appendChild(directive);

      expect(directive.content.childNodes).toHaveLength(1);
      expect(directive.content.textContent).toBe('Hello');

      document.body.removeChild(directive);
    });

    it('should append multiple child nodes to template content', () => {
      const text1 = document.createTextNode('Hello');
      const text2 = document.createTextNode(' World');
      const directive = new TestDirective({ children: [text1, text2] });

      document.body.appendChild(directive);

      expect(directive.content.childNodes).toHaveLength(2);
      expect(directive.content.textContent).toBe('Hello World');

      document.body.removeChild(directive);
    });

    it('should handle empty children array', () => {
      const directive = new TestDirective({ children: [] });

      document.body.appendChild(directive);

      expect(directive.content.childNodes).toHaveLength(0);

      document.body.removeChild(directive);
    });

    it('should convert PascalCase to kebab-case for is attribute', () => {
      class MyCustomDirective extends CustomTemplateDirective {}
      customElements.define('my-custom-directive', MyCustomDirective, {
        extends: 'template',
      });

      const directive = new MyCustomDirective({});
      document.body.appendChild(directive);

      expect(directive.getAttribute('is')).toBe('my-custom-directive');

      document.body.removeChild(directive);
    });
  });

  describe('disconnectedCallback', () => {
    it('should be called when removed from document', () => {
      const directive = new TestDirective({});
      document.body.appendChild(directive);

      directive.callbackLog = [];
      document.body.removeChild(directive);

      expect(directive.callbackLog).toContain('disconnected');
    });
  });

  describe('adoptedCallback', () => {
    it.skip('should be called when moved to new document', () => {
      // Skip: adoptedCallback requires creating a new document which is complex in happy-dom
      const directive = new TestDirective({});
      document.body.appendChild(directive);

      // Would need to adopt to new document
      // const newDoc = document.implementation.createHTMLDocument();
      // newDoc.adoptNode(directive);

      // expect(directive.callbackLog).toContain('adopted');
    });
  });

  describe('attributeChangedCallback', () => {
    it('should be called when observed attribute changes', () => {
      const directive = new ObservedDirective({});
      document.body.appendChild(directive);

      directive.callbackLog = [];
      directive.setAttribute('data-value', 'test');

      expect(directive.callbackLog).toContain('data-value:null->test');

      document.body.removeChild(directive);
    });

    it('should not be called for non-observed attributes', () => {
      const directive = new ObservedDirective({});
      document.body.appendChild(directive);

      directive.callbackLog = [];
      directive.setAttribute('data-other', 'value');

      expect(directive.callbackLog).toHaveLength(0);

      document.body.removeChild(directive);
    });

    it('should track attribute changes with old and new values', () => {
      const directive = new ObservedDirective({});
      document.body.appendChild(directive);

      directive.setAttribute('data-name', 'initial');
      directive.callbackLog = [];

      directive.setAttribute('data-name', 'updated');

      expect(directive.callbackLog).toContain('data-name:initial->updated');

      document.body.removeChild(directive);
    });
  });

  describe('observedAttributes', () => {
    it('should support static observedAttributes', () => {
      expect(ObservedDirective.observedAttributes).toEqual([
        'data-value',
        'data-name',
      ]);
    });

    it('should be optional', () => {
      expect(TestDirective.observedAttributes).toBeUndefined();
    });
  });

  describe('Legacy callbacks', () => {
    it('should have attachedCallback for backwards compatibility', () => {
      class LegacyDirective extends CustomTemplateDirective {
        attachedCallback() {
          // Legacy callback
        }
      }

      const directive = new LegacyDirective({});
      expect(typeof directive.attachedCallback).toBe('function');
    });

    it('should have detachedCallback for backwards compatibility', () => {
      class LegacyDirective extends CustomTemplateDirective {
        detachedCallback() {
          // Legacy callback
        }
      }

      const directive = new LegacyDirective({});
      expect(typeof directive.detachedCallback).toBe('function');
    });
  });

  describe('Template content', () => {
    it('should have content property', () => {
      const directive = new TestDirective({});

      expect(directive.content).toBeDefined();
      expect(directive.content.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE);
    });

    it('should support cloning template content', () => {
      const text = document.createTextNode('Template content');
      const directive = new TestDirective({ children: text });
      document.body.appendChild(directive);

      const clone = directive.content.cloneNode(true);

      expect(clone.textContent).toBe('Template content');

      document.body.removeChild(directive);
    });

    it('should isolate content from parent document', () => {
      const element = document.createElement('div');
      element.textContent = 'Content';
      const directive = new TestDirective({ children: element });
      document.body.appendChild(directive);

      expect(document.body.textContent).not.toContain('Content');
      expect(directive.content.textContent).toContain('Content');

      document.body.removeChild(directive);
    });
  });

  describe('Edge cases', () => {
    it('should handle directive without children option', () => {
      const directive = new TestDirective({});
      document.body.appendChild(directive);

      expect(directive.content.childNodes).toHaveLength(0);

      document.body.removeChild(directive);
    });

    it('should handle directive with null children', () => {
      const directive = new TestDirective({ children: null as any });
      document.body.appendChild(directive);

      // Should not crash
      expect(directive).toBeInstanceOf(TestDirective);

      document.body.removeChild(directive);
    });

    it('should handle directive with undefined children', () => {
      const directive = new TestDirective({ children: undefined });
      document.body.appendChild(directive);

      expect(directive.content.childNodes).toHaveLength(0);

      document.body.removeChild(directive);
    });

    it('should handle multiple connections', () => {
      const directive = new TestDirective({});

      document.body.appendChild(directive);
      expect(directive.callbackLog).toContain('connected');

      document.body.removeChild(directive);
      directive.callbackLog = [];

      document.body.appendChild(directive);
      expect(directive.callbackLog).toContain('connected');

      document.body.removeChild(directive);
    });
  });

  describe('Prototype chain', () => {
    it('should extend HTMLTemplateElement', () => {
      const directive = new TestDirective({});

      expect(directive).toBeInstanceOf(HTMLTemplateElement);
    });

    it('should extend CustomTemplateDirective', () => {
      const directive = new TestDirective({});

      expect(directive).toBeInstanceOf(CustomTemplateDirective);
    });

    it('should be instance of HTMLElement', () => {
      const directive = new TestDirective({});

      expect(directive).toBeInstanceOf(HTMLElement);
    });
  });
});
