---
kind: decision
size: 3
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: '2026-06-06'
dateResolved: '2026-06-07'
tags:
  - webcomponents
  - component
  - syntax
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-11 — Children-as-template default vs the inert `<template>` escape hatch

A `<component>` definition should not require a nested `<template>` wrapper. **Current recommendation: the component's own children ARE the template** — `<component name="x-foo"><h3><slot></slot></h3></component>` lowers exactly as the wrapped form would. This is the headline authoring surface; it reads as "the component element is the template." A childless `<component>` is an empty template (subsumes the narrower DC-9 "omitted = empty" framing).

A lone direct-child `<template>` stays supported as the **explicit, inert form**, kept for the cases where inertness matters before the build transform runs:

- **un-built / runtime delivery** — raw `<component>` children are live DOM, so a `<style>` would leak to the page and scripts/upgrades would fire before the element self-removes;
- **parser-sensitive markup** — table-fragment content like `<tr>` is dropped by the HTML parser outside a table context, but survives inside `<template>` (template content model).

Both forms lower to byte-identical output. Implicit is safe under the intended build-time AST transform because the transform reads source *text* — the children never go live in a browser. The runtime twin (playground/conformance) parses definitions into a **detached** element, so styles don't apply and the implicit form is observed faithfully there too.

Parsing rule: a lone direct-child `<template>` is the explicit wrapper; anything else (multiple children, or a single non-`<template>` child) is implicit content. Edge: to render a *literal* `<template>` element, author it inside the explicit wrapper or alongside a sibling.

**Open edge:** whether to ever *require* the explicit form (e.g. if a native declarative-custom-element standard mandates a `<template>` child). Until then, implicit is canonical.

## Resolution (2026-06-07)

**Ratified: the component's children ARE the template.** The recommendation above is the rule. This was already canonical in the [Component block](/blocks/component/) authoring contract ([we:component.njk](../src/_includes/block-descriptions/component.njk) — headline + authoring contract document both the implicit default and the inert-`<template>` escape hatch); this item just formalizes it. The report's Open Points Register (DC-11) is flipped `🔶 DECIDE` → `✅ RESOLVED`.

The "Open edge" is carried forward as a **deferred reversal trigger**, not a present fork: revisit only if a native declarative-custom-element standard ships that *mandates* a `<template>` child.

Sub-threads left as-is: [#040 (DC-9)](/backlog/040-component-implicit-template/) is subsumed by this decision (childless `<component>` = empty template, the zero-children case); [#039 (DC-10)](/backlog/039-component-explicit-empty-template/) remains genuinely open — the explicit-empty round-trip rule surfaces when the first non-empty-template fixture lands.
