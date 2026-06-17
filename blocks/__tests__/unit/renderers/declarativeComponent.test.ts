/**
 * Conformance suite for the Declarative Component lowering (the Component Adapter Playground's
 * badges, in CI). Separate from the JSX mapping suite because the invariant differs — this is a
 * ONE-WAY lowering (definition → class → rendered tree), not a two-way mirror.
 *
 * Per shared fixture it asserts the three guarantees the playground proves live:
 *   - fidelity     — the registered element renders the authored template,
 *   - determinism  — generateClassSource(def) is byte-identical across runs,
 *   - idempotency  — re-connecting a seeded instance does NOT re-render (the childNodes.length guard).
 * Plus the parse error paths (negative cases), which the playground surfaces as "parse error" badges.
 *
 * happy-dom supports custom-element registration + connectedCallback + shadow DOM, so the live
 * render is exercised here; equality is by NORMALIZED STRING (happy-dom lacks isEqualNode).
 */
import { describe, it, expect } from 'vitest';
import { componentCases } from '../../../renderers/component/__fixtures__/component-cases';
import {
  parseDefinition,
  generateClassSource,
  defineFromDefinition,
  pascal,
} from '../../../renderers/component/declarativeComponent';

const norm = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

// customElements.define is one-shot per tag for the whole process — uniquify so tests don't collide.
let uid = 0;
function renderInstance(def: ReturnType<typeof parseDefinition>, usage: string): HTMLElement {
  const tag = `${def.name}-t${++uid}`;
  defineFromDefinition(def, tag);
  const host = document.createElement('div');
  document.body.append(host);
  host.innerHTML = usage.replaceAll(`<${def.name}`, `<${tag}`).replaceAll(`</${def.name}>`, `</${tag}>`);
  return host.firstElementChild as HTMLElement;
}

function renderedRegion(el: HTMLElement, shadow: string): string {
  if (shadow === 'open') return el.shadowRoot ? el.shadowRoot.innerHTML : '';
  return el.innerHTML; // shadow="none" → light DOM
}

describe('declarativeComponent — shared fixtures', () => {
  it('covers every shared fixture', () => {
    expect(componentCases.length).toBeGreaterThanOrEqual(3);
  });

  for (const c of componentCases) {
    describe(c.title, () => {
      it('fidelity: the registered element renders the authored template', () => {
        const def = parseDefinition(c.def);
        expect(def.shadow).toBe(c.shadow);
        if (def.shadow === 'closed') {
          // closed shadow is opaque — el.shadowRoot is null, so the tree can't be read.
          // Verify the lowering targets a closed root instead.
          expect(generateClassSource(def)).toContain("attachShadow({ mode: 'closed' })");
          expect(renderInstance(def, c.usage).shadowRoot).toBeNull();
          return;
        }
        const el = renderInstance(def, c.usage);
        expect(norm(renderedRegion(el, def.shadow))).toBe(norm(def.templateHTML));
      });

      it('determinism: generateClassSource is byte-identical across runs', () => {
        const def = parseDefinition(c.def);
        expect(generateClassSource(def)).toBe(generateClassSource(def));
        // and the emitted class is named from the tag, deterministically
        expect(generateClassSource(def)).toContain(`class ${pascal(def.name)} extends HTMLElement`);
      });

      it('idempotency: re-connecting a seeded instance does not re-render', () => {
        const def = parseDefinition(c.def);
        const el = renderInstance(def, c.usage);
        const before = renderedRegion(el, def.shadow);
        // Simulate a re-connect (e.g. DSD hydration / move in the DOM): connectedCallback fires again.
        const parent = el.parentElement!;
        el.remove();
        parent.append(el);
        const after = renderedRegion(el, def.shadow);
        expect(after).toBe(before); // the `if (!root.childNodes.length)` guard prevents duplication
      });
    });
  }
});

