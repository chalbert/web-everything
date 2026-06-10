/**
 * Shared upgrader fixtures — the single source of legacy-input examples for BOTH the Code Upgrader
 * Playground demo and the conformance unit suite, so the demo's badges and CI exercise the exact
 * same engine on the exact same inputs (the #A-style anti-drift split).
 *
 * Each case is a snippet of *legacy* vanilla-web-component source plus what the pipeline should make
 * of it: the expected tag/shadow, and whether the verify gate should OFFER the result. The
 * `should-not-offer` cases prove the moat — the engine refuses to present output it can't trust.
 */

export interface UpgraderCase {
  id: string;
  title: string;
  note?: string;
  /** The legacy source to upgrade. */
  source: string;
  /** Expected upgraded tag (when the analyzer succeeds). */
  expectName?: string;
  /** Expected shadow mode in the IR. */
  expectShadow?: 'open' | 'closed' | 'none';
  /** Intent ids the analyzer should infer (#189). Omit/`[]` ⇒ no intent should be inferred. */
  expectIntents?: string[];
  /** Does the verify gate offer it? `false` = the analyzer should reject the input (out of subset). */
  expectOffered: boolean;
}

export const upgraderCases: UpgraderCase[] = [
  {
    id: 'shadow-innerhtml',
    title: '1 · Shadow-DOM component (open root, slots)',
    note: 'The classic "attachShadow + set shadowRoot.innerHTML" shape → lifted to shadow="open".',
    source:
      `class UserCard extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<style>:host{display:block}</style><h3><slot name=\"title\">Untitled</slot></h3><slot></slot>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('user-card', UserCard);`,
    expectName: 'user-card',
    expectShadow: 'open',
    expectOffered: true,
  },
  {
    id: 'light-dom',
    title: '2 · Light-DOM component (this.innerHTML)',
    note: 'No shadow root — markup set straight on the element. Lifts to shadow="none".',
    source:
      `class XBadge extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.innerHTML = '<strong class=\"badge\">New</strong>';\n` +
      `  }\n` +
      `}\n` +
      `customElements.define('x-badge', XBadge);`,
    expectName: 'x-badge',
    expectShadow: 'none',
    expectOffered: true,
  },
  {
    id: 'constructor-shadow',
    title: '3 · Shadow set in the constructor',
    note: 'attachShadow + innerHTML in the constructor instead of connectedCallback — same lift.',
    source:
      `class SiteFooter extends HTMLElement {\n` +
      `  constructor() {\n` +
      `    super();\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<footer><slot>© 2026</slot></footer>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('site-footer', SiteFooter);`,
    expectName: 'site-footer',
    expectShadow: 'open',
    expectOffered: true,
  },
  {
    id: 'dynamic-template-rejected',
    title: '4 · Dynamic template (rejected — out of subset)',
    note: 'A `${…}` interpolated template is dynamic; the reference analyzer rejects it rather than guess. This is where a BYO-AI provider plugs in.',
    source:
      `class GreetUser extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<p>Hello ${this.getAttribute('name')}</p>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('greet-user', GreetUser);`,
    expectOffered: false,
  },
  {
    id: 'not-a-component-rejected',
    title: '5 · Not a component (rejected)',
    note: 'A plain function with no define() call — the analyzer does not claim it; nothing is faked.',
    source: `function add(a, b) {\n  return a + b;\n}`,
    expectOffered: false,
  },
  {
    id: 'listbox-selection-intent',
    title: '6 · Intent inference — listbox → selection',
    note: 'role="listbox" + aria-selected is an unambiguous selection signal (#189). The IR carries an inferred `intents: ["selection"]`, which the verify gate conformance-checks against the standard.',
    source:
      `class FruitPicker extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.innerHTML = '<ul role=\"listbox\" aria-label=\"Fruit\"><li role=\"option\" aria-selected=\"true\">Apple</li><li role=\"option\">Pear</li></ul>';\n` +
      `  }\n` +
      `}\n` +
      `customElements.define('fruit-picker', FruitPicker);`,
    expectName: 'fruit-picker',
    expectShadow: 'none',
    expectIntents: ['selection'],
    expectOffered: true,
  },
  {
    id: 'reduced-motion-intent',
    title: '7 · Intent inference — reduced-motion guard → motion',
    note: 'A `prefers-reduced-motion` guard means the component expresses motion it offers to tone down (#189) → inferred `intents: ["motion"]`.',
    source:
      `class PulseDot extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.attachShadow({ mode: 'open' });\n` +
      "    this.shadowRoot.innerHTML = `<style>.dot{animation:pulse 1s infinite}@media (prefers-reduced-motion: reduce){.dot{animation:none}}</style><span class=\"dot\"></span>`;\n" +
      `  }\n` +
      `}\n` +
      `customElements.define('pulse-dot', PulseDot);`,
    expectName: 'pulse-dot',
    expectShadow: 'open',
    expectIntents: ['motion'],
    expectOffered: true,
  },
];
