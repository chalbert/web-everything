/**
 * Unplugged-mode (non-invasive) test for webdirectives — #637 / #636 backfill.
 *
 * Proves CustomTemplateDirective is a plain customizable-built-in base (it extends the native
 * HTMLTemplateElement) that a subclass can derive from WITHOUT any global prototype patch — webdirectives
 * monkeypatches nothing; the real-app surface registers a directive through the native
 * `customElements.define(..., { extends: 'template' })`, not a plug global. This is the static,
 * deterministic proof the plug does not REQUIRE plugged mode (#606) and pollutes no shared registry.
 */
import { describe, it, expect } from 'vitest';
import CustomTemplateDirective from '../../CustomTemplateDirective';

class LoopDirective extends CustomTemplateDirective {
  connectedCallback(): void {
    /* no-op for the shape test */
  }
}

describe('webdirectives — unplugged (non-invasive) mode', () => {
  it('is a class whose prototype chain extends the native HTMLTemplateElement', () => {
    expect(typeof CustomTemplateDirective).toBe('function');
    expect(Object.getPrototypeOf(CustomTemplateDirective.prototype)).toBe(HTMLTemplateElement.prototype);
  });

  it('lets a subclass derive from it with the static + instance chains intact', () => {
    expect(Object.getPrototypeOf(LoopDirective)).toBe(CustomTemplateDirective);
    expect(Object.getPrototypeOf(LoopDirective.prototype)).toBe(CustomTemplateDirective.prototype);
  });

  it('does NOT patch the native HTMLTemplateElement prototype (non-invasive)', () => {
    // The directive lifecycle lives on subclasses/instances, never bolted onto the native prototype.
    expect(Object.prototype.hasOwnProperty.call(HTMLTemplateElement.prototype, 'connectedCallback')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(HTMLTemplateElement.prototype, 'options')).toBe(false);
  });
});
