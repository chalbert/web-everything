---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
dateStarted: "2026-06-06"
tags: [jsx, adapters, directives]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
graduatedTo: adapter:jsx-adapter
---

# Add the <For>/<Show>/<Resource> directive sugar layer for JSX

The mirror dialect canonicalizes directives as the literal `<template is="…">` element because it is the one form JSX can both express and reverse. The prettier `<For each>` / `<Show when>` / `<Resource>` components are **deferred sugar** that should map through the same directive registry to and from the `<template is>` form. Implement them now that the core transform is proven (`htmlToJsx`/`jsxToHtml`). See the feature-mapping report rows 7–8.

Distinct from `jsx-rendering-strategy-axis`: this is an alternative *syntax spelling* of the same directives, not a change to how trees update over time.

## Progress
- **Status:** resolved — directive-sugar layer shipped; graduated into the JSX Adapter.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `blocks/renderers/jsx/directives.ts` — the directive registry (`For`↔`is="for-each"`, `Show`↔`is="if"`, `Resource`↔`is="resource"`) + `desugar()`/`sugarize()` string transforms + runtime `For`/`Show`/`Resource` components + `isDirectiveComponent`. One registry feeds all three surfaces (transform both ways + runtime), so spelling can't drift.
  - `JSXRenderer.ts` — factory delegates to directive components (widened `JSXElementType`, new `JSXFunctionComponent`); `desugar` wired into `jsxToHtml.ts`; barrel exports added.
  - Shared fixtures `__fixtures__/directive-sugar-cases.tsx` (5 cases) + conformance suite `directiveSugar.test.tsx` (31 tests). Playground demo `demos/jsx-directive-sugar-demo.{ts,html}` + `demos.json` entry (browser-verified 5/5, zero console errors).
  - Docs: JSX Adapter page (`adapter-descriptions/jsx-adapter.njk`) + feature-mapping report updated from "deferred" → "implemented".
  - Gates: `npm run verify` green (1396 pass) · `check:standards` 0 errors · `build:check` green.
- **Next:** none. Follow-up captured: **#124** (`<Resource>` async contract — currently spelling-only, no loading/error/fallback or Loader-Intent wiring).
- **Notes:** Canonical form stays the literal `<template is>` (htmlToJsx unchanged); sugar is an opt-in spelling via `sugarize()`. Names align with `crossStrategy.ts` (#078): `is="for-each"` (`items`/`item`/`key`), `is="if"` (`condition`). Footgun for future demos/fixtures: importing **named** bindings from the `/blocks/renderers/jsx` barrel in a `.tsx` collides with vite's `jsxInject` (`Identifier 'jsx' has already been declared`) — import transforms from the subpath instead.
