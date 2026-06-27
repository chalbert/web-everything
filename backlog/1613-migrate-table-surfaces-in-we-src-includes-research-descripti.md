---
kind: story
size: 8
parent: "1600"
status: open
blockedBy: ["1867"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:src/_includes/research-descriptions to FUI data-table

Migrate the ~98 `<table>` surfaces in `we:src/_includes/research-descriptions/*.njk` to FUI blocks/renderers/data-table via the **transient-CE mount** (`<we-data-table>`, #1621 rule-7 model — the data-table counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1787 (the FUI `fui:embed/data-table-in-document.ts` embed entry + SSR baseline). Largest + most heterogeneous family (bespoke prior-art/comparison matrices per research doc) — a 3rd-level /slice target: slice by topic-cluster once the simpler families prove the transform. Not count-chunked now (avoids arbitrary fragmentation). Gate npm run verify + a :8080 render check.
