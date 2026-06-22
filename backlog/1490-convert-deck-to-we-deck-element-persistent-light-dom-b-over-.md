---
kind: story
size: 5
parent: "1442"
locus: frontierui
status: resolved
blockedBy: ["1457"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/blocks/deck/DeckElement.ts
tags: []
---

# Convert deck to we-deck element (persistent light-DOM B) over retained DeckBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give deck its styled is-a form. Add a persistent light-DOM we-deck element (B-family) hosting the existing fui:blocks/deck/DeckBehavior.ts kernel, carrying FUI styling and a CEM surface (the #463/#855 generation target). The element re-adds the observed-attribute/CEM surface DeckBehavior:25-26 deliberately omitted — that CEM is now a feature (framework flavors + turnkey styled component), its drift a maintenance cost not a merit downside. Retain DeckBehavior as the headless can-do capability. Slides stay light-DOM [data-slide], never shadowed. Codified in we:docs/agent/block-standard.md §7.

## Progress

Landed (locus frontierui; deck has no WE block-contract JSON — it realizes protocols — so this is FUI-only; locus field was missing, added):
- `fui:blocks/deck/DeckElement.ts` — new persistent light-DOM `<we-deck>` element (B-family, mirrors `fui:blocks/stepper/StepperElement.ts`). Hosts the existing `DeckBehavior` kernel on connect, carries FUI light-DOM styling under the `we-deck` scope class (no shadow; #1349 S1), and **re-adds the CEM attribute surface the kernel omitted** (`boundary` stop/loop/rewind, `slide`) + typed `next`/`prev`/`goTo` — that surface is a feature on the element (the #463/#855 generation target), its upkeep a maintenance cost not a downside. `[data-slide]`s stay light-DOM children. Idempotent overridable-tag `registerDeck(tag='we-deck')` (#841).
- `fui:blocks/deck/DeckBehavior.ts` — dropped the empty placeholder register fn (now the real one in the element file); kernel stays the headless can-do capability (#1457).
- `fui:blocks/deck/index.ts` — re-export `DeckElement`/`registerDeck`/`WE_DECK_CSS` from the element file (was re-exporting the empty `registerDeck` from the behavior).
- `fui:blocks/__tests__/unit/deck/DeckElement.test.ts` — 7 cases (idempotent register, host-on-connect, next/prev + delegated controls, boundary stop, boundary loop wrap, live slide attr, light-DOM/no-shadow). Existing deck conformance 4/4 untouched; `check:standards` (frontierui) 0 errors.
