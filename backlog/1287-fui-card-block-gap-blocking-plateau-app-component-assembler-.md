---
kind: story
size: 3
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: [fui, gap, dogfood, plateau-app]
---

# FUI card block — gap blocking plateau-app Component Assembler dogfood

FUI has no card block (verified against fui:blocks/* — 43 blocks, none a card). The #1254 plateau-app dogfood found its Component Assembler (we:plateau:src/component-assembler/assembler.ts) hand-rolls cards (tabs + code-view already exist in FUI), so that surface is could-not-split until FUI ships a card. Per first-party-dogfood, file the gap. locus: frontierui. Unblocks the Component Assembler migration slice once shipped.
