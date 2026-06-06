/**
 * Shared component-lowering fixtures — the single source of the `<component>` example definitions
 * for BOTH the Component Adapter Playground demo and the conformance suite.
 *
 * Deliberately SEPARATE from the JSX mapping fixtures: the invariant differs. JSX proves two-way
 * equivalence/round-trip (HTML ⇄ JSX); `<component>` proves ONE-WAY lowering fidelity (definition →
 * class → rendered tree). See reports/2026-06-03-declarative-component-element.md.
 */
import type { ShadowMode } from '../declarativeComponent';

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
    title: '1 · Shadow component with slots',
    note: 'name + shadow="open" + a <template> with <style> and <slot>s. Lowers to attachShadow + clone.',
    shadow: 'open',
    def:
      `<component name="user-card" shadow="open">\n` +
      `  <template>\n` +
      `    <style>:host { display:block } h3 { margin:0 }</style>\n` +
      `    <h3><slot name="title">Untitled</slot></h3>\n` +
      `    <slot></slot>\n` +
      `  </template>\n` +
      `</component>`,
    usage: `<user-card><span slot="title">Ada Lovelace</span><p>First programmer.</p></user-card>`,
  },
  {
    id: 'style-encapsulation',
    title: '2 · Style encapsulation',
    note: 'Scoped <style> inside the shadow template — the :host and tag rules do not leak to the page.',
    shadow: 'open',
    def:
      `<component name="x-callout" shadow="open">\n` +
      `  <template>\n` +
      `    <style>:host { display:block; border-left:3px solid #6366f1; padding:.5rem .75rem }</style>\n` +
      `    <strong><slot></slot></strong>\n` +
      `  </template>\n` +
      `</component>`,
    usage: `<x-callout>Heads up — this is shadow-scoped.</x-callout>`,
  },
  {
    id: 'light-dom',
    title: '3 · Light-DOM component (shadow="none")',
    note: 'No shadow root — the template is cloned into light DOM. Good when no style encapsulation is needed.',
    shadow: 'none',
    def:
      `<component name="x-stamp" shadow="none">\n` +
      `  <template><span class="badge info">NEW</span></template>\n` +
      `</component>`,
    usage: `<x-stamp></x-stamp>`,
  },
];

export default componentCases;
