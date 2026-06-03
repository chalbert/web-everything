---
type: decision
status: open
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - templating
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-4 — Decide tier-1 reactive template depth

How dynamic is a definition's `<template>` in the first cut? Current recommendation: tier 1 is **static** — clone the template, project slots, attach the shadow root. Reactive bindings, `if`, and `each` arrive as tier 2 that **composes** with Web Expressions / for-each / Template Instantiation as those primitives mature — matching the platform's bottom-up strategy. Alternative held open: bake a binding syntax in now (couples the standard to an unshipped spec shape).
