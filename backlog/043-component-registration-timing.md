---
type: decision
workItem: story
size: 2
parent: "049"
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
tags:
  - webcomponents
  - component
  - lifecycle
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-3 — Decide when and how a definition registers

How does a `<component>` definition reach `customElements.define()`? Current recommendation: make `<component>` an autonomous custom element that registers its definition in `connectedCallback`, then removes itself (the transient-component self-removal lifecycle: `queueMicrotask` + `remove`). Definitions can then sit in `<head>` or anywhere in `<body>` with no residual wrapper node. Alternative held open: a global parse-time scanner that collects definitions before upgrade.

**Ratified 2026-06-08 — recommendation adopted.** `<component>` is an autonomous custom element that registers its definition in `connectedCallback`, then self-removes (`queueMicrotask` + `remove`), so definitions can sit in `<head>` or anywhere in `<body>` with no residual wrapper node. The parse-time scanner is dropped.
