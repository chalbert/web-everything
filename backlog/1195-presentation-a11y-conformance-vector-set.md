---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "conformance-vector suite presentation-a11y (we:conformance-vectors)"
relatedProject: webtraits
tags: [deck, a11y, conformance, webtraits]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Presentation accessibility conformance-vector set (the single conformance story)

The **named conformance-vector set** (tag `deck`) that answers "is a deck conformant?" without a project: reading order, focus management, slide-change announcement — **including** the reduced-motion-under-View-Transitions and fit-scale-hit-testing traps from slices #4/#7. This vector set is what replaces a webdecks project as the single conformance story (per #1175). Homed in **webtraits** (cross-cutting; webaudit-adjacent). *New contract (conformance).*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored conformance-vector suite `presentation-a11y` (`we:conformance-vectors/presentation-a11y.vectors.ts`, registered in `we:conformance-vectors/index.ts`) — THE single deck conformance story (tag `deck`), 5 vectors over the observable a11y surface: slide-change announcement (ARIA live region), focus lands on the new slide (never `body`), non-current slides inert/aria-hidden (reading order), the reduced-motion transition gate (composes #1183), and fit-scale pointer hit-testing (the #1186 trap). Passes `assertConformanceSuite`. Replaces a webdecks project as the conformance home per #1175.
