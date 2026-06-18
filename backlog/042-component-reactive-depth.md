---
type: decision
workItem: story
size: 3
parent: "049"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
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

**Ratified 2026-06-08 — recommendation adopted.** Tier-1 template is **static**: clone the template, project slots, attach the shadow root. Reactive bindings, `if`, and `each` arrive as tier-2 that *composes* with Web Expressions / for-each / Template Instantiation as those primitives mature — no binding syntax is baked in now.
