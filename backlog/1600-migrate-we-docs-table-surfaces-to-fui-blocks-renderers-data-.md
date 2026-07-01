---
kind: epic
parent: "866"
status: resolved
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Migrate WE-docs table surfaces to FUI blocks/renderers/data-table (transient-CE mount)

Umbrella for migrating the ~225 `<table>` surfaces (largest; no shared macro) to FUI
blocks/renderers/data-table via the **transient-CE mount** (`<we-data-table>`, #1621 rule-7 model — the
data-table counterpart to the #1598/#1758 badge dogfood; the original "mode-C inline mount proven by #1598"
framing was **stale**, #1598 was the badge migration that #1621 pivoted off mode-C). **2nd-level slice
(2026-06-22, `/slice`, see relatedReport)** — split by include-family, each child `blockedBy #1787` (the
FUI `fui:embed/data-table-in-document.ts` embed entry, re-pointed from the retired #1598, batch-2026-06-26). Three families land
≤3; the two largest are heterogeneous bulk isolated (not count-chunked — avoids arbitrary fragmentation)
and stay 3rd-level `/slice` targets:

- **#1609** — `we:src/_includes/project-*` (~33) · size 3 · *ready*
- **#1610** — `we:src/_includes/plug-descriptions/` (~22) · size 3 · *ready*
- **#1611** — `we:src/_includes/adapter-descriptions/` + top-level `we:src/*.njk` (~10) · size 2 · *ready*
- **#1612** — `we:src/_includes/block-descriptions/` (~56) · size 5 · *3rd-level /slice candidate*
- **#1613** — `we:src/_includes/research-descriptions/` (~98) · size 8 · *3rd-level /slice target (by topic-cluster)*
