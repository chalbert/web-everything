---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["x10x41m"]
scope: ["plateau-app:src/feature-tracker/feature-tracking.webcases.ts", "plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S0a · FT webcases registry + invariant tests + SPEC allow-list

Graduate all 115 FT cases into a plateau-app feature-tracking webcases registry (mirroring the plateau-app card-taxonomy webcases pattern) with a conformance test enforcing the 5 invariants plus the SPEC allow-list. Delivers #2709. No runtime surface.

## Deliverable
Graduate all 115 cases (8 families S/F/K/M/E/L/C/R) mirroring the plateau-app card-taxonomy webcases: a WEB CASE header + assert line, a two-token-plane parser (STATE/FAULT/WAIT), a manifest, and a conformance test enforcing the 5 invariants + the SPEC allow-list. Invariant (iii) is rewritten to the §0 forecast ruling (projection allowed; no date on blocked/gated/stalled/cycle). No runtime surface.

**Delivers #2709** — the registry half of the taxonomy → webcases story.

## FT cases → rendered=yes
All 115 as registry entries (no render).

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`
- `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts`

## Acceptance
vitest green: 115 present; `uc` unique+sequential per family; forecast obeys the §0 ruling as registry self-consistency; every E has `failEdge=red`; `rendered ∈ {yes, spec}`; 44 spec tracked, none render, list only shrinks; the parser round-trips both planes.
