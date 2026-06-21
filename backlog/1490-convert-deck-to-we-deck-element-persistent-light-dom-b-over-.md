---
kind: story
size: 5
parent: "1442"
status: open
blockedBy: ["1457"]
dateOpened: "2026-06-21"
tags: []
---

# Convert deck to we-deck element (persistent light-DOM B) over retained DeckBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give deck its styled is-a form. Add a persistent light-DOM we-deck element (B-family) hosting the existing fui:blocks/deck/DeckBehavior.ts kernel, carrying FUI styling and a CEM surface (the #463/#855 generation target). The element re-adds the observed-attribute/CEM surface DeckBehavior:25-26 deliberately omitted — that CEM is now a feature (framework flavors + turnkey styled component), its drift a maintenance cost not a merit downside. Retain DeckBehavior as the headless can-do capability. Slides stay light-DOM [data-slide], never shadowed. Codified in we:docs/agent/block-standard.md §7.
