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
  - naming
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-1 — Decide the definition element's tag name

The declarative definition element is currently `<component name="...">`. The risk: in Vue/React mental models `<component :is>` means *instantiate a component here*, whereas ours means *define one*. The `name` attribute plus the required `<template>` child disambiguate it in practice, and `<component>` reads naturally as the thing you author. Current recommendation: keep `<component name>`. Alternatives held open: `<define-element>` (explicit but ugly), `<custom-element>`, or the WICG `<definition>`.

**Ratified 2026-06-08 — support both, configurable at compile time.** Rather than locking a single spelling, the AST transform accepts the tag name as a build-tool option (default `<component>`, with `<definition>` recognized as an alias). Native standardization is far enough off that this is transform config, not a frozen wire format — the option keeps us free to switch the default or drop an alias later with no migration cost. Both desugar to the identical lowered class; the choice is purely authoring vocabulary. The two genuinely-ugly spellings (`<define-element>`, `<custom-element>`) are dropped.
