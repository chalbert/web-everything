---
type: issue
workItem: story
size: 3
parent: "125"
status: open
blockedBy: ["125"]
dateOpened: "2026-06-09"
tags: [jsx, adapters, packaging, dedupe, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Collapse the duplicated JSXRenderer onto `@webeverything/jsx-runtime`

#125 created `@webeverything/jsx-runtime` (`frontierui/packages/jsx-runtime/src/JSXRenderer.ts`) by
copying the **canonical** factory from `webeverything/blocks/renderers/jsx/JSXRenderer.ts`. There are
now **three** copies of the DOM factory:

1. `webeverything/blocks/renderers/jsx/JSXRenderer.ts` — the canonical source (fullest: function
   components / directive duck-typing, customized-built-in `is`, namespaced `on:`/`bind:` attrs,
   `<template>.content` routing).
2. `frontierui/blocks/renderers/jsx/JSXRenderer.ts` — an **older, divergent** copy (lacks the above).
3. `frontierui/packages/jsx-runtime/src/JSXRenderer.ts` — the new package copy (= #1, plus one
   `as unknown as` cast for the package's `strict` build).

Drift risk: a mirror-dialect fix now has to land in up to three places. Once the package is the
published home, the in-repo consumers should **import from `@webeverything/jsx-runtime`** rather than
keep local copies:

- Point `frontierui/blocks/renderers/jsx` (and its `vite.config.mts` `jsxInject` / `tsconfig`) at the
  package, deleting copy #2.
- Decide whether `webeverything`'s own blocks consume the package or stay the canonical source that
  the package is generated/copied from (the constellation puts the *standard* in webeverything, the
  *impl/package* in frontierui — so webeverything may remain the source of truth that the package
  mirrors, with a check that they match rather than a hard import).

Blocked-by nothing critical; it's a dedupe/consolidation pass after #125. Pair with #239 (publish
topology) since both decide where the canonical package source ultimately lives.
