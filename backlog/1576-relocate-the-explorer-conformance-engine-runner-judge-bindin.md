---
kind: story
size: 5
status: open
dateOpened: "2026-06-22"
tags: []
---

# Relocate the explorer conformance engine (runner + judge + binding interface) FUI → WE

Per #1565 Fork 3 (codified at we:docs/agent/platform-decisions.md#devtools-placement): move the implementer-agnostic conformance ENGINE — generic runConformanceVector runner + pure judgeConformanceTrace + the ConformanceBinding interface + VirtualClock — from fui:tools/explorer/oracles/conformanceVectors.ts to a WE home (a @webeverything/conformance-vectors runtime sub-path/sibling). It is the standard's verifier (reads output as DATA, #1467/WPT), so it must test ANY WE implementer, not just FUI. FUI's concrete fui:blocks/*/...Conformance.ts bindings re-point their import to WE (WE→FUI; #700/#872). This is what makes the explorer testable against other WE implementers.
