/**
 * Unplugged-mode (non-invasive) test for webcomponents — #649 / #636 backfill.
 *
 * Exercises the webcomponents enhancements as a plain library, WITHOUT the plugged cloneNode global
 * patch. Centres on the #454 own-property clone discriminator (`copyOptions`): a real CustomElement
 * carries `options` as an OWN data property, while native form controls (`<select>`/`<datalist>`)
 * expose it as a read-only INHERITED accessor — the old `'options' in node` test matched both and
 * threw when assigning onto the getter, aborting the clone. This is the automated proof the fix
 * holds in the mandatory unplugged surface (#606).
 */
import { describe, it, expect } from 'vitest';
import { copyOptions } from '../../../core/cloneUtils';
import CustomElement from '../../CustomElement';

describe('webcomponents — unplugged (non-invasive) mode', () => {
  it('copies an OWN options data property from a CustomElement-like node onto the clone', () => {
    const original: any = document.createElement('div');
    original.options = { variant: 'primary' };
    const clone: any = document.createElement('div');

    copyOptions(original, clone);

    expect(clone.options).toEqual({ variant: 'primary' });
  });

  it('does NOT copy options when it is an INHERITED accessor, not an own property (#454)', () => {
    // Model a native form control (`<select>`/`<datalist>`): `options` is a read-only getter on the
    // prototype, so `'options' in node` is true but it is NOT an own property. (Real browsers expose
    // it this way; jsdom/happy-dom instead make it own, which is why the live #454 fix is also
    // e2e-verified — here we exercise the own-property discriminator directly and deterministically.)
    const proto = {};
    Object.defineProperty(proto, 'options', { get: () => ['inherited-option'] });
    const original: any = Object.create(proto);
    const clone: any = {};

    expect('options' in original).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(original, 'options')).toBe(false);

    // The own-property guard must skip it, so the clone is not aborted by assigning onto a getter.
    expect(() => copyOptions(original, clone)).not.toThrow();
    expect('options' in clone).toBe(false);
  });

  it('leaves a node without options untouched', () => {
    const original: any = document.createElement('div');
    const clone: any = document.createElement('div');

    copyOptions(original, clone);

    expect('options' in clone).toBe(false);
  });

  it('constructs a CustomElement subclass as a plain class (no global registry patch)', () => {
    class PlainWidget extends CustomElement {}
    // Reflect.construct mirrors how the upgrade path instantiates; proves the class is constructible
    // without the plugged bootstrap having run.
    const el = Reflect.construct(PlainWidget, [], PlainWidget);

    expect(el).toBeInstanceOf(CustomElement);
  });
});
