---
kind: story
size: 5
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/data-transfer/DataTransferZoneElement.ts
tags: []
---

# Build data-transfer FUI block impl

Build the data-transfer drop-zone runtime in `fui:blocks/data-transfer/` (contract: we:src/_data/blocks/data-transfer.json). Collapse DnD + clipboard paste + `<input type=file>` into one normalized receive event under a declared accepts (type/size) contract, dispatch reject on failure, keyboard/a11y file-picker, copy-vs-move via drag dropEffect, copy-out emit half. locus frontierui. Slice of #904.

## Built (batch-2026-06-18)

Shipped in **frontierui** at `blocks/data-transfer/`:

- **`fui:normalize.ts`** (DOM-free, `pureLogicSplit`) — `normalizeDataTransfer` (DataTransferItemList +
  files/getData fallback), `normalizeFileList`, `evaluateAccept` (kind/type/size → reasons),
  `kindForType`, `typeMatches` (glob), plus types (`NormalizedPayload/Item`, `AcceptSpec`,
  `RejectReason`) + `DEFAULT_ACCEPT` (permissive — `permissiveDefault`).
- **`fui:DataTransferZoneElement.ts`** — the `<data-transfer>` element + `registerDataTransferZone`
  (parameterized #841). Single funnel (`#ingest`): drag-drop + paste + `<input type=file>` all
  collapse to one normalized `receive` (cancelable) / `reject` decision under the attribute-declared
  accepts contract (`accept`/`accept-kinds`/`max-size`/`effect`). Keyboard-primary picker (always-
  present hidden input behind a real button). Copy-out `emit` half (`setEmitPayload` →
  dragstart/copy writes via setData). Native-first: DataTransfer/DragEvent/ClipboardEvent only.
  Re-exports the pure surface so all contract `exports` resolve from the element module.
- **FUI `fui:src/_data/blocks.json`** — new `data-transfer` family entry.

Gate: `check:standards` green (0 errors; 31 blocks), 16 vitest specs pass, `tsc` clean.
