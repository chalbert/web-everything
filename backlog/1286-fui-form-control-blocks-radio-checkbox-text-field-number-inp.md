---
kind: story
size: 5
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: [fui, gap, dogfood, plateau-app]
---

# FUI form-control blocks (radio, checkbox, text-field, number input) — gap blocking plateau-app configurator dogfood

FUI ships droplist/type-ahead/selection but NO basic form-control blocks: radio, checkbox, single-line text-field, number input. The #1254 plateau-app dogfood found its Intent Configurator (we:plateau:src/intent-configurator/configurator.ts) and Technical Configurator (we:plateau:src/technical-configurator/configurator.ts) are hand-rolled over these missing controls, so those surfaces are could-not-split until FUI ships them. Per first-party-dogfood, the residue is a gap to file. locus: frontierui. Unblocks the two configurator migration slices once shipped.
