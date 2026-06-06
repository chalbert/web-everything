---
type: decision
status: open
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - syntax
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-9 — Decide implicit empty `<template>` for childless `<component>`

> **Subsumed by DC-11** ([component-children-as-template](/backlog/074-component-children-as-template/)): the component's own children are the template, so a childless `<component>` is simply the zero-children case (an empty template). This DC-9 thread now covers only that empty-case edge.

A `<component>` with no children is meaningful — it defines a custom element whose render produces nothing. The bidirectional transform desugars `<component name="x-foo"></component>` to the same lowered class it would emit for `<component name="x-foo"><template></template></component>`. Current recommendation: keep the shorthand built into the transform until (and unless) a native declarative-custom-element standard lands that mandates an explicit `<template>` child. Alternative held open: require the explicit `<template>`, treat its omission as a transform error to stay 1:1 with whatever spec eventually ships. Round-trip note: only the canonical (omitted) form is byte-identical on round-trip; whether the explicit-empty form normalizes to the omitted form or errors is a sub-decision that surfaces when the first non-empty-template fixture lands.
