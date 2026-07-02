---
kind: story
size: 3
parent: "2015"
status: open
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
tags: []
---

# FUI: text-field + number-input to persistent host (keep factory parity)

Migrate fui:blocks/text-field/TextFieldElement.ts and fui:blocks/number-input/NumberInputElement.ts off transient self-erasure: both already build the full <div class=fui-*>…<input> structure via their factory in decorate (fui:blocks/text-field/TextFieldElement.ts:39-44, fui:blocks/number-input/NumberInputElement.ts:34-38) — the migration makes the host persist instead of self-erasing, keeping factory↔element parity single-renderer (no second render path). Update both blocks' unit tests. Locus: frontierui.
