---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build data-transfer FUI block impl

Build the data-transfer drop-zone runtime in `fui:blocks/data-transfer/` (contract: we:src/_data/blocks/data-transfer.json). Collapse DnD + clipboard paste + `<input type=file>` into one normalized receive event under a declared accepts (type/size) contract, dispatch reject on failure, keyboard/a11y file-picker, copy-vs-move via drag dropEffect, copy-out emit half. locus frontierui. Slice of #904.
