---
kind: story
size: 8
status: open
dateOpened: "2026-06-24"
tags: []
---

# Relocate the upgrader renderer family out of WE per #1282 (impl→FUI)

The upgrader impl lives WE-resident at we:blocks/renderers/upgrader/ — upgraderEngine + transformInterpreter + versionMigrationPlanner + 5 analyzers (mockupAnalyzer/legacyWebComponent/frameworkAnalyzers/modelComponent/versionMigration) + fixtures. #1282 (resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in FUI. Build the FUI upgrader family importing the FUI component kernel (#1767), relocate the unit tests, swap the WE consumer demos (mockup-to-standard, code-upgrader) to #701 FUI iframes; KEEP in WE only the contract + conformance vectors. Prereq for deleting the shared component kernel (#1775) — upgrader.test + 2 demos value-import it. FUI has no upgrader renderer today; nothing kept WE-resident imports it, so no #1771-style WE→FUI seam.
