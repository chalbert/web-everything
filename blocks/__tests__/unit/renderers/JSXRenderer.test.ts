/**
 * Unit tests for JSX Renderer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jsx, { createElement, Fragment } from '../../../renderers/jsx';

describe('JSXRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createElement', () => {
    describe('string tags', () => {
      it('should create HTML element from string tag', () => {
        const div = jsx.createElement('div', null);
        expect(div).toBeInstanceOf(HTMLDivElement);
      });

      it('should create element with text content', () => {
        const p = jsx.createElement('p', null, 'Hello World');
        expect(p.textContent).toBe('Hello World');
      });

      it('should create element with multiple children', () => {
        const ul = jsx.createElement(
          'ul',
          null,
          jsx.createElement('li', null, 'Item 1'),
          jsx.createElement('li', null, 'Item 2')
        );
        expect(ul.children.length).toBe(2);
        expect(ul.children[0].textContent).toBe('Item 1');
        expect(ul.children[1].textContent).toBe('Item 2');
      });

      it('should handle nested elements', () => {
        const div = jsx.createElement(
          'div',
          null,
          jsx.createElement('span', null, 'Nested')
        );
        expect(div.querySelector('span')?.textContent).toBe('Nested');
      });
    });

    describe('attributes', () => {
      it('should set id attribute', () => {
        const div = jsx.createElement('div', { id: 'test-id' });
        expect(div.id).toBe('test-id');
      });

      it('should set class via className', () => {
        const div = jsx.createElement('div', { className: 'my-class' });
        expect(div.getAttribute('class')).toBe('my-class');
      });

      it('should set for via htmlFor', () => {
        const label = jsx.createElement('label', { htmlFor: 'input-id' });
        expect(label.getAttribute('for')).toBe('input-id');
      });

      it('should set data attributes', () => {
        const div = jsx.createElement('div', { 'data-value': '123' });
        expect(div.getAttribute('data-value')).toBe('123');
      });

      it('should set custom hyphenated attributes', () => {
        const div = jsx.createElement('div', { 'bind-text': 'count' });
        expect(div.getAttribute('bind-text')).toBe('count');
      });

      it('should handle boolean attributes', () => {
        const input = jsx.createElement('input', { disabled: true });
        expect(input.hasAttribute('disabled')).toBe(true);
      });

      it('should not set false boolean attributes', () => {
        const input = jsx.createElement('input', { disabled: false });
        expect(input.hasAttribute('disabled')).toBe(false);
      });

      it('should handle style object', () => {
        const div = jsx.createElement('div', {
          style: { color: 'red', fontSize: '14px' }
        });
        expect(div.style.color).toBe('red');
        expect(div.style.fontSize).toBe('14px');
      });
    });

    describe('event handlers', () => {
      it('should attach onclick handler', () => {
        const handler = vi.fn();
        const button = jsx.createElement('button', { onclick: handler }, 'Click');

        button.click();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should attach multiple event handlers', () => {
        const clickHandler = vi.fn();
        const mouseEnterHandler = vi.fn();

        const div = jsx.createElement('div', {
          onclick: clickHandler,
          onmouseenter: mouseEnterHandler
        });

        div.click();
        div.dispatchEvent(new MouseEvent('mouseenter'));

        expect(clickHandler).toHaveBeenCalledTimes(1);
        expect(mouseEnterHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('children handling', () => {
      it('should flatten nested arrays', () => {
        const items = ['a', 'b', 'c'];
        const ul = jsx.createElement(
          'ul',
          null,
          items.map(item => jsx.createElement('li', null, item))
        );
        expect(ul.children.length).toBe(3);
      });

      it('should filter out null children', () => {
        const div = jsx.createElement('div', null, 'text', null, 'more');
        expect(div.childNodes.length).toBe(2);
      });

      it('should filter out undefined children', () => {
        const div = jsx.createElement('div', null, 'text', undefined, 'more');
        expect(div.childNodes.length).toBe(2);
      });

      it('should filter out false children', () => {
        const div = jsx.createElement('div', null, 'text', false, 'more');
        expect(div.childNodes.length).toBe(2);
      });

      it('should convert numbers to strings', () => {
        const div = jsx.createElement('div', null, 42);
        expect(div.textContent).toBe('42');
      });
    });
  });

  describe('Fragment', () => {
    it('should create DocumentFragment', () => {
      const fragment = jsx.createElement(Fragment, null, 'text');
      // happy-dom has its own DocumentFragment, so check constructor name
      expect(fragment.constructor.name).toBe('DocumentFragment');
    });

    it('should contain children', () => {
      const fragment = jsx.createElement(
        Fragment,
        null,
        jsx.createElement('span', null, 'first'),
        jsx.createElement('span', null, 'second')
      );
      expect(fragment.childNodes.length).toBe(2);
    });

    it('should append to element without wrapper', () => {
      const fragment = jsx.createElement(
        Fragment,
        null,
        jsx.createElement('li', null, 'Item 1'),
        jsx.createElement('li', null, 'Item 2')
      );

      const ul = document.createElement('ul');
      ul.appendChild(fragment);

      expect(ul.children.length).toBe(2);
      expect(ul.children[0].textContent).toBe('Item 1');
    });
  });

  describe('custom element classes', () => {
    it('should instantiate custom element class', () => {
      class MyElement extends HTMLElement {
        greeting = 'Hello';
      }
      customElements.define('my-test-element', MyElement);

      const element = jsx.createElement(MyElement, null);
      expect(element).toBeInstanceOf(MyElement);
      expect((element as MyElement).greeting).toBe('Hello');
    });

    it('should pass props to custom element constructor', () => {
      class PropsElement extends HTMLElement {
        value: number;
        constructor(props?: { value?: number }) {
          super();
          this.value = props?.value ?? 0;
        }
      }
      customElements.define('props-test-element', PropsElement);

      const element = jsx.createElement(PropsElement, { value: 42 });
      expect((element as PropsElement).value).toBe(42);
    });
  });

  describe('named exports', () => {
    it('should export createElement function', () => {
      expect(typeof createElement).toBe('function');
      const div = createElement('div', null, 'test');
      expect(div).toBeInstanceOf(HTMLDivElement);
    });

    it('should export Fragment', () => {
      expect(Fragment).toBe(DocumentFragment);
    });
  });
});
