/**
 * Unit test for getStandInElement extraction + duplicate-define guard (#1102).
 *
 * define() registers a native stand-in so the browser can parse a scoped tag — an autonomous element
 * stands in on HTMLElement, a customized built-in on its `HTML*Element` base — and rejects a duplicate
 * name or constructor on the same registry, mirroring native CustomElementRegistry.define().
 */
import { describe, it, expect } from 'vitest';
import CustomElementRegistry from '../../CustomElementRegistry';

describe('CustomElementRegistry stand-in + duplicate guard (#1102)', () => {
  it('registers an autonomous stand-in extending HTMLElement', () => {
    const registry = new CustomElementRegistry();
    class AutoEl extends HTMLElement {}
    registry.define('x-auto-1102', AutoEl as any);
    const standIn = window.customElements.get('x-auto-1102');
    expect(standIn).toBeTypeOf('function');
    expect(Object.getPrototypeOf(standIn)).toBe(HTMLElement);
  });

  it('registers a customized-built-in stand-in extending the named HTML*Element base', () => {
    const registry = new CustomElementRegistry();
    class BtnEl extends HTMLButtonElement {}
    registry.define('x-btn-1102', BtnEl as any, { extends: 'button' });
    const standIn = window.customElements.get('x-btn-1102');
    expect(standIn).toBeTypeOf('function');
    expect(Object.getPrototypeOf(standIn)).toBe(HTMLButtonElement);
  });

  it('throws NotSupportedError on a duplicate name', () => {
    const registry = new CustomElementRegistry();
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    registry.define('x-dup-name-1102', A as any);
    expect(() => registry.define('x-dup-name-1102', B as any)).toThrow(/already been used/);
  });

  it('throws NotSupportedError on a duplicate constructor', () => {
    const registry = new CustomElementRegistry();
    class Same extends HTMLElement {}
    registry.define('x-dup-ctor-a-1102', Same as any);
    expect(() => registry.define('x-dup-ctor-b-1102', Same as any)).toThrow(/constructor has already been used/);
  });

  it('the same constructor MAY be defined in a different registry (per-registry guard)', () => {
    class Shared extends HTMLElement {}
    const r1 = new CustomElementRegistry();
    const r2 = new CustomElementRegistry();
    r1.define('x-shared-1102', Shared as any);
    expect(() => r2.define('x-shared-1102b', Shared as any)).not.toThrow();
  });
});
