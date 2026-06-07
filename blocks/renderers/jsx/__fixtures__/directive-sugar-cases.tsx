/**
 * Shared fixtures for the JSX directive-sugar layer (#070) — the single source of truth for the
 * `<For>` / `<Show>` / `<Resource>` ⇄ canonical `<template is="…">` example pairs.
 *
 * Imported by BOTH the Directive Sugar playground demo (demos/jsx-directive-sugar-demo.tsx) and the
 * conformance suite (blocks/__tests__/unit/renderers/directiveSugar.test.tsx), so a case edited here
 * updates the demo's live cards AND the tests at once — the demo's green badges can't drift from CI.
 * See reports/2026-06-03-jsx-adapter-feature-mapping.md (rows 7–8).
 *
 * The JSX factory + the directive components are auto-injected/imported: `jsx` via esbuild's
 * `jsxInject`, and `For`/`Show`/`Resource` below — capitalised tags compile to component identities
 * (`jsx.createElement(For, …)`), which the factory delegates to (they build the canonical template).
 */

// The directive components come from the SUBPATH (./directives), NOT the barrel: vite's jsxInject
// adds `import jsx from '/blocks/renderers/jsx'`, so a named import from that same barrel path would
// collide with the injected `jsx` in the browser. `jsx` itself is the auto-injected factory,
// declared here for editor/type tooling (same pattern as mapping-cases.tsx).
import { For, Show, Resource } from '../directives';
declare const jsx: typeof import('..').default;

export interface DirectiveSugarCase {
  /** Stable id (kebab) for keying parallel structures and test labels. */
  id: string;
  title: string;
  note?: string;
  /** The authored sugar JSX, shown verbatim as text. */
  sugar: string;
  /** The canonical `<template is="…">` JSX the sugar lowers to (and lifts back from). */
  canonical: string;
  /** The canonical HTML `jsxToHtml(sugar)` must produce. */
  html: string;
  /** Live render of the sugar through the runtime directive components — same DOM as canonical. */
  render: () => Node;
}

export const directiveSugarCases: DirectiveSugarCase[] = [
  {
    id: 'for-each',
    title: '1 · <For each> → for-each directive',
    note: '<For each="users"> is sugar for <template is="for-each" items="users">. The each→items rename is the only non-identity prop; key passes through.',
    sugar: `<For each="users" key="id"><li data-bind="name"></li></For>`,
    canonical: `<template is="for-each" items="users" key="id"><li data-bind="name"></li></template>`,
    html: `<template is="for-each" items="users" key="id"><li data-bind="name"></li></template>`,
    render: () => (
      <For each="users" key="id">
        <li data-bind="name"></li>
      </For>
    ),
  },
  {
    id: 'show-when',
    title: '2 · <Show when> → if directive',
    note: '<Show when="isOpen"> is sugar for <template is="if" condition="isOpen">. when→condition.',
    sugar: `<Show when="isOpen"><p class="panel">Visible</p></Show>`,
    canonical: `<template is="if" condition="isOpen"><p class="panel">Visible</p></template>`,
    html: `<template is="if" condition="isOpen"><p class="panel">Visible</p></template>`,
    render: () => (
      <Show when="isOpen">
        <p class="panel">Visible</p>
      </Show>
    ),
  },
  {
    id: 'resource-from',
    title: '3 · <Resource from> → resource directive',
    note: 'Async-data sugar. <Resource from="@users"> → <template is="resource" from="@users">. No prop rename; the value is an injector/context ref.',
    sugar: `<Resource from="@users"><ul data-bind="items"></ul></Resource>`,
    canonical: `<template is="resource" from="@users"><ul data-bind="items"></ul></template>`,
    html: `<template is="resource" from="@users"><ul data-bind="items"></ul></template>`,
    render: () => (
      <Resource from="@users">
        <ul data-bind="items"></ul>
      </Resource>
    ),
  },
  {
    id: 'nested-show-for',
    title: '4 · Nested — <For> inside <Show>',
    note: 'Nesting proves sugarize pairs each </template> to the right opener via a stack: the inner closes </For>, the outer </Show>.',
    sugar: `<Show when="hasUsers"><For each="users" key="id"><li data-bind="name"></li></For></Show>`,
    canonical: `<template is="if" condition="hasUsers"><template is="for-each" items="users" key="id"><li data-bind="name"></li></template></template>`,
    html: `<template is="if" condition="hasUsers"><template is="for-each" items="users" key="id"><li data-bind="name"></li></template></template>`,
    render: () => (
      <Show when="hasUsers">
        <For each="users" key="id">
          <li data-bind="name"></li>
        </For>
      </Show>
    ),
  },
  {
    id: 'self-closing',
    title: '5 · Self-closing <Resource from />',
    note: 'A childless directive: <Resource from="@count" /> → <template is="resource" from="@count" />, which serializes to the non-void closed form.',
    sugar: `<Resource from="@count" />`,
    canonical: `<template is="resource" from="@count" />`,
    html: `<template is="resource" from="@count"></template>`,
    render: () => <Resource from="@count" />,
  },
];

export default directiveSugarCases;
