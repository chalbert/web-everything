---
type: decision
status: open
dateOpened: '2026-06-03'
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
