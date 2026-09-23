---
bornAs: xxhf15c
kind: story
size: 2
parent: "3931"
status: open
locus: plateau-app
blockedBy: ["3938"]
dateOpened: "2026-09-22"
tags: []
---

# Move a blocked agent's card to Needs you, list unmatched agents, and tab between several agents on one card

plateau:src/wip/wip-model.ts groups a card whose agent is `blocked` into needs-you with a copyable `claude attach <id>`; unmatched runs render in a dashed strip at the end of Doing and on no card; several runs on one card render as tabs, active first. States 4, 9, 12 of plateau:docs/wip-live-agent.md §5 (default of open decision 1).

## Done when

1. **Executable** — plateau:src/wip/wip-model.test.ts and plateau:src/wip/wip-view.test.ts under `npx vitest run`: a doing card whose agent is `blocked` groups into needs-you with the attach command; two runs render two tabs with the active one selected; unmatched runs appear in the strip and on no card.
