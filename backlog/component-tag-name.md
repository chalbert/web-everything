---
type: decision
status: open
dateOpened: '2026-06-03'
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
