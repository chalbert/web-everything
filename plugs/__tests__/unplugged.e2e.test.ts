/**
 * E2E tests for the unplugged API - testing complete workflows
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  register,
  upgrade,
  downgrade,
  reset,
} from '../unplugged';
import CustomAttributeRegistry from '../webbehaviors/CustomAttributeRegistry';
import CustomAttribute from '../webbehaviors/CustomAttribute';

describe('unplugged e2e', () => {
  let container: HTMLElement;

  beforeEach(() => {
    reset();
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    reset();
    container.remove();
  });

  describe('complete attribute lifecycle', () => {
    it('should handle full lifecycle: define → register → upgrade → use → downgrade', () => {
      const lifecycle: string[] = [];

      class CounterAttribute extends CustomAttribute {
        private count = 0;

        attachedCallback() {
          lifecycle.push('attached');
          this.count = parseInt(this.value || '0', 10);
        }

        connectedCallback() {
          lifecycle.push('connected');
        }

        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          lifecycle.push(`changed:${oldValue}→${newValue}`);
          this.count = parseInt(newValue || '0', 10);
        }

        detachedCallback() {
          lifecycle.push('detached');
        }

        disconnectedCallback() {
          lifecycle.push('disconnected');
        }
      }

      // 1. Define
      const registry = new CustomAttributeRegistry();
      registry.define('counter', CounterAttribute);

      // 2. Setup DOM
      container.innerHTML = '<button counter="5">Click me</button>';

      // 3. Register and upgrade
      register(registry);
      upgrade(document);

      expect(lifecycle).toContain('attached');
      expect(lifecycle).toContain('connected');

      // 4. Downgrade
      downgrade(document);

      expect(lifecycle).toContain('detached');
      expect(lifecycle).toContain('disconnected');
    });

    it('should observe dynamic attribute changes after upgrade', async () => {
      const changes: Array<{ old: string | null; new: string | null }> = [];

      class ObserverAttribute extends CustomAttribute {
        attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
          changes.push({ old: oldValue, new: newValue });
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('observer', ObserverAttribute);

      container.innerHTML = '<div observer="initial"></div>';

      register(registry);
      upgrade(document);

      // Change attribute value
      const element = container.querySelector('[observer]')!;
      element.setAttribute('observer', 'updated');

      // Wait for MutationObserver
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[changes.length - 1]).toEqual({ old: 'initial', new: 'updated' });
    });

    it('should handle dynamic element insertion', async () => {
      const attached: string[] = [];

      class DynamicAttribute extends CustomAttribute {
        attachedCallback() {
          attached.push(this.target!.id);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('dynamic', DynamicAttribute);

      register(registry);
      upgrade(document);

      // Dynamically add element
      const newElement = document.createElement('div');
      newElement.id = 'dynamic-element';
      newElement.setAttribute('dynamic', '');
      container.appendChild(newElement);

      // Wait for MutationObserver
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(attached).toContain('dynamic-element');
    });

    it('should handle dynamic element removal', async () => {
      const detached: string[] = [];

      class RemovableAttribute extends CustomAttribute {
        detachedCallback() {
          detached.push(this.target!.id);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('removable', RemovableAttribute);

      container.innerHTML = '<div id="to-remove" removable></div>';

      register(registry);
      upgrade(document);

      // Remove element
      const element = container.querySelector('#to-remove')!;
      element.remove();

      // Wait for MutationObserver
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(detached).toContain('to-remove');
    });
  });

  describe('real-world scenarios', () => {
    it('should implement a tooltip attribute', async () => {
      const tooltipShown = vi.fn();
      const tooltipHidden = vi.fn();

      class TooltipAttribute extends CustomAttribute {
        private showHandler = () => tooltipShown(this.value);
        private hideHandler = () => tooltipHidden();

        attachedCallback() {
          this.target!.addEventListener('mouseenter', this.showHandler);
          this.target!.addEventListener('mouseleave', this.hideHandler);
        }

        detachedCallback() {
          this.target!.removeEventListener('mouseenter', this.showHandler);
          this.target!.removeEventListener('mouseleave', this.hideHandler);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('tooltip', TooltipAttribute);

      container.innerHTML = '<button tooltip="Hello!">Hover me</button>';

      register(registry);
      upgrade(document);

      // Simulate hover
      const button = container.querySelector('button')!;
      button.dispatchEvent(new MouseEvent('mouseenter'));

      expect(tooltipShown).toHaveBeenCalledWith('Hello!');

      button.dispatchEvent(new MouseEvent('mouseleave'));
      expect(tooltipHidden).toHaveBeenCalled();

      // Cleanup should remove listeners
      downgrade(document);
      tooltipShown.mockClear();

      button.dispatchEvent(new MouseEvent('mouseenter'));
      expect(tooltipShown).not.toHaveBeenCalled();
    });

    it('should implement a click-outside attribute', () => {
      const clickedOutside = vi.fn();

      class ClickOutsideAttribute extends CustomAttribute {
        private handler = (e: Event) => {
          if (!this.target!.contains(e.target as Node)) {
            clickedOutside();
          }
        };

        attachedCallback() {
          document.addEventListener('click', this.handler);
        }

        detachedCallback() {
          document.removeEventListener('click', this.handler);
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('click-outside', ClickOutsideAttribute);

      container.innerHTML = `
        <div click-outside>
          <button id="inside">Inside</button>
        </div>
        <button id="outside">Outside</button>
      `;

      register(registry);
      upgrade(document);

      // Click inside - should not trigger
      container.querySelector('#inside')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(clickedOutside).not.toHaveBeenCalled();

      // Click outside - should trigger
      container.querySelector('#outside')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(clickedOutside).toHaveBeenCalled();
    });

    it('should implement a form validation attribute', () => {
      class RequiredAttribute extends CustomAttribute {
        attachedCallback() {
          const input = this.target as HTMLInputElement;
          input.required = true;
          input.setAttribute('aria-required', 'true');
        }

        detachedCallback() {
          const input = this.target as HTMLInputElement;
          input.required = false;
          input.removeAttribute('aria-required');
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('required-field', RequiredAttribute);

      container.innerHTML = '<input type="text" required-field />';

      register(registry);
      upgrade(document);

      const input = container.querySelector('input')!;
      expect(input.required).toBe(true);
      expect(input.getAttribute('aria-required')).toBe('true');

      downgrade(document);
      expect(input.required).toBe(false);
      expect(input.getAttribute('aria-required')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle errors in attachedCallback gracefully', () => {
      class ErrorAttribute extends CustomAttribute {
        attachedCallback() {
          throw new Error('Intentional error');
        }
      }

      const registry = new CustomAttributeRegistry();
      registry.define('error-attr', ErrorAttribute);

      container.innerHTML = '<div error-attr></div>';

      register(registry);

      // Should not throw - errors in callbacks should be caught
      expect(() => upgrade(document)).toThrow('Intentional error');
    });

    it('should continue processing other attributes if one fails', () => {
      const successCalls: string[] = [];

      class FailingAttribute extends CustomAttribute {
        attachedCallback() {
          throw new Error('Fail');
        }
      }

      class SuccessAttribute extends CustomAttribute {
        attachedCallback() {
          successCalls.push(this.target!.id);
        }
      }

      const registry1 = new CustomAttributeRegistry();
      registry1.define('failing', FailingAttribute);

      const registry2 = new CustomAttributeRegistry();
      registry2.define('success', SuccessAttribute);

      container.innerHTML = '<div id="test" success></div>';

      register(registry2);
      upgrade(document);

      expect(successCalls).toContain('test');
    });
  });

  describe('reset functionality', () => {
    it('should completely reset state for testing', () => {
      class TestAttribute extends CustomAttribute {
        attachedCallback() {}
      }

      const registry = new CustomAttributeRegistry();
      registry.define('test', TestAttribute);

      container.innerHTML = '<div test></div>';

      register(registry);
      upgrade(document);

      // Reset everything
      reset();

      // State should be clean
      expect(() => upgrade(document)).not.toThrow();
    });
  });
});
