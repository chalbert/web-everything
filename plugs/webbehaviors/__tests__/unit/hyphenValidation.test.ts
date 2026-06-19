/**
 * Unit test for the custom-attribute name validation (#1120, spec njk:83).
 *
 * define()/defineLazy() require a namespace separator in the name — a hyphen (`my-attr`) or a colon for
 * the namespaced form (`nav:list`) — so it can't collide with a standard HTML attribute, mirroring the
 * SyntaxError native customElements.define throws.
 */
import { describe, it, expect } from 'vitest';
import CustomAttributeRegistry from '../../CustomAttributeRegistry';
import CustomAttribute from '../../CustomAttribute';

class MyAttribute extends CustomAttribute {}

describe('CustomAttributeRegistry name validation (#1120)', () => {
  it('define() throws SyntaxError for a name without a hyphen or colon', () => {
    const registry = new CustomAttributeRegistry();
    expect(() => registry.define('nohyphen', MyAttribute as any)).toThrow(SyntaxError);
    expect(() => registry.define('nohyphen', MyAttribute as any)).toThrow(/not a valid custom attribute name/);
  });

  it('define() succeeds for a hyphenated name', () => {
    const registry = new CustomAttributeRegistry();
    expect(() => registry.define('my-attr', MyAttribute as any)).not.toThrow();
    expect(registry.get('my-attr')).toBe(MyAttribute);
  });

  it('define() succeeds for a colon-namespaced name (nav:list)', () => {
    const registry = new CustomAttributeRegistry();
    expect(() => registry.define('nav:list', MyAttribute as any)).not.toThrow();
    expect(registry.get('nav:list')).toBe(MyAttribute);
  });

  it('defineLazy() applies the same validation', () => {
    const registry = new CustomAttributeRegistry();
    expect(() => registry.defineLazy('nohyphen', async () => MyAttribute as any)).toThrow(SyntaxError);
    expect(() => registry.defineLazy('my-lazy', async () => MyAttribute as any)).not.toThrow();
  });
});
