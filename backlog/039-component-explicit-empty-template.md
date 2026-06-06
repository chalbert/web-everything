---
type: decision
status: open
dateOpened: '2026-06-03'
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

Sub-decision of DC-9 ([component-implicit-template](/backlog/component-implicit-template/)). DC-9 makes the omitted-child form the canonical shorthand for `<component name="x-foo"><template></template></component>`. Open sub-decision: when a user authors the explicit-empty form, does the transform normalize it to the omitted form on round-trip (breaking byte-identical for that input) or reject it as redundant syntax with a named-rule error? Surfaces the moment the first non-empty-template fixture lands and forces the inverse rule to distinguish "empty template present" from "no template child."
