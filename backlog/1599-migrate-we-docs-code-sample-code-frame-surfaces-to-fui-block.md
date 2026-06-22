---
kind: story
size: 8
parent: "866"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs code-sample/code-frame surfaces to FUI blocks/code-view (mode-C mount)

Migrate the ~71 `<pre>`/code-sample/code-frame surfaces across `we:src/*.njk` + `we:src/_includes/{block,research}-descriptions/` to FUI blocks/code-view (#924) via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check. Itself a 2nd-level /slice candidate (by include-family: block-descriptions / research-descriptions / project-* / top-level) once the transform is proven.
