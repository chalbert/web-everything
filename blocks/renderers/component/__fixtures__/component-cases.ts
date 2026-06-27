/**
 * Shared component-lowering fixtures — the single source of the `<component>` example definitions
 * for BOTH the Component Adapter Playground demo and the conformance suite.
 *
 * Deliberately SEPARATE from the JSX mapping fixtures: the invariant differs. JSX proves two-way
 * equivalence/round-trip (HTML ⇄ JSX); `<component>` proves ONE-WAY lowering fidelity (definition →
 * class → rendered tree). See reports/2026-06-03-declarative-component-element.md.
 *
 * These cases ARE the `<component>` conformance vectors WE keeps (#1775 / #1467 — WE keeps the contract +
 * vectors, the runtime renderer is FUI's). The `ShadowMode` vocabulary is inlined here (not imported from
 * the now-deleted WE runtime `declarativeComponent.ts`) so the vectors stand alone as build-agnostic data.
 */

/** The `attachShadow` mode a `<component>` declares — `open`/`closed` shadow root, or `none` (light DOM). */
export type ShadowMode = 'open' | 'closed' | 'none';

export interface ComponentCase {
  id: string;
  title: string;
  note?: string;
  shadow: ShadowMode;
  /** The `<component>…</component>` definition, authored as text. */
  def: string;
  /** Markup that instantiates the element (slots, attributes). */
  usage: string;
}

export const componentCases: ComponentCase[] = [
  {
    id: 'shadow-slots',
    title: '1 · Shadow component with slots (implicit template)',
    note: "name + shadow=\"open\". The component's own children ARE the template (DC-11) — no nested <template>. Lowers to attachShadow + clone.",
    shadow: 'open',
    def:
      `<component name="user-card" shadow="open">\n` +
      `  <style>:host { display:block } h3 { margin:0 }</style>\n` +
      `  <h3><slot name="title">Untitled</slot></h3>\n` +
      `  <slot></slot>\n` +
      `</component>`,
    usage: `<user-card><span slot="title">Ada Lovelace</span><p>First programmer.</p></user-card>`,
  },
  {
    id: 'style-encapsulation',
    title: '2 · Style encapsulation (implicit template)',
    note: 'Scoped <style> in the shadow template — the :host and tag rules do not leak to the page.',
    shadow: 'open',
    def:
      `<component name="x-callout" shadow="open">\n` +
      `  <style>:host { display:block; border-left:3px solid #6366f1; padding:.5rem .75rem }</style>\n` +
      `  <strong><slot></slot></strong>\n` +
      `</component>`,
    usage: `<x-callout>Heads up — this is shadow-scoped.</x-callout>`,
  },
  {
    id: 'light-dom',
    title: '3 · Light-DOM component (shadow="none")',
    note: 'No shadow root — the children are cloned into light DOM. Good when no style encapsulation is needed.',
    shadow: 'none',
    def:
      `<component name="x-stamp" shadow="none">\n` +
      `  <span class="badge info">NEW</span>\n` +
      `</component>`,
    usage: `<x-stamp></x-stamp>`,
  },
  {
    id: 'closed-shadow',
    title: '4 · Closed shadow (opaque)',
    note: 'shadow="closed" — the root is not exposed (el.shadowRoot is null), so the rendered tree is not introspectable. We verify the lowering targets a closed root instead.',
    shadow: 'closed',
    def:
      `<component name="x-secret" shadow="closed">\n` +
      `  <span><slot></slot></span>\n` +
      `</component>`,
    usage: `<x-secret>hidden internals</x-secret>`,
  },
  {
    id: 'explicit-template',
    title: '5 · Explicit <template> (inert escape hatch)',
    note: 'A lone direct-child <template> is the explicit, inert form — for content that must stay inert before the build transform runs. Lowers identically to the implicit form.',
    shadow: 'open',
    def:
      `<component name="x-explicit" shadow="open">\n` +
      `  <template>\n` +
      `    <style>:host { display:block }</style>\n` +
      `    <em><slot></slot></em>\n` +
      `  </template>\n` +
      `</component>`,
    usage: `<x-explicit>still inert at author time</x-explicit>`,
  },
  {
    id: 'delegates-focus',
    title: '6 · Focus delegation (delegates-focus)',
    note: 'delegates-focus maps onto attachShadow({ delegatesFocus:true }) / DSD shadowrootdelegatesfocus — focusing the host (or clicking non-focusable shadow content) moves focus to the first focusable in the shadow tree.',
    shadow: 'open',
    def:
      `<component name="x-field" shadow="open" delegates-focus>\n` +
      `  <label><slot name="label">Field</slot> <input></label>\n` +
      `</component>`,
    usage: `<x-field><span slot="label">Name</span></x-field>`,
  },
  {
    id: 'clonable-serializable',
    title: '7 · Clonable + serializable shadow',
    note: 'clonable (shadowrootclonable) lets cloneNode() copy the shadow tree; serializable (shadowrootserializable) lets getHTML({ serializableShadowRoots }) include it. Both forward to attachShadow options.',
    shadow: 'open',
    def:
      `<component name="x-snapshot" shadow="open" clonable serializable>\n` +
      `  <p><slot></slot></p>\n` +
      `</component>`,
    usage: `<x-snapshot>cloneable + serializable</x-snapshot>`,
  },
  {
    id: 'form-associated',
    title: '8 · Form participation + default ARIA (attachInternals)',
    note: 'form-associated emits static formAssociated + attachInternals() (form participation); default-role sets internals.role and default-aria-* (#853) map through the rest of the ElementInternals default-ARIA surface (here a slider\'s value range) — instance aria-*/IDL still overrides. The generated-class pane shows all of them set in the constructor; the runtime wires them in browsers that support ElementInternals.',
    shadow: 'open',
    def:
      `<component name="x-rating" shadow="open" form-associated default-role="slider"\n` +
      `           default-aria-value-min="0" default-aria-value-max="5" default-aria-value-now="3">\n` +
      `  <span><slot>★</slot></span>\n` +
      `</component>`,
    usage: `<x-rating></x-rating>`,
  },
  {
    id: 'preserve-on-move',
    title: '9 · State-preserving moves (preserve-on-move)',
    note: 'preserve-on-move emits an empty connectedMoveCallback() — defining it makes Element.moveBefore() relocate the element atomically (focus, media, iframe, and shadow state preserved) instead of firing disconnected + connected.',
    shadow: 'open',
    def:
      `<component name="x-keepalive" shadow="open" preserve-on-move>\n` +
      `  <slot></slot>\n` +
      `</component>`,
    usage: `<x-keepalive>kept alive across moves</x-keepalive>`,
  },
];

export default componentCases;
