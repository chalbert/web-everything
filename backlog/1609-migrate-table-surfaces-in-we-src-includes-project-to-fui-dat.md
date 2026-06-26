---
kind: story
size: 3
parent: "1600"
status: open
blockedBy: ["1787"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate table surfaces in we:src/_includes/project-* to FUI data-table

Migrate the ~33 `<table>` surfaces in `we:src/_includes/project-*.njk` to FUI blocks/renderers/data-table via the **transient-CE mount** (`<we-data-table>`, #1621 rule-7 model — the data-table counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1787 (the FUI `fui:embed/data-table-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.
