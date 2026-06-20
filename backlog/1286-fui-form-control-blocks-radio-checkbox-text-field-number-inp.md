---
kind: story
size: 13
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: [fui, gap, dogfood, plateau-app]
---

> **Not batchable as one — needs slicing (sized 5 → 13, batch-2026-06-20 pre-flight).** This is **4
> greenfield a11y form-control components** (radio / checkbox / single-line text-field / number input),
> and FUI ships **no** existing simple-form-control to scaffold from (only `fui:blocks/rich-text-editor`
> + `fui:blocks/text-nodes`) — each control is built from scratch (CustomElement + a11y + the
> `we:src/_data/intents/input.json` / `we:src/_data/intents/selection.json` contract it implements + unit/e2e tests + a
> `fui:src/_data/blocks.json` catalog entry to pass the #784 completeness gate + a demo). The card is also
> a **pure gap-marker** (zero per-control spec/acceptance — below DoR). Slice into per-control builds
> (one item each, mapping to the input/selection intents) — same class as sibling gap #1289. Then each
> slice is a clean batchable build.

# FUI form-control blocks (radio, checkbox, text-field, number input) — gap blocking plateau-app configurator dogfood

FUI ships droplist/type-ahead/selection but NO basic form-control blocks: radio, checkbox, single-line text-field, number input. The #1254 plateau-app dogfood found its Intent Configurator (we:plateau:src/intent-configurator/configurator.ts) and Technical Configurator (we:plateau:src/technical-configurator/configurator.ts) are hand-rolled over these missing controls, so those surfaces are could-not-split until FUI ships them. Per first-party-dogfood, the residue is a gap to file. locus: frontierui. Unblocks the two configurator migration slices once shipped.
