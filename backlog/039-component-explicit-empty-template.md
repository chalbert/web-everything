---
type: decision
workItem: story
size: 1
parent: "049"
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
tags:
  - webcomponents
  - component
  - syntax
  - transform
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-10 — Decide how the explicit empty `<template></template>` form round-trips

Sub-decision of DC-9 ([component-implicit-template](/backlog/040-component-implicit-template/)). DC-9 makes the omitted-child form the canonical shorthand for `<component name="x-foo"><template></template></component>`. Open sub-decision: when a user authors the explicit-empty form, does the transform normalize it to the omitted form on round-trip (breaking byte-identical for that input) or reject it as redundant syntax with a named-rule error? Surfaces the moment the first non-empty-template fixture lands and forces the inverse rule to distinguish "empty template present" from "no template child."

**Resolved 2026-06-08 — normalize to the canonical omitted form.** (DC-10 had no standing recommendation; this applies the cluster's "one canonical representation" philosophy.) When a user authors the explicit-empty `<template></template>`, the transform normalizes it to the omitted canonical form on round-trip. Byte-identical round-trip is only ever promised for the canonical (omitted) form — see DC-9 ([#040](/backlog/040-component-implicit-template/)) — so normalizing the redundant explicit-empty form is consistent and avoids a named-rule error for syntax that is merely verbose, not wrong. Revisit only if a future native spec mandates the explicit `<template>`, which would flip the canonical form.
