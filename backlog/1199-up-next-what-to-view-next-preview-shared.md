---
type: idea
workItem: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:up-next"
relatedProject: webintents
tags: [deck, up-next, webintents, advanceable-media, general]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# "Up next" / what-to-view-next preview (cross-media)

An **up-next preview intent** — what comes next in the sequence — **shared with video playlists & carousel**. A member of the advanceable-sequence family (#1179); homed in **webintents**. *New contract.* (Patches a coverage gap the relatedReport omitted.)

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `up-next` in **webintents** (`we:src/_data/intents/up-next.json`): the cross-media what-comes-next preview (deck next-slide peek · video up-next · carousel peek), member of #1179. Axes `depth` (next/queue), `surface` (persistent/on-approach, composing #1188 timed-advance), `action` (preview/skip). Complement to the #1187 overview-grid (whole-deck) — up-next is forward-bounded. Auto-renders at `/intents/up-next/`.
