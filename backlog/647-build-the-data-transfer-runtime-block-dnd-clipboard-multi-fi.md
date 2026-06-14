---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: []
---

# Build the data-transfer runtime block — DnD/clipboard/multi-file upload behavior implementing the data-transfer intent

The `data-transfer` intent (#007 — the typed-payload + accepts contract behind the native `DataTransfer` shared by clipboard and drag events) is **spec-only: it has no active runtime block**, so any app needing drag-and-drop / paste / multi-file upload hand-rolls the `dragover`/`drop`/`paste` handlers. Build the runtime block implementing the intent: a drop-zone that declares what it `accepts` (type/size), normalizes `DataTransfer` items from drag, clipboard paste, and `<input type=file>` into one payload event, with the keyboard/a11y affordance and the copy-vs-move flow. Surfaced + GAP-tagged by the loan-origination exercise app's S5 document upload (#383).
