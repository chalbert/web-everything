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
