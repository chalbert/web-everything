---
kind: story
size: 2
parent: "1599"
status: open
blockedBy: ["1785"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-26"
tags: []
---

# Migrate code surfaces in we:src/_includes/research-descriptions to FUI code-view

Migrate the ~18 `<pre>`/code-frame surfaces in `we:src/_includes/research-descriptions/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

> **Pre-flight (batch-2026-06-26-1732-1696):** the body premise "mode-C inline mount proven by #1598" was **stale** — #1598 was the *badge* migration, which #1621 pivoted to the transient-CE model (retiring mode-C). The code-view analogue needs a FUI `fui:embed/code-view-in-document.ts` registering `<we-code-view>` (the #1758 counterpart), which **does not exist yet**, plus an SSR/FOUC-baseline decision for a *shadow-DOM* transient CE. Filed that prerequisite as **#1785** and re-pointed `blockedBy: ["1785"]`. Released unbuilt.
