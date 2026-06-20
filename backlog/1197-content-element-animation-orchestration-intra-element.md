---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:animation-orchestration"
relatedProject: webintents
tags: [deck, motion, animation, webintents, general]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Content/element animation orchestration (intra-element build-ins)

Orchestrate **intra-element** animation — SVG draw-on, staggered build-ins — distinct from slide-transition (#4) and fragment-reveal (#2). An intent/behavior over `motion`, homed in **webintents**. **General, not deck-specific** — any page wants it; the deck merely consumes it (further evidence the webdecks-project bar stays unmet). *New contract.* (Patches a coverage gap the relatedReport omitted.)

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `animation-orchestration` in **webintents** (`we:src/_data/intents/animation-orchestration.json`): intra-element build-ins (SVG draw-on, staggered reveals) and how they relate in time — axes `sequence` (parallel/stagger/chain), `trigger` (on-view/on-step/on-scroll), `replay` (once/re-enter). Explicitly distinct from slide-transition (#1183) and fragment-reveal (#1181); composes Motion (reduced-motion). General across content surfaces, not deck-specific. Auto-renders at `/intents/animation-orchestration/`.