describe('declarativeComponent — parse error paths (negative cases)', () => {
  it('throws when no <component> is present', () => {
    expect(() => parseDefinition('<div>not a component</div>')).toThrow(/No <component>/);
  });

  it('throws when name is missing', () => {
    expect(() => parseDefinition('<component><template></template></component>')).toThrow(/requires a name/);
  });

  it('throws on an invalid custom-element name (no hyphen)', () => {
    expect(() => parseDefinition('<component name="widget"><template></template></component>')).toThrow(
      /Invalid custom element name/
    );
  });

  it('throws on an unknown shadow mode', () => {
    expect(() =>
      parseDefinition('<component name="x-y" shadow="sometimes"><template></template></component>')
    ).toThrow(/shadow must be/);
  });

  it('treats an omitted <template> as an empty one (DC-9)', () => {
    const def = parseDefinition('<component name="x-empty"></component>');
    expect(def.templateHTML).toBe('');
  });
});

describe('declarativeComponent — implicit vs explicit template (DC-11)', () => {
  it("treats the component's own children as the template (implicit form)", () => {
    const def = parseDefinition('<component name="x-imp"><b><slot></slot></b></component>');
    expect(norm(def.templateHTML)).toBe('<b><slot></slot></b>');
  });

  it('a lone direct-child <template> is the explicit inert form and lowers identically', () => {
    const implicit = parseDefinition('<component name="x-eq"><b><slot></slot></b></component>');
    const explicit = parseDefinition('<component name="x-eq"><template><b><slot></slot></b></template></component>');
    expect(norm(explicit.templateHTML)).toBe(norm(implicit.templateHTML));
    expect(generateClassSource(explicit)).toBe(generateClassSource(implicit));
  });

  it('does not treat a <template> among other children as the wrapper (it is content)', () => {
    const def = parseDefinition('<component name="x-mixed"><p>x</p><template>y</template></component>');
    expect(norm(def.templateHTML)).toBe('<p>x</p><template>y</template>');
  });
});

describe('declarativeComponent — attachShadow options: delegates-focus', () => {
  it('parses the boolean attribute and threads it into the attachShadow init', () => {
    const def = parseDefinition('<component name="x-df" shadow="open" delegates-focus><input></component>');
    expect(def.delegatesFocus).toBe(true);
    expect(generateClassSource(def)).toContain("attachShadow({ mode: 'open', delegatesFocus: true })");
  });

  it('defaults to false and omits the option when the attribute is absent', () => {
    const def = parseDefinition('<component name="x-nodf" shadow="open"><input></component>');
    expect(def.delegatesFocus).toBe(false);
    expect(generateClassSource(def)).toContain("attachShadow({ mode: 'open' })");
    expect(generateClassSource(def)).not.toContain('delegatesFocus');
  });

  it('applies delegatesFocus on the live shadow root', () => {
    const def = parseDefinition('<component name="x-dfl" shadow="open" delegates-focus><input></component>');
    const el = renderInstance(def, '<x-dfl></x-dfl>');
    // Only assert when the environment models the flag (happy-dom exposes it on ShadowRoot).
    if (el.shadowRoot && 'delegatesFocus' in el.shadowRoot) {
      expect(el.shadowRoot.delegatesFocus).toBe(true);
    }
  });

  it('throws when delegates-focus is combined with shadow="none"', () => {
    expect(() =>
      parseDefinition('<component name="x-bad" shadow="none" delegates-focus><input></component>')
    ).toThrow(/delegates-focus requires a shadow root/);
  });
});

