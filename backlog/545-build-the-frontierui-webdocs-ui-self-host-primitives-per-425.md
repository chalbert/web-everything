---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["544"]
dateOpened: "2026-06-14"
tags: []
---

# Build the @frontierui/webdocs-ui self-host primitives per #425 ruling

The build #425 decided: ship @frontierui/webdocs-ui — a single published package of static-first Web Docs primitives (page shell, nav, protocol/conformance panels) authored as JSX on @frontierui/jsx-runtime, server-rendered to static HTML via the #544 string-emit path, with interactivity supplied by composing the existing FUI behavior blocks (tabs, navigation, droplist, for-each) as light-DOM islands (hydrate-optional, degrades to static HTML JS-off). The load-bearing cancel-and-self-host floor from the #091 ruling. Reference impl is WE's own /protocols/ + capabilityMatrix render, generalized into reusable FUI parts. Consumed by the plateau-app served product (#427) and by self-hosters via npm install + assemble-the-shell.

## Sizing note (2026-06-14, batch pre-flight → outgrew on inspection) — story-5 → story-8

Claimed in a batch and investigated against the real surface (frontierui `packages/`, `@frontierui/jsx-runtime`
+ its `/server` `renderToString` path from #544, and the WE reference render). The one-paragraph spec
understates a focused, multi-file **published-package build**, not a batch-tail slice:

- **New package from scratch** — `frontierui/packages/webdocs-ui/`: `package.json` (`@frontierui/webdocs-ui`,
  `exports`, `files`), an **SSR `tsconfig`** wiring `jsxFactory: createElement` / `jsxFragmentFactory: Fragment`
  at `@frontierui/jsx-runtime/server` (distinct from the runtime DOM build), and a `dist` build step (the
  package convention is per-package `tsc`).
- **Two data-driven renders to generalize, not one** — the body says "protocol/conformance panels." The
  protocol panel generalizes [`src/protocols.njk`](../src/protocols.njk) (intro + a dual-axis project/status
  filter UI + a status-coloured card grid + empty state + a filter script). The **conformance panel** is a
  *separate* generalization of the `capabilityMatrix` render (`src/_data/capabilityMatrix.json`) — its own
  table/matrix component, not yet surveyed.
- **Plus** `PageShell` (a `base.njk` equivalent: header/nav/main/footer) and a `Nav` primitive.
- **Island hydration** — interactivity (the filter, tabs) supplied by composing existing FUI behavior
  blocks (tabs, navigation, droplist, for-each) as light-DOM islands via the renderToString custom-element
  path, **hydrate-optional with a JS-off degradation guarantee** — which needs degradation tests, not just
  a happy-path render test.

No design fork on the *approach* (the form is settled by #425 — static-first islands, JSX-on-jsx-runtime,
SSR via #544). Only mis-sized: realistically size-8 focused-session work. Released back to `open` unworked;
take it whole via `/next 545` in a focused frontierui session.
