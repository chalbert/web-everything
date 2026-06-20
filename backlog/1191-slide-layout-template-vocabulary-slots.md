---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:slide-layout-template"
relatedProject: webcomponents
tags: [deck, layout-template, slots, webcomponents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide layout-template vocabulary (title/section/two-col/code/image/quote)

A **slot-based layout-template vocabulary** — title, section divider, two-column, code, image+caption, quote — that named slides fill. A semantic + slot vocabulary composing webcomponents + webexpressions; homed in **webcomponents**. *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `slide-layout-template` in **webcomponents** (`we:src/_data/intents/slide-layout-template.json`): the named slot-based vocabulary (title/section/two-column/code/image/quote/blank) with a per-template slot contract; `template` + `content` (slot vs expression) axes. Names the vocabulary + slot contract, not the visual styling (FUI owns the components). Composes the #1180 document-model `layout` field and webexpressions. Auto-renders at `/intents/slide-layout-template/`.
