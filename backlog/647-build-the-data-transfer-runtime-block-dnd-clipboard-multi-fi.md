---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:data-transfer (blocks/data-transfer/) — <data-transfer-zone> runtime implementing intent #007: drop/paste/file-input → one receive event under an accepts contract"
tags: []
---

# Build the data-transfer runtime block — DnD/clipboard/multi-file upload behavior implementing the data-transfer intent

The `data-transfer` intent (#007 — the typed-payload + accepts contract behind the native `DataTransfer` shared by clipboard and drag events) is **spec-only: it has no active runtime block**, so any app needing drag-and-drop / paste / multi-file upload hand-rolls the `dragover`/`drop`/`paste` handlers. Build the runtime block implementing the intent: a drop-zone that declares what it `accepts` (type/size), normalizes `DataTransfer` items from drag, clipboard paste, and `<input type=file>` into one payload event, with the keyboard/a11y affordance and the copy-vs-move flow. Surfaced + GAP-tagged by the loan-origination exercise app's S5 document upload (#383).

## Progress

- Built the `data-transfer` runtime block under [blocks/data-transfer/](/blocks/data-transfer/) implementing intent #007:
  - [we:normalize.ts](/blocks/data-transfer/normalize.ts) — DOM-free normalization + acceptance: `normalizeDataTransfer` (drop/paste, reads `DataTransferItemList` with a `files`+`getData` fallback), `normalizeFileList` (file input), `evaluateAccept` (kind/type/`type/*` wildcard/size), `kindForType`, `typeMatches`.
  - [we:DataTransferZoneElement.ts](/blocks/data-transfer/DataTransferZoneElement.ts) — the `<data-transfer-zone>` custom element. **Single funnel:** drag-drop, clipboard paste, and `<input type=file>` all converge on one `#ingest()` → cancelable `receive` (accepted) or `reject` (with the failed rule). Copy-vs-move via drag `dropEffect`; the `emit` half writes a queued payload onto an outgoing drag/copy (`setEmitPayload`). Keyboard/a11y path is **primary** — an always-present hidden file input behind a real `<button>`, `role="group"` + `aria-label`.
  - `registerDataTransferZone` (idempotent) + `we:index.ts` barrel.
- Registered in [fui:src/_data/blocks.json](/src/_data/blocks.json) (`implementsIntent: data-transfer`, webStandards, events, designDecisions) with description partial [we:src/_includes/block-descriptions/data-transfer.njk](/src/_includes/block-descriptions/data-transfer.njk).
- 15 unit tests ([we:__tests__/data-transfer.test.ts](/blocks/data-transfer/__tests__/data-transfer.test.ts)) — normalize, accept rules, element receive/reject/emit; all green. `tsc --noEmit` clean for the block; `check:standards` green (62 blocks); 11ty build smoke green.
- Native-first: platform `DataTransfer`/`DragEvent`/`ClipboardEvent` only, no library. Most-flexible default: a zone with no constraints is `any` acceptance.
