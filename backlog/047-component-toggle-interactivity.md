---
kind: decision
size: 2
parent: "049"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
tags:
  - webcomponents
  - component
  - docs
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-7 — Decide how interactive the declarative↔class toggle becomes

Component examples show both the declarative source and the class the transform emits, via a reusable toggle built on the existing mode-selector pattern. The first cut is a **static** toggle (both forms authored/generated, user flips between them). Current recommendation: keep it static now. Alternative held open (tier 2): a **live** editor — CodeMirror/Monaco running the deterministic AST transform in-browser so editing the declarative source regenerates the class view live, which requires bundling the transform client-side.

**Ratified 2026-06-08 — recommendation adopted.** The declarative↔class toggle is **static** in tier-1 (both forms authored/generated, user flips between them) on the existing mode-selector pattern. The live in-browser editor is a tier-2 enhancement.
