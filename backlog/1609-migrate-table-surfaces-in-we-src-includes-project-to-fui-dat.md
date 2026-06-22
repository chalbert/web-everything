---
kind: story
size: 3
parent: "1600"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:src/_includes/project-* to FUI data-table

Migrate the ~33 `<table>` surfaces in `we:src/_includes/project-*.njk` to FUI blocks/renderers/data-table via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check.
