---
kind: story
size: 3
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:pagination"
tags: [exercise-app, loan-origination, pagination, consumption-slice]
---

# Loan pipeline consumes the Pagination block (+ built its behavior)

Consumption slice of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Built the
declared-but-missing `PaginationBehavior`/`registerPagination` over the verified `renderPagination`
(delegates goto/prev/next/load-more, clamps via total, emits `pagination-change`, `<page-nav>` element,
with tests), **flipped pagination draft→active**, and windowed the 5k pipeline (Prev/Next + "Showing
51–100 of 5000"). **Resolved**: pagination reads `conformant`. Surfaced gap: data-table + pagination have
no collection-wide coordinator ([#369]).
