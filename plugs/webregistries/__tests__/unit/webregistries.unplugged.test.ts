/**
 * Unplugged-mode (non-invasive) test for webregistries — #649 / #636 backfill.
 *
 * Proves the scoped CustomElementRegistry works as an opt-in library through the unplugged
 * register/upgrade API, WITHOUT the plugged global patch (`window.CustomElementRegistry` is left
 * untouched). The unplugged form is the mandatory real-app surface (#606); this is the automated
 * proof the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { register, hasPlug, getPlug, reset } from '../../../unplugged';
import CustomElementRegistry from '../../CustomElementRegistry';
import CustomElement from '../../../webcomponents/CustomElement';

describe('webregistries — unplugged (non-invasive) mode', () => {
  beforeEach(() => reset());
  afterEach(() => reset());

  it('registers a scoped CustomElementRegistry as a plug without patching globals', () => {
    const nativeBefore = window.CustomElementRegistry;

    const registry = new CustomElementRegistry();
    register(registry);

    expect(hasPlug('customElements')).toBe(true);
    expect(getPlug('customElements')).toBe(registry);
    // Non-invasive: the global registry constructor is untouched in unplugged mode.
    expect(window.CustomElementRegistry).toBe(nativeBefore);
  });

  it('defines and resolves elements through the scoped registry instance', () => {
    class ScopedWidget extends CustomElement {}

    const registry = new CustomElementRegistry();
    registry.define('scoped-widget', ScopedWidget);

    expect(registry.has('scoped-widget')).toBe(true);
    expect(registry.get('scoped-widget')).toBe(ScopedWidget);
  });

  it('resolves whenDefined() synchronously for an already-defined element', async () => {
    class ReadyWidget extends CustomElement {}

    const registry = new CustomElementRegistry();
    registry.define('ready-widget', ReadyWidget);

    await expect(registry.whenDefined('ready-widget')).resolves.toBe(ReadyWidget);
  });

  it('keeps two scoped registries independent (the point of a scoped registry)', () => {
    class WidgetA extends CustomElement {}
    class WidgetB extends CustomElement {}

    const registryA = new CustomElementRegistry();
    const registryB = new CustomElementRegistry();
    registryA.define('scope-a-only', WidgetA);
    registryB.define('scope-b-only', WidgetB);

    expect(registryA.has('scope-a-only')).toBe(true);
    expect(registryA.has('scope-b-only')).toBe(false);
    expect(registryB.has('scope-b-only')).toBe(true);
    expect(registryB.has('scope-a-only')).toBe(false);
  });
});
