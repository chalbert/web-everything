---
kind: story
size: 3
parent: "1599"
status: open
blockedBy: ["1785"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate code surfaces in we:src/_includes/block-descriptions to FUI code-view

Migrate the ~34 `<pre>`/code-frame surfaces in `we:src/_includes/block-descriptions/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). One block-description family. Gate npm run verify + a :8080 render check.
