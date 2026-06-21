---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, inline-edit, edit-in-place, editing, gap]
---

# In-place / inline edit — edit-in-place + editable cell standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): turn a displayed
value into an editor in place (click-to-edit field, editable table cell, rename-in-tree), with the
display ⇄ edit mode swap, commit / cancel (blur, Enter, Esc), validation, and keyboard + a11y semantics.
WE owns inputs (`input`), validation (`validation`), rich text (`rich-text`), and a `data-grid` block —
but **none owns the display→edit→commit lifecycle** as a reusable concern.

**Decision:** own intent vs a
behavior composing `input` + `validation` + a mode-swap contract vs a `data-grid` feature only. Verify in
prep whether [we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json) already covers
editable cells before filing the realizing work. Refs:
[we:src/_data/intents/input.json](../src/_data/intents/input.json),
[we:src/_data/intents/validation.json](../src/_data/intents/validation.json). **Needs `/prepare`.** Unsure
⇒ decision; costs nothing.
