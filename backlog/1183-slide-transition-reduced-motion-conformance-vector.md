---
type: idea
workItem: story
status: open
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
relatedProject: webtraits
tags: [deck, view-transition, reduced-motion, conformance, webtraits]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide-transition + reduced-motion conformance vector

Slide-to-slide transitions compose `view-transition` + `motion` — but the native View Transitions API does **not** auto-respect `prefers-reduced-motion`, so a conforming deck must gate it. Capture this as a **conformance vector** (not an author option), homed in **webtraits**. A correctness trap, not polish. *Updated/extension (conformance).*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