describe('declarativeComponent — attachShadow options: clonable & serializable', () => {
  it('parses both boolean attributes into the attachShadow init', () => {
    const def = parseDefinition('<component name="x-cs" shadow="open" clonable serializable><p></p></component>');
    expect(def.clonable).toBe(true);
    expect(def.serializable).toBe(true);
    expect(generateClassSource(def)).toContain("attachShadow({ mode: 'open', clonable: true, serializable: true })");
  });

  it('emits options in a fixed order regardless of attribute order (determinism)', () => {
    const def = parseDefinition('<component name="x-ord" shadow="open" serializable delegates-focus clonable><p></p></component>');
    expect(generateClassSource(def)).toContain(
      "attachShadow({ mode: 'open', delegatesFocus: true, clonable: true, serializable: true })"
    );
  });

  it('defaults to false and omits both when absent', () => {
    const def = parseDefinition('<component name="x-none2" shadow="open"><p></p></component>');
    expect(def.clonable).toBe(false);
    expect(def.serializable).toBe(false);
    expect(generateClassSource(def)).not.toContain('clonable');
    expect(generateClassSource(def)).not.toContain('serializable');
  });

  it('throws when clonable or serializable combine with shadow="none"', () => {
    expect(() => parseDefinition('<component name="x-b1" shadow="none" clonable><p></p></component>')).toThrow(
      /clonable requires a shadow root/
    );
    expect(() => parseDefinition('<component name="x-b2" shadow="none" serializable><p></p></component>')).toThrow(
      /serializable requires a shadow root/
    );
  });
});

