---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: []
---

# Build the data-transfer runtime block — DnD/clipboard/multi-file upload behavior implementing the data-transfer intent

The `data-transfer` intent (#007 — the typed-payload + accepts contract behind the native `DataTransfer` shared by clipboard and drag events; dims: flow/payload/acceptance) is **spec-only — it has no active runtime block**, so any app that needs drag-and-drop / paste / multi-file upload must hand-roll the `dragover`/`drop`/`paste` handlers. Build the runtime block/behavior implementing the intent: a drop-zone that declares what it `accepts` (type/size), normalizes `DataTransfer` items from drag, clipboard paste, and `<input type=file>` into one payload event, with the a11y + keyboard affordance and the copy-vs-move flow. Surfaced by the loan-origination exercise app's S5 document upload (#383), which GAP-tags it. Driven by the exercise-app conformance loop — the app is the forcing function.
