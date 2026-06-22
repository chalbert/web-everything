---
kind: story
size: 2
parent: "1600"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:adapter-descriptions + top-level pages to FUI data-table

Migrate the ~10 `<table>` surfaces in `we:src/_includes/adapter-descriptions/*.njk` + top-level `we:src/*.njk` to FUI blocks/renderers/data-table via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check.
