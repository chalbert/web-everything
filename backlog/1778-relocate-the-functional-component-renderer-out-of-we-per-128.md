---
kind: story
size: 5
status: open
dateOpened: "2026-06-24"
tags: []
---

# Relocate the functional-component renderer out of WE per #1282 (impl→FUI)

The functional renderer impl lives WE-resident at we:blocks/renderers/functional/functionalComponent.ts (generateFunctionalSource — the functional twin of the declarative component lowering). #1282 (resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in FUI. Build the FUI functional renderer importing the FUI component kernel (#1767), relocate functionalComponent.test, and KEEP in WE only the contract + conformance vectors. Prereq for deleting the shared component kernel (#1775) — functionalComponent.test value-imports parseDefinition. Builds on the #1619/#1746 functional-adapter decisions (resolved). FUI has no functional renderer today; nothing kept WE-resident imports it, so no #1771-style WE→FUI seam.
