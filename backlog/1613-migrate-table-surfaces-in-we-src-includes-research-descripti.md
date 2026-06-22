---
kind: story
size: 8
parent: "1600"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:src/_includes/research-descriptions to FUI data-table

Migrate the ~98 `<table>` surfaces in `we:src/_includes/research-descriptions/*.njk` to FUI blocks/renderers/data-table via the mode-C inline mount proven by #1598. Largest + most heterogeneous family (bespoke prior-art/comparison matrices per research doc) — a 3rd-level /slice target: slice by topic-cluster once the simpler families prove the transform. Not count-chunked now (avoids arbitrary fragmentation). Gate npm run verify + a :8080 render check.
