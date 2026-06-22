---
kind: story
size: 3
parent: "1599"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate code surfaces in we:src/_includes/block-descriptions to FUI code-view

Migrate the ~34 `<pre>`/code-frame surfaces in `we:src/_includes/block-descriptions/*.njk` to FUI blocks/code-view (#924) via the mode-C inline mount proven by #1598. One block-description family. Gate npm run verify + a :8080 render check.
