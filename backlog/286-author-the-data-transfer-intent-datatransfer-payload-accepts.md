---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: data-transfer
tags: []
---

# Author the data-transfer intent (DataTransfer payload + accepts contract)

Author the data-transfer intent ruled in #007: one standalone intent grounded in the native DataTransfer object shared by event.clipboardData and event.dataTransfer. Models a typed payload (clipboard text/rich content, dropped files, dragged items) entering a zone that declares what it accepts, plus the clipboard copy/cut/paste programmatic surface (navigator.clipboard, ClipboardItem) as the copy-out half. #022's drop-target and file-revision's file-source paste/drop providers compose it rather than re-deriving payload+accepts validation. Add the intent JSON entry, /intents/ page, authoring note, and validator coverage per the catalog-render convention.

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). Spec-only authoring item; the catalog auto-renders the new entry and `check:standards`' `validateIntent` is the validator coverage.
- **Done:**
  - Registered `data-transfer` (status `concept`) in `src/_data/intents.json` per #007's Option-B ruling, with three UX-only dimensions — `flow` (receive | emit | both), `payload` (text | rich | files | items), `acceptance` (declared | any) — a `DataTransfer`-grounded description, an Interface Protocol (`accepts?: Payload[]` allow-list), three `designSystemResearch` entries (native DataTransfer, Async Clipboard API, HTML Drag-and-Drop), and `events` (receive/emit/reject).
  - Composition documented from the intent side: drop-target (#022) is a `receive`+`declared` zone composing it; file-revision's `file-source` consumes it; the clipboard `emit` (copy/cut) surface rides along as the copy-out half neither neighbour owned.
  - `/intents/data-transfer/` auto-renders (probed 200); `gen:inventory` refreshed; `check:standards` green.
