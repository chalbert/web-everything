---
kind: decision
size: 3
parent: "049"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#project-protocol-bar
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
tags:
  - webcomponents
  - component
  - protocol
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-8 — Decide whether to extract a Declarative Component Definition protocol

If more than one engine or transform comes to implement `<component>`, the "what a conforming definition must support" contract (attributes, template handling, lifecycle) becomes worth pinning as a first-class Protocol owned by Web Components — mirroring how WICG #1009 frames declaration/scripting/lifecycle/templates. Current recommendation: ship as a Block now; extract a `declarative-component-definition` Protocol once a second independent implementation exists and the contract stabilizes. Authoring the Protocol up front would be premature — that contract is exactly what is still unsettled upstream.

**Ratified 2026-06-08 — recommendation adopted.** Ship `<component>` as a Block now. Extract a `declarative-component-definition` Protocol only once a second independent implementation exists and the contract stabilizes — authoring it up front is premature.
