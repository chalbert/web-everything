---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
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

## Progress (2026-06-13) — resolved

Added `format?: (value: Cell, row: Row) => string | Node` to `Column` in [we:renderDataTable.ts](../blocks/renderers/data-table/renderDataTable.ts). Sort/filter/group are untouched — they still run on the raw `field` value, so `Intl.Collator` order is unaffected; `format` only changes the rendered cell. Extracted `cellContent(col, row)` (string|Node) used by `dataRow` — a **string** is set as `textContent` (never `innerHTML`, so escape-safe), a **Node** is appended (rich cells) — and `cellDisplayText(col, row)`, which the conformance audit's expected-text projection now uses so a formatter can't false-fail the row-order check.

**Design-note resolution:** rich-cell content stays *composed*, not owned — the formatter returns a `Node`, and that node is produced by the consumer / the status-indicator standard (#354, now resolved). The block owns only the `format` seam, not a chip vocabulary — bias-toward-separation holds. Escaping is settled (textContent path).

4 new conformance cases (string formatter renders formatted text while ascending sort stays on the raw number; Node formatter appends a rich element; HTML string is escaped, not parsed; no-formatter back-compat). Suite 34/34; gate green; no new tsc errors. The exercise-app currency columns (loan `amount`, insurance `premium`) compose this in their own loop turns (#317) — the capability they were missing now exists.
