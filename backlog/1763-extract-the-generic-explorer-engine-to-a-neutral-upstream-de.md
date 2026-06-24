---
kind: story
size: 8
status: resolved
dateResolved: "2026-06-24"
graduatedTo: none
blockedBy: []
dateOpened: "2026-06-24"
relatedProject: webcomponents
tags: [explorer, devtools-placement, constellation, frontierui, cross-impl]
---

# Extract the generic explorer engine to a neutral upstream devtool package (demote FUI to recipe/workbench provider)

## Superseded by ratified #1747 (2026-06-24)

This card assumed the explorer was open infrastructure to extract into a neutral **open** package upstream of
the implementations. #1747 ruled otherwise: the explorer is a **closed Plateau product** — the whole tool
(engine included) relocates to plateau-app (#1577), not to a neutral open package. There is no cross-impl
open-package extraction to do. Resolved as superseded; the cross-impl-reach concern is moot (the closed product
drives any app over a browser, depending on nothing it tests).

---

## Original framing (superseded)

The explorer engine imports zero FUI component source — it drives any app over a browser (verified #1747). Today it lives inside FUI, the single reference implementation, consumed as a library only by Plateau's CLI (a legal forward edge). PARKED: extract the generic engine (driver, oracles, genericInvariants, stateFlowGraph, gate, harnesses) to a neutral devtool package upstream of all implementations, leaving each impl to provide only a workbench URL + routes/auth recipe. Trigger: a SECOND WE implementation appears, or an external consumer wants the engine as a standalone library. Until then building this is worse (one impl; runtime-only coupling already lets a sibling be tested without depending on FUI).
