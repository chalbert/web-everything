/**
 * Shared framework-input fixtures (backlog #190) — one source of React/Lit/Vue examples for BOTH the
 * Code Upgrader Playground demo and the conformance unit suite, so the demo's badges and CI exercise
 * the exact same engine on the exact same inputs (the anti-drift split established by #094's
 * `upgrader-cases.ts`).
 *
 * Each case is a snippet of legacy framework source plus what the pipeline should make of it: the
 * expected dialect/tag/shadow, and whether the verify gate should OFFER the result. The
 * `expectOffered: false` cases prove the subset boundary — the analyzer rejects dynamic markup or a
 * name that can't yield a valid custom-element tag rather than faking it.
 */

export interface FrameworkCase {
  id: string;
  title: string;
  /** Dialect hint passed to the engine (the input-adapter routing key). */
  language: 'react' | 'lit' | 'vue';
  note?: string;
  /** The legacy framework source to upgrade. */
  source: string;
  /** Expected upgraded tag (when the analyzer succeeds). */
  expectName?: string;
  /** Expected shadow mode in the IR. */
  expectShadow?: 'open' | 'closed' | 'none';
  /** Does the verify gate offer it? `false` = the analyzer should reject the input (out of subset). */
  expectOffered: boolean;
}

export const frameworkCases: FrameworkCase[] = [
  // ── React ──────────────────────────────────────────────────────────────────
  {
    id: 'react-static',
    title: 'React · static function component',
    language: 'react',
    note: 'A capitalised function returning a single static JSX tree → lifted via jsxToHtml to light DOM.',
    source:
      'function UserCard() {\n'
      + '  return (\n'
      + '    <article className="card">\n'
      + '      <h3>Title</h3>\n'
      + '      <p>Body</p>\n'
      + '    </article>\n'
      + '  );\n'
      + '}',
    expectName: 'user-card',
    expectShadow: 'none',
    expectOffered: true,
  },
  {
    id: 'react-dynamic-child',
    title: 'React · dynamic `{…}` child (out of subset)',
    language: 'react',
    note: 'An expression in a child position is dynamic — rejected, not faked.',
    source:
      'function Counter() {\n'
      + '  return <span className="count">{count}</span>;\n'
      + '}',
    expectOffered: false,
  },
  {
    id: 'react-single-word-name',
    title: 'React · single-word name (no derivable tag)',
    language: 'react',
    note: 'A web-component tag needs a hyphen; a single-word component name cannot yield one.',
    source: 'function Badge() {\n  return <strong className="badge">New</strong>;\n}',
    expectOffered: false,
  },

  // ── Lit ────────────────────────────────────────────────────────────────────
  {
    id: 'lit-static',
    title: 'Lit · static html`` template',
    language: 'lit',
    note: 'A LitElement whose render() returns a static html`` template → shadow="open" (Lit default).',
    source:
      'class MyBanner extends LitElement {\n'
      + '  render() {\n'
      + '    return html`<div class="banner"><slot></slot></div>`;\n'
      + '  }\n'
      + '}\n'
      + "customElements.define('my-banner', MyBanner);",
    expectName: 'my-banner',
    expectShadow: 'open',
    expectOffered: true,
  },
  {
    id: 'lit-interpolated',
    title: 'Lit · interpolated template (out of subset)',
    language: 'lit',
    note: 'A `${…}` in the html`` template is dynamic — rejected.',
    source:
      'class MyBanner extends LitElement {\n'
      + '  render() {\n'
      + '    return html`<div class="banner">${this.label}</div>`;\n'
      + '  }\n'
      + '}\n'
      + "customElements.define('my-banner', MyBanner);",
    expectOffered: false,
  },

  // ── Vue ────────────────────────────────────────────────────────────────────
  {
    id: 'vue-static',
    title: 'Vue · static <template> SFC',
    language: 'vue',
    note: 'An SFC with a static <template> and an explicit name option → light DOM.',
    source:
      '<template>\n'
      + '  <section class="panel"><slot></slot></section>\n'
      + '</template>\n'
      + '<script>\n'
      + "export default { name: 'SidePanel' };\n"
      + '</script>',
    expectName: 'side-panel',
    expectShadow: 'none',
    expectOffered: true,
  },
  {
    id: 'vue-directive',
    title: 'Vue · directive in template (out of subset)',
    language: 'vue',
    note: 'A v-if/v-for/binding is dynamic — rejected.',
    source:
      '<template>\n'
      + '  <ul><li v-for="x in items">{{ x }}</li></ul>\n'
      + '</template>\n'
      + '<script>\n'
      + "export default { name: 'ItemList' };\n"
      + '</script>',
    expectOffered: false,
  },
];
