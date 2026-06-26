---
kind: story
size: 2
parent: "1599"
status: open
blockedBy: ["1785"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate code surfaces in we:project/plug includes + top-level pages to FUI code-view

Migrate the ~19 `<pre>`/code-frame surfaces across `we:src/_includes/project-*.njk` + `we:src/_includes/plug-descriptions/` + remaining `we:src/_includes/` + top-level `we:src/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.
