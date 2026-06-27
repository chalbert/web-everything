---
kind: decision
parent: "1684"
status: open
relatedItems: ["1720", "1823"]
dateOpened: "2026-06-27"
tags: [webrouting, route-view, lazy-component, runtime-ingestion]
---

# Lazy route:component module-to-stamped-tag contract (webrouting runtime ingestion)

Surfaced building #1720 against the #1823-ratified runtime-ingestion mechanism. #1823 settled the lazy
component's **authoring surface** (`route:component` = an inline `() => import()` thunk in JS / a bare
specifier string in DOM, named to match Angular/Vue `loadComponent`) and **resolution** (name-by-DI default
/ inline override) — but **not how the imported component module maps to a stamped custom-element tag**.
`fui:blocks/router/elements/RouteViewElement.ts:498` stamps by cloning a `<template>`, i.e. it needs a
concrete *tag* to render; a thunk/specifier yields a *module*, and the contract for "module → which tag to
stamp" is undecided. The fork: (a) the module **self-registers** a custom element and the route carries the
tag to stamp (a separate field, or `component` doubles as the tag-name in the string case); (b) the module's
**default export is the element constructor**, auto-defined under a generated tag (`route-view-lazy-N`) if
not already registered; (c) the thunk **returns the tag name** (`() => import('./x').then(() => 'x-view')`).
Each implies a different async-stamp shape (the load must complete before the sync stamp). Decide the
contract, then #1720's lazy half builds; **its runtime-route-object ingestion half (the `customContexts:routes`
provider + settable `routes` property + merge-precedence + name-DI/inline guard/loader resolution) is fully
specified by #1823 and build-ready independently** — split it out if a build-now sliver is wanted. Prep needed
before ratifying. Lineage: #1720 (build, blocked here), #1823 (mechanism — settled authoring, not this), epic
#1684.
