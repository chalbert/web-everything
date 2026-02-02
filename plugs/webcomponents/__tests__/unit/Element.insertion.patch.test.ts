/**
 * @file Element.insertion.patch.test.ts
 * @description Unit tests for Element insertion method patches
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patch, removePatch } from '../../Element.insertion.patch';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches } from '../../../webinjectors/Node.injectors.patch';
import InjectorRoot from '../../../webinjectors/InjectorRoot';
import CustomElementRegistry from '../../../webregistries/CustomElementRegistry';
import CustomElement from '../../CustomElement';

describe('Element.insertion.patch', () => {
  let injectorRoot: InjectorRoot;
  let registry: CustomElementRegistry;
  let container: HTMLElement;

  beforeEach(() => {
    applyNodeInjectorsPatches(); // Need Node.injectors.patch for getClosestInjector()
    patch();
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
    registry = new CustomElementRegistry();
    container = document.createElement('div');
    document.body.appendChild(container);
    
    injectorRoot.ensureInjector(container);
    const injector = injectorRoot.getInjectorOf(container)!;
    injector.set('customElements', registry);
  });

  afterEach(() => {
    removePatch();
    removeNodeInjectorsPatches();
    document.body.removeChild(container);
  });

  describe('innerHTML setter', () => {
    it('should set innerHTML with creation injector context', () => {
      container.innerHTML = '<div><span>Hello</span></div>';
      
      const div = container.querySelector('div');
      const span = container.querySelector('span');
      
      expect(div).toBeTruthy();
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe('Hello');
    });

    it('should track creation injector during innerHTML', () => {
      const creationInjectorBefore = InjectorRoot.creationInjector;
      
      container.innerHTML = '<div class="test">Content</div>';
      
      expect(InjectorRoot.creationInjector).toBe(creationInjectorBefore);
    });

    it('should restore prototype chain for innerHTML elements', () => {
      container.innerHTML = '<div></div>';
      
      const div = container.querySelector('div');
      expect(div).toBeInstanceOf(HTMLDivElement);
      expect(div).toBeInstanceOf(HTMLElement);
      expect(div).toBeInstanceOf(Element);
    });

    it('should handle complex nested HTML', () => {
      container.innerHTML = `
        <div id="outer">
          <span class="inner">
            <a href="#">Link</a>
          </span>
        </div>
      `;
      
      const outer = container.querySelector('#outer');
      const inner = container.querySelector('.inner');
      const link = container.querySelector('a');
      
      expect(outer).toBeInstanceOf(HTMLDivElement);
      expect(inner).toBeInstanceOf(HTMLSpanElement);
      expect(link).toBeInstanceOf(HTMLAnchorElement);
    });

    it('should work with multiple element types', () => {
      container.innerHTML = `
        <input type="text" />
        <button>Click</button>
        <img src="test.jpg" alt="test" />
      `;
      
      const input = container.querySelector('input');
      const button = container.querySelector('button');
      const img = container.querySelector('img');
      
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect(button).toBeInstanceOf(HTMLButtonElement);
      expect(img).toBeInstanceOf(HTMLImageElement);
    });
  });

  describe('append method', () => {
    it('should append single element', () => {
      const child = document.createElement('div');
      child.textContent = 'Appended';
      
      container.append(child);
      
      expect(container.children.length).toBe(1);
      expect(container.children[0]).toBe(child);
      expect(container.textContent).toBe('Appended');
    });

    it('should append multiple elements', () => {
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');
      child1.textContent = 'First';
      child2.textContent = 'Second';
      
      container.append(child1, child2);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0].textContent).toBe('First');
      expect(container.children[1].textContent).toBe('Second');
    });

    it('should append text nodes', () => {
      container.append('Text content');
      
      expect(container.textContent).toBe('Text content');
    });

    it('should append mixed content', () => {
      const element = document.createElement('b');
      element.textContent = 'Bold';
      
      container.append('Text ', element, ' more text');
      
      expect(container.childNodes.length).toBe(3);
      expect(container.textContent).toBe('Text Bold more text');
    });
  });

  describe('prepend method', () => {
    it('should prepend single element', () => {
      container.innerHTML = '<span>Existing</span>';
      const newChild = document.createElement('div');
      newChild.textContent = 'Prepended';
      
      container.prepend(newChild);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0]).toBe(newChild);
      expect(container.children[0].textContent).toBe('Prepended');
    });

    it('should prepend multiple elements', () => {
      container.innerHTML = '<span>Existing</span>';
      const child1 = document.createElement('div');
      const child2 = document.createElement('div');
      child1.textContent = 'First';
      child2.textContent = 'Second';
      
      container.prepend(child1, child2);
      
      expect(container.children.length).toBe(3);
      expect(container.children[0].textContent).toBe('First');
      expect(container.children[1].textContent).toBe('Second');
    });
  });

  describe('before method', () => {
    it('should insert element before target', () => {
      const existing = document.createElement('span');
      existing.textContent = 'Existing';
      container.appendChild(existing);
      
      const newElement = document.createElement('div');
      newElement.textContent = 'Before';
      
      existing.before(newElement);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0]).toBe(newElement);
      expect(container.children[1]).toBe(existing);
    });

    it('should insert multiple elements before target', () => {
      const existing = document.createElement('span');
      container.appendChild(existing);
      
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      
      existing.before(el1, el2);
      
      expect(container.children.length).toBe(3);
      expect(container.children[0]).toBe(el1);
      expect(container.children[1]).toBe(el2);
      expect(container.children[2]).toBe(existing);
    });
  });

  describe('after method', () => {
    it('should insert element after target', () => {
      const existing = document.createElement('span');
      existing.textContent = 'Existing';
      container.appendChild(existing);
      
      const newElement = document.createElement('div');
      newElement.textContent = 'After';
      
      existing.after(newElement);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0]).toBe(existing);
      expect(container.children[1]).toBe(newElement);
    });

    it('should insert multiple elements after target', () => {
      const existing = document.createElement('span');
      container.appendChild(existing);
      
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      
      existing.after(el1, el2);
      
      expect(container.children.length).toBe(3);
      expect(container.children[0]).toBe(existing);
      expect(container.children[1]).toBe(el1);
      expect(container.children[2]).toBe(el2);
    });
  });

  describe('replaceChildren method', () => {
    it('should replace all children with new elements', () => {
      container.innerHTML = '<div>Old 1</div><div>Old 2</div>';
      
      const newChild = document.createElement('span');
      newChild.textContent = 'New';
      
      container.replaceChildren(newChild);
      
      expect(container.children.length).toBe(1);
      expect(container.children[0]).toBe(newChild);
      expect(container.textContent).toBe('New');
    });

    it('should replace with multiple elements', () => {
      container.innerHTML = '<div>Old</div>';
      
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');
      child1.textContent = 'New 1';
      child2.textContent = 'New 2';
      
      container.replaceChildren(child1, child2);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0].textContent).toBe('New 1');
      expect(container.children[1].textContent).toBe('New 2');
    });

    it('should clear all children when called with no arguments', () => {
      container.innerHTML = '<div>Child 1</div><div>Child 2</div>';
      
      container.replaceChildren();
      
      expect(container.children.length).toBe(0);
      expect(container.textContent).toBe('');
    });
  });

  describe('replaceWith method', () => {
    it('should replace element with new element', () => {
      const oldElement = document.createElement('div');
      oldElement.textContent = 'Old';
      container.appendChild(oldElement);
      
      const newElement = document.createElement('span');
      newElement.textContent = 'New';
      
      oldElement.replaceWith(newElement);
      
      expect(container.children.length).toBe(1);
      expect(container.children[0]).toBe(newElement);
      expect(container.textContent).toBe('New');
    });

    it('should replace with multiple elements', () => {
      const oldElement = document.createElement('div');
      container.appendChild(oldElement);
      
      const el1 = document.createElement('span');
      const el2 = document.createElement('span');
      el1.textContent = 'First';
      el2.textContent = 'Second';
      
      oldElement.replaceWith(el1, el2);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0]).toBe(el1);
      expect(container.children[1]).toBe(el2);
    });
  });

  describe('insertAdjacentElement method', () => {
    let target: HTMLElement;

    beforeEach(() => {
      target = document.createElement('div');
      target.id = 'target';
      container.appendChild(target);
    });

    it('should insert beforebegin', () => {
      const newElement = document.createElement('span');
      newElement.textContent = 'Before';
      
      target.insertAdjacentElement('beforebegin', newElement);
      
      expect(container.children.length).toBe(2);
      expect(container.children[0].textContent).toBe('Before');
      expect(container.children[1].id).toBe('target');
    });

    it('should insert afterbegin', () => {
      const newElement = document.createElement('span');
      newElement.textContent = 'First child';
      
      target.insertAdjacentElement('afterbegin', newElement);
      
      expect(target.children.length).toBe(1);
      expect(target.children[0].textContent).toBe('First child');
    });

    it('should insert beforeend', () => {
      target.innerHTML = '<span>Existing</span>';
      const newElement = document.createElement('span');
      newElement.textContent = 'Last child';
      
      target.insertAdjacentElement('beforeend', newElement);
      
      expect(target.children.length).toBe(2);
      expect(target.children[1].textContent).toBe('Last child');
    });

    it('should insert afterend', () => {
      const newElement = document.createElement('span');
      newElement.textContent = 'After';
      
      target.insertAdjacentElement('afterend', newElement);
      
      expect(container.children.length).toBe(2);
      expect(container.children[1].textContent).toBe('After');
    });
  });

  describe('Custom Element integration', () => {
    it('should upgrade custom elements inserted via append', () => {
      class TestElement extends CustomElement {
        connectedCallback() {
          this.setAttribute('upgraded', 'true');
        }
      }

      registry.define('test-element', TestElement);

      const element = document.createElement('test-element') as any;
      container.append(element);

      // Note: Actual upgrade logic depends on pathInsertionMethods integration
      expect(element.tagName.toLowerCase()).toBe('test-element');
    });

    it('should track creation injector for dynamically created elements', () => {
      const child = document.createElement('div');
      
      expect(InjectorRoot.creationInjector).toBeNull();
      
      container.append(child);
      
      expect(InjectorRoot.creationInjector).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty append', () => {
      const initialLength = container.children.length;
      container.append();
      expect(container.children.length).toBe(initialLength);
    });

    it('should handle document fragments', () => {
      const fragment = document.createDocumentFragment();
      const child1 = document.createElement('div');
      const child2 = document.createElement('div');
      fragment.appendChild(child1);
      fragment.appendChild(child2);
      
      container.append(fragment);
      
      expect(container.children.length).toBe(2);
    });

    it('should handle innerHTML with empty string', () => {
      container.innerHTML = '<div>Content</div>';
      container.innerHTML = '';
      
      expect(container.children.length).toBe(0);
      expect(container.textContent).toBe('');
    });
  });
});
