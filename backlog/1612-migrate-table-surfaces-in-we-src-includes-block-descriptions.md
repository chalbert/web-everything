---
kind: story
size: 5
parent: "1600"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:src/_includes/block-descriptions to FUI data-table

Migrate the ~56 `<table>` surfaces in `we:src/_includes/block-descriptions/*.njk` to FUI blocks/renderers/data-table via the mode-C inline mount proven by #1598. Heterogeneous (per-block table shapes) — a 3rd-level /slice candidate if it stays >3 after the project/plug families prove the per-family configs. Gate npm run verify + a :8080 render check.
