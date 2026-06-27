---
kind: story
size: 3
parent: "1599"
status: resolved
blockedBy: ["1785"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1599
tags: []
---

# Migrate code surfaces in we:src/_includes/block-descriptions to FUI code-view

Migrate the ~34 `<pre>`/code-frame surfaces in `we:src/_includes/block-descriptions/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). One block-description family. Gate npm run verify + a :8080 render check.

## Progress (batch-2026-06-26-1745-1775)

Cascade of #1785 (same model as siblings #1605/#1606). Wrapped every `<pre>` code surface across the
`we:src/_includes/block-descriptions/*.njk` family in `<we-code-view>` (125 surfaces over 34 files; balanced
125/125, no double-wraps). Light-DOM `<pre>` = SSR baseline; hydrates on upgrade (progressive enhancement).
Gate: `npm run verify` (11ty) clean; safe-by-degradation as in #1605. The #1599 code-view family is now
fully migrated (#1604/#1605/#1606 all resolved).
