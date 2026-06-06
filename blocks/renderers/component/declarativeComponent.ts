/**
 * declarativeComponent — the runtime twin of the Declarative Component adapter's build-time
 * AST transform. Lowers a `<component name shadow>…</component>` definition to a class-based
 * custom element. The component's own children are the template (implicit, DC-11); a lone
 * direct-child `<template>` is the explicit inert form and lowers identically.
 *
 * This is the single source for BOTH the Component Adapter Playground (demos/component-adapter-demo.ts)
 * and the conformance unit suite, so the demo's badges and CI exercise the exact same lowering.
 * See reports/2026-06-03-declarative-component-element.md and /blocks/component/.
 *
 * Invariants this lowering must hold (asserted by the conformance suite):
 *   - fidelity     — the registered element renders the authored template,
 *   - determinism  — generateClassSource(def) is byte-identical across runs (stable order, no hashes),
 *   - idempotency  — a Declarative-Shadow-DOM-seeded instance upgrades without re-rendering, and a
 *                    reconnect does not re-attach (the `#root` cache + `if (!root.childNodes.length)`
 *                    guard; the cache matters for closed roots, unreadable via this.shadowRoot).
 */

export type ShadowMode = 'open' | 'closed' | 'none';

export interface ComponentDef {
  name: string;
  shadow: ShadowMode;
  templateHTML: string;
  /** `delegates-focus` → attachShadow({ delegatesFocus }). Maps onto DSD `shadowrootdelegatesfocus`. */
  delegatesFocus: boolean;
  /** `clonable` → attachShadow({ clonable }). Maps onto DSD `shadowrootclonable`. */
  clonable: boolean;
  /** `serializable` → attachShadow({ serializable }). Maps onto DSD `shadowrootserializable`. */
  serializable: boolean;
  /** `form-associated` → static formAssociated + attachInternals(). Opt-in form participation (DC-12). */
  formAssociated: boolean;
  /** `default-role="…"` → internals.role default ARIA semantics; instance `role=` still overrides (DC-13). */
  defaultRole: string | null;
  /** `preserve-on-move` → emit connectedMoveCallback() so moveBefore() preserves state (atomic move, DC-15). */
  preserveOnMove: boolean;
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

  // attachShadow options — boolean attributes (presence = true), each maps onto its DSD shadowroot* attr.
  if (shadowAttr === 'none')
    for (const attr of ['delegates-focus', 'clonable', 'serializable'])
      if (comp.hasAttribute(attr))
        throw new Error(`${attr} requires a shadow root — it has no effect with shadow="none".`);
  const delegatesFocus = comp.hasAttribute('delegates-focus');
  const clonable = comp.hasAttribute('clonable');
  const serializable = comp.hasAttribute('serializable');

  // ElementInternals (attachInternals) declarative surface — DC-12 / DC-13.
  const formAssociated = comp.hasAttribute('form-associated');
  const defaultRole = comp.getAttribute('default-role')?.trim() || null;
  if (defaultRole && !/^[a-z][a-z-]*$/.test(defaultRole))
    throw new Error(`default-role must be an ARIA role token (lowercase letters/hyphens), got "${defaultRole}".`);

  // Lifecycle opt-in — defining connectedMoveCallback makes moveBefore() an atomic, state-preserving move.
  const preserveOnMove = comp.hasAttribute('preserve-on-move');

  // Implicit template (DC-11): the <component>'s OWN children are the render source —
  // no nested <template> required. A lone direct-child <template> is the explicit, inert
  // form (same lowering) — keep it for content that must stay inert before the build
  // transform runs (un-built runtime delivery; table-fragment markup like <tr> the parser
  // would otherwise drop). A childless <component> is an empty template (DC-9).
  const kids = Array.from(comp.children);
  const explicitTpl = kids.length === 1 && kids[0].tagName === 'TEMPLATE' ? (kids[0] as HTMLTemplateElement) : null;
  const templateHTML = (explicitTpl ? explicitTpl.innerHTML : comp.innerHTML).trim();
  return {
    name,
    shadow: shadowAttr,
    templateHTML,
    delegatesFocus,
    clonable,
    serializable,
    formAssociated,
    defaultRole,
    preserveOnMove,
  };
}

/**
 * The `attachShadow` init for a shadow-bearing def, as a deterministic source literal.
 * Keys are emitted in a fixed order so the generated class is byte-identical run to run.
 * (Bucket-2 attachShadow options — delegatesFocus now; clonable/serializable follow the same shape.)
 */
