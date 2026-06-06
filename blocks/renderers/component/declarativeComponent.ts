/**
 * declarativeComponent — the runtime twin of the Declarative Component adapter's build-time
 * AST transform. Lowers a `<component name shadow><template>…</template></component>` definition
 * to a class-based custom element.
 *
 * This is the single source for BOTH the Component Adapter Playground (demos/component-adapter-demo.ts)
 * and the conformance unit suite, so the demo's badges and CI exercise the exact same lowering.
 * See reports/2026-06-03-declarative-component-element.md and /blocks/component/.
 *
 * Invariants this lowering must hold (asserted by the conformance suite):
 *   - fidelity     — the registered element renders the authored template,
 *   - determinism  — generateClassSource(def) is byte-identical across runs (stable order, no hashes),
 *   - idempotency  — a Declarative-Shadow-DOM-seeded instance upgrades without re-rendering
 *                    (the `if (!root.childNodes.length)` guard).
 */

export type ShadowMode = 'open' | 'closed' | 'none';

export interface ComponentDef {
  name: string;
  shadow: ShadowMode;
  templateHTML: string;
}

export const pascal = (name: string): string =>
  name.split('-').filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join('');

/** Parse a `<component name shadow><template>…</template></component>` definition. Throws on invalid input. */
export function parseDefinition(src: string): ComponentDef {
  const holder = document.createElement('div');
  holder.innerHTML = src.trim();
  const comp = holder.querySelector('component');
  if (!comp) throw new Error('No <component> element found.');

  const name = (comp.getAttribute('name') || '').trim();
  if (!name) throw new Error('<component> requires a name attribute.');
  if (!/^[a-z][a-z0-9]*-[a-z0-9-]*$/.test(name))
    throw new Error(`Invalid custom element name "${name}" — must be lowercase and contain a hyphen.`);

  const shadowAttr = (comp.getAttribute('shadow') || 'open').trim() as ShadowMode;
  if (!['open', 'closed', 'none'].includes(shadowAttr))
    throw new Error(`shadow must be "open", "closed", or "none" (got "${shadowAttr}").`);

  const tpl = comp.querySelector('template');
  // An omitted <template> is shorthand for an empty one (DC-9).
  const templateHTML = tpl ? tpl.innerHTML.trim() : '';
  return { name, shadow: shadowAttr, templateHTML };
}

/** Emit the class source the build-time adapter would produce. Deterministic: stable order, no hashes. */
export function generateClassSource(def: ComponentDef): string {
  const cls = pascal(def.name);
  const literal = '`' + def.templateHTML.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  const attach =
    def.shadow === 'none'
      ? ['    if (!this.firstChild) this.append(TEMPLATE.content.cloneNode(true));']
      : [
          `    const root = this.shadowRoot ?? this.attachShadow({ mode: '${def.shadow}' });`,
          '    if (!root.childNodes.length) root.append(TEMPLATE.content.cloneNode(true));',
        ];
  return [
    `const TEMPLATE = document.createElement('template');`,
    `TEMPLATE.innerHTML = ${literal};`,
    ``,
    `class ${cls} extends HTMLElement {`,
    `  connectedCallback() {`,
    ...attach,
    `  }`,
    `}`,
    `customElements.define('${def.name}', ${cls});`,
  ].join('\n');
}

/** Register the element — the runtime equivalent of the generated class. Idempotent per tag. */
export function defineFromDefinition(def: ComponentDef, tag: string): void {
  if (customElements.get(tag)) return;
  const template = document.createElement('template');
  template.innerHTML = def.templateHTML;
  const { shadow } = def;
  class Generated extends HTMLElement {
    connectedCallback() {
      if (shadow === 'none') {
        if (!this.firstChild) this.append(template.content.cloneNode(true));
      } else {
        const root = this.shadowRoot ?? this.attachShadow({ mode: shadow });
        if (!root.childNodes.length) root.append(template.content.cloneNode(true));
      }
    }
  }
  customElements.define(tag, Generated);
}
