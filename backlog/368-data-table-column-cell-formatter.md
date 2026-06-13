---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-12"
tags: [data-table, collection-operations, formatter, exercise-app-discovery]
crossRef: { url: /backlog/317-exercise-app-loan-origination/, label: "Surfaced consuming data-table in exercise app A (#317)" }
---

# Data Table — per-column cell formatter / renderer

Gap surfaced when the loan-origination exercise app ([#317](/backlog/317-exercise-app-loan-origination/))
became the data-table block's first enterprise consumer. The block renders each cell as the raw value's
text, so a currency column shows `502024` (not `$502,024`) and a status column shows plain text (no
chip). The **sort key must stay the raw value** (so `Intl.Collator` natural order works), so the fix is
not "pass formatted strings" — the `Column` contract needs a **display formatter** separate from the
sort value.

## Proposal

- Add an optional `format?: (value: Cell, row: Row) => string | Node` to `Column` (sort still runs on the
  raw `field` value; only the rendered cell uses `format`).
- A `Node` return enables rich cells (status chips, links) while a `string` return covers currency/dates
  via `Intl.NumberFormat` / `Intl.DateTimeFormat` (native-first).
- Keep the audit/contract intact: formatting is presentational, must not affect `aria-sort` or order.

## Design notes (recommended)

- Does rich-cell content belong to data-table, or to a future status/badge standard ([#354]) the column
  composes? (Likely: formatter returns a node produced by the status standard.)
- Escaping/safety for string formatters (textContent, never innerHTML).