describe('declarativeComponent — ElementInternals: form-associated & default-role (DC-12/13)', () => {
  it('emits static formAssociated + attachInternals for form-associated', () => {
    const def = parseDefinition('<component name="x-fa" shadow="open" form-associated><span></span></component>');
    expect(def.formAssociated).toBe(true);
    const src = generateClassSource(def);
    expect(src).toContain('static formAssociated = true;');
    expect(src).toContain('#internals = this.attachInternals();');
  });

  it('emits a constructor setting internals.role for default-role', () => {
    const def = parseDefinition('<component name="x-role" shadow="open" default-role="slider"><span></span></component>');
    expect(def.defaultRole).toBe('slider');
    const src = generateClassSource(def);
    expect(src).toContain('#internals = this.attachInternals();');
    expect(src).toContain("this.#internals.role = 'slider';");
  });

  it('omits all internals members when neither attribute is present', () => {
    const def = parseDefinition('<component name="x-plain" shadow="open"><span></span></component>');
    expect(def.formAssociated).toBe(false);
    expect(def.defaultRole).toBeNull();
    const src = generateClassSource(def);
    expect(src).not.toContain('attachInternals');
    expect(src).not.toContain('formAssociated');
    expect(src).not.toContain('constructor');
  });

  it('keeps a fixed member order: static → #internals → #root → constructor → connectedCallback', () => {
    const def = parseDefinition(
      '<component name="x-ord3" shadow="open" form-associated default-role="slider"><span></span></component>'
    );
    const src = generateClassSource(def);
    const order = ['static formAssociated', '#internals', '#root', 'constructor()', 'connectedCallback()'].map((s) =>
      src.indexOf(s)
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('rejects an invalid default-role token', () => {
    expect(() =>
      parseDefinition('<component name="x-bad2" default-role="Slider 1"><span></span></component>')
    ).toThrow(/default-role must be an ARIA role token/);
  });

  it('constructs the live element without throwing (runtime twin guards attachInternals)', () => {
    const def = parseDefinition(
      '<component name="x-live3" shadow="open" form-associated default-role="slider"><span></span></component>'
    );
    expect(() => renderInstance(def, '<x-live3></x-live3>')).not.toThrow();
  });
});

describe('declarativeComponent — default-aria-* defaults beyond role (#853)', () => {
  it('maps default-aria-* attributes to internals.aria* props in the constructor', () => {
    const def = parseDefinition(
      '<component name="x-aria" shadow="open" default-aria-label="Close" default-aria-disabled="true"><span></span></component>'
    );
    expect(def.defaultAria).toEqual([
      { prop: 'ariaDisabled', value: 'true' },
      { prop: 'ariaLabel', value: 'Close' },
    ]);
    const src = generateClassSource(def);
    expect(src).toContain('#internals = this.attachInternals();');
    expect(src).toContain("this.#internals.ariaLabel = 'Close';");
    expect(src).toContain("this.#internals.ariaDisabled = 'true';");
  });

  it('kebab-maps multi-word keys (has-popup → ariaHasPopup, value-now → ariaValueNow)', () => {
    const def = parseDefinition(
      '<component name="x-aria2" shadow="open" default-aria-has-popup="menu" default-aria-value-now="50"><span></span></component>'
    );
    const src = generateClassSource(def);
    expect(src).toContain("this.#internals.ariaHasPopup = 'menu';");
    expect(src).toContain("this.#internals.ariaValueNow = '50';");
  });

  it('combines default-role + default-aria-* (role emitted first), preserving fixed member order', () => {
    const def = parseDefinition(
      '<component name="x-aria3" shadow="open" form-associated default-role="slider" default-aria-value-min="0"><span></span></component>'
    );
    const src = generateClassSource(def);
    expect(src.indexOf("this.#internals.role = 'slider';")).toBeLessThan(
      src.indexOf("this.#internals.ariaValueMin = '0';")
    );
    const order = ['static formAssociated', '#internals', '#root', 'constructor()', 'connectedCallback()'].map((s) =>
      src.indexOf(s)
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('emits attachInternals for default-aria even without form-associated or default-role', () => {
    const def = parseDefinition('<component name="x-aria4" shadow="open" default-aria-label="x"><span></span></component>');
    expect(generateClassSource(def)).toContain('#internals = this.attachInternals();');
  });

  it('rejects an unknown default-aria key with a diagnostic', () => {
    expect(() =>
      parseDefinition('<component name="x-bad3" default-aria-bogus="x"><span></span></component>')
    ).toThrow(/Unknown default-aria attribute/);
  });

  it('rejects an empty default-aria value', () => {
    expect(() =>
      parseDefinition('<component name="x-bad4" default-aria-label=""><span></span></component>')
    ).toThrow(/must have a non-empty value/);
  });

  it('escapes single quotes in a default-aria value (no literal break-out)', () => {
    const def = parseDefinition(
      `<component name="x-aria5" shadow="open" default-aria-label="It's open"><span></span></component>`
    );
    expect(generateClassSource(def)).toContain("this.#internals.ariaLabel = 'It\\'s open';");
  });

  it('omits internals when no default-aria / role / form-associated present', () => {
    const def = parseDefinition('<component name="x-plain2" shadow="open"><span></span></component>');
    expect(def.defaultAria).toEqual([]);
    expect(generateClassSource(def)).not.toContain('attachInternals');
  });

  it('constructs the live element without throwing (runtime twin guards attachInternals)', () => {
    const def = parseDefinition(
      '<component name="x-live-aria" shadow="open" default-aria-label="Rating" default-aria-value-now="3"><span></span></component>'
    );
    expect(() => renderInstance(def, '<x-live-aria></x-live-aria>')).not.toThrow();
  });
});

describe('declarativeComponent — preserve-on-move (DC-15)', () => {
  it('emits an empty connectedMoveCallback when preserve-on-move is present', () => {
    const def = parseDefinition('<component name="x-pm" shadow="open" preserve-on-move><slot></slot></component>');
    expect(def.preserveOnMove).toBe(true);
    expect(generateClassSource(def)).toContain('connectedMoveCallback() {}');
  });

  it('omits connectedMoveCallback by default', () => {
    const def = parseDefinition('<component name="x-npm" shadow="open"><slot></slot></component>');
    expect(def.preserveOnMove).toBe(false);
    expect(generateClassSource(def)).not.toContain('connectedMoveCallback');
  });

  it('defines connectedMoveCallback on the runtime element only when requested', () => {
    const on = parseDefinition('<component name="x-pmon" shadow="open" preserve-on-move><slot></slot></component>');
    const onEl = renderInstance(on, '<x-pmon></x-pmon>');
    expect(typeof (onEl as { connectedMoveCallback?: unknown }).connectedMoveCallback).toBe('function');

    const off = parseDefinition('<component name="x-pmoff" shadow="open"><slot></slot></component>');
    const offEl = renderInstance(off, '<x-pmoff></x-pmoff>');
    expect((offEl as { connectedMoveCallback?: unknown }).connectedMoveCallback).toBeUndefined();
  });
});
