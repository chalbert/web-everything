---
type: idea
workItem: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "conformance-vector suite slide-transition-reduced-motion (we:conformance-vectors)"
relatedProject: webtraits
tags: [deck, view-transition, reduced-motion, conformance, webtraits]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide-transition + reduced-motion conformance vector

Slide-to-slide transitions compose `view-transition` + `motion` — but the native View Transitions API does **not** auto-respect `prefers-reduced-motion`, so a conforming deck must gate it. Capture this as a **conformance vector** (not an author option), homed in **webtraits**. A correctness trap, not polish. *Updated/extension (conformance).*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored conformance-vector suite `slide-transition-reduced-motion` (`we:conformance-vectors/slide-transition-reduced-motion.vectors.ts`, registered in `we:conformance-vectors/index.ts`): three vectors judging the **observable** outcome of the correctness trap the native View Transitions API omits — under `prefers-reduced-motion`, a slide change (forward + reverse) must swap instantly (`transitionPlayed:false`, `neverObserved` animated); motion-allowed baseline animates. Passes `assertConformanceSuite` (schema test green). Folded into the named deck a11y vector set (#1195). Homed conceptually in webtraits per #1175; the WE-owned vector half (#899/#1016), driver downstream.
