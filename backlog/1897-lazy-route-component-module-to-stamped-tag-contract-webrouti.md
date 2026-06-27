---
kind: decision
parent: "1684"
status: open
relatedItems: ["1720", "1823"]
dateOpened: "2026-06-27"
tags: [webrouting, route-view, lazy-component, runtime-ingestion]
---

# Lazy route:component module-to-stamped-tag contract (webrouting runtime ingestion)

Surfaced building #1720 against #1823's runtime-ingestion mechanism. #1823 settled the lazy component's
authoring surface (`route:component` = a `() => import()` thunk / bare specifier) and resolution (name-by-DI
default / inline override) but **not how the imported module maps to a stamped custom-element tag**:
`fui:blocks/router/elements/RouteViewElement.ts:498` stamps by cloning a `<template>` and needs a concrete
tag, while a thunk yields a module. Decide that module→tag contract, then #1720's lazy half builds — its
runtime-object-ingestion half is fully specified by #1823 and build-ready independently.

## The fork

(a) the module **self-registers** and the route carries the tag (a separate field, or `component` doubles as
the tag in the string case); (b) the module's **default export is the constructor**, auto-defined under a
generated tag if unregistered; (c) the thunk **returns the tag name**. Each implies a different async-stamp
shape (the load must finish before the currently-sync stamp). Prep needed before ratifying. Lineage: #1720
(build, blocked here), #1823 (mechanism — settled authoring, not this), epic #1684.
