---
kind: story
size: 2
parent: "1599"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate code surfaces in we:project/plug includes + top-level pages to FUI code-view

Migrate the ~19 `<pre>`/code-frame surfaces across `we:src/_includes/project-*.njk` + `we:src/_includes/plug-descriptions/` + remaining `we:src/_includes/` + top-level `we:src/*.njk` to FUI blocks/code-view (#924) via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check.
