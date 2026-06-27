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

# Migrate code surfaces in we:src/_includes/research-descriptions to FUI code-view

Migrate the ~18 `<pre>`/code-frame surfaces in `we:src/_includes/research-descriptions/*.njk` to FUI blocks/code-view (#924) via the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1785 (the FUI `fui:embed/code-view-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

> **Pre-flight (batch-2026-06-26-1732-1696):** the body premise "mode-C inline mount proven by #1598" was **stale** — #1598 was the *badge* migration, which #1621 pivoted to the transient-CE model (retiring mode-C). The code-view analogue needs a FUI `fui:embed/code-view-in-document.ts` registering `<we-code-view>` (the #1758 counterpart), which **does not exist yet**, plus an SSR/FOUC-baseline decision for a *shadow-DOM* transient CE. Filed that prerequisite as **#1785** and re-pointed `blockedBy: ["1785"]`. Released unbuilt.

## Progress (batch-2026-06-26-1745-1775)

Cascade-freed by #1785 (the `fui:embed/code-view-in-document.ts` entry + `we-code-view{}` SSR baseline).
Wrapped every `<pre>` code surface across `we:src/_includes/research-descriptions/*.njk` in `<we-code-view>`
(152 surfaces over 18 files — the body's "~18" was a file count; balanced 152/152, no double-wraps). Each
keeps its light-DOM `<pre><code>` (the SSR-visible baseline) and the element hydrates from it on upgrade
(progressive enhancement, the #1785 model).

Gate: `npm run verify` (11ty build) clean (4209 files); :8080 render check on a migrated page
(`/research/ui-configuration/`) via Playwright — 9 `<we-code-view>` render with the code visible. The live
cross-origin UPGRADE wasn't exercised here because the configured `links.frontierUrl` FUI origin isn't
resolvable in this dev probe (same condition as the shipped #1758 badge entry) — the silent `.catch()`
degrades to the SSR baseline exactly as designed, so the page renders correctly either way. Full
hydration verifies when the FUI origin is reachable (prod / a FUI-origin dev session).
