---
kind: story
size: 2
parent: "1599"
status: resolved
blockedBy: ["1785"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1599
tags: []
---

# Migrate code surfaces in we:project/plug includes + top-level pages to FUI code-view

Migrate the ~19 `<pre>`/code-frame surfaces across `we:src/_includes/project-*.njk` + `we:src/_includes/plug-descriptions/` + remaining `we:src/_includes/` + top-level `we:src/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

## Progress (batch-2026-06-26-1745-1775)

Cascade of #1785 (same model as the sibling #1605). Wrapped every `<pre>` code surface across the
`we:src/_includes/project-*.njk` + `we:src/_includes/plug-descriptions/*.njk` + the `source-toggle`/
`strategy-toggle` includes + `we:src/presets.njk` in `<we-code-view>` (62 surfaces over 19 files; balanced
62/62, no double-wraps). Light-DOM `<pre>` = the SSR baseline; hydrates on upgrade (progressive enhancement).
Gate: `npm run verify` (11ty) clean (4209 files); safe-by-degradation render as in #1605 (the SSR baseline
renders; live upgrade verifies when the FUI origin is reachable).