function shadowInitLiteral(def: ComponentDef): string {
  const opts = [`mode: '${def.shadow}'`];
  if (def.delegatesFocus) opts.push('delegatesFocus: true');
  if (def.clonable) opts.push('clonable: true');
  if (def.serializable) opts.push('serializable: true');
  return `{ ${opts.join(', ')} }`;
}

/** Emit the class source the build-time adapter would produce. Deterministic: stable order, no hashes. */
export function generateClassSource(def: ComponentDef): string {
  const cls = pascal(def.name);
  const literal = '`' + def.templateHTML.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  const hasInternals = def.formAssociated || !!def.defaultRole;
  // Members in a FIXED order so output is byte-identical: static → fields (#internals, #root) →
  // constructor (default ARIA role) → connectedCallback.
  const statics = def.formAssociated ? ['  static formAssociated = true;'] : [];
  // A `#root` field captures any DSD-hydrated shadow root at construction (open), and caches the
  // root we attach (closed roots are NOT readable via this.shadowRoot, so a plain re-read would
  // re-attach on reconnect and throw). Light DOM (none) needs no root.
  const fields = [
    ...(hasInternals ? ['  #internals = this.attachInternals();'] : []),
    ...(def.shadow === 'none' ? [] : ['  #root = this.shadowRoot;']),
  ];
  const ctor = def.defaultRole
    ? ['  constructor() {', '    super();', `    this.#internals.role = '${def.defaultRole}';`, '  }']
    : [];
  const body =
    def.shadow === 'none'
      ? ['    if (!this.firstChild) this.append(TEMPLATE.content.cloneNode(true));']
      : [
          `    this.#root ??= this.attachShadow(${shadowInitLiteral(def)});`,
          '    if (!this.#root.childNodes.length) this.#root.append(TEMPLATE.content.cloneNode(true));',
        ];
  // Defining connectedMoveCallback opts into atomic moves: moveBefore() preserves state instead of
  // firing disconnected+connected. Empty body is enough — the opt-in is the method's presence.
  const moveCb = def.preserveOnMove ? ['  connectedMoveCallback() {}'] : [];
  return [
    `const TEMPLATE = document.createElement('template');`,
    `TEMPLATE.innerHTML = ${literal};`,
    ``,
    `class ${cls} extends HTMLElement {`,
    ...statics,
    ...fields,
    ...ctor,
    `  connectedCallback() {`,
    ...body,
    `  }`,
    ...moveCb,
    `}`,
    `customElements.define('${def.name}', ${cls});`,
  ].join('\n');
}

/** Register the element — the runtime equivalent of the generated class. Idempotent per tag. */
export function defineFromDefinition(def: ComponentDef, tag: string): void {
  if (customElements.get(tag)) return;
  const template = document.createElement('template');
  template.innerHTML = def.templateHTML;
  const { shadow, delegatesFocus, clonable, serializable, formAssociated, defaultRole, preserveOnMove } = def;
  const wantsInternals = formAssociated || !!defaultRole;
  class Generated extends HTMLElement {
    static formAssociated = formAssociated;
    // attachInternals is unavailable in some non-browser runtimes (e.g. happy-dom) — guard so the
    // twin no-ops there; real browsers (and the demo) wire it up. Source emission is asserted in tests.
    #internals =
      wantsInternals && typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    #root: ShadowRoot | null = this.shadowRoot;
    constructor() {
      super();
      if (defaultRole && this.#internals) {
        try {
          this.#internals.role = defaultRole;
        } catch {
          /* runtime without ARIAMixin on ElementInternals */
        }
      }
    }
    connectedCallback() {
      if (shadow === 'none') {
        if (!this.firstChild) this.append(template.content.cloneNode(true));
      } else {
        // closed roots are not readable via this.shadowRoot — cache it so reconnect doesn't re-attach.
        this.#root ??= this.attachShadow({ mode: shadow, delegatesFocus, clonable, serializable });
        if (!this.#root.childNodes.length) this.#root.append(template.content.cloneNode(true));
      }
    }
  }
  // Conditionally opt into atomic moves — only present when requested, so other elements keep
  // default disconnect/reconnect semantics. moveBefore() then preserves state for this element.
  if (preserveOnMove) (Generated.prototype as { connectedMoveCallback?: () => void }).connectedMoveCallback = () => {};
  customElements.define(tag, Generated);
}
