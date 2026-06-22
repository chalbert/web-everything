---
kind: story
size: 13
parent: "866"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs table surfaces to FUI blocks/renderers/data-table (mode-C mount)

Migrate the ~225 `<table>` surfaces (largest; scattered across `we:src/*.njk` + hundreds of `we:src/_includes/{block,research}-descriptions/*.njk`, no shared macro) to FUI blocks/renderers/data-table via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check. A 2nd-level /slice target — slice by include-family (block-descriptions / research-descriptions / project-* / top-level), each family ~≤3.
