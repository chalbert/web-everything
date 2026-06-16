---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["770"]
dateOpened: "2026-06-16"
tags: []
---

# Remediate WE-docs a11y violations + flip the rendered-site gate to enforce

The next rung of the #770 warn→enforce ratchet. The #770 gate (`tests/a11y/rendered-site-a11y.spec.ts`) shipped warn-only and surfaced real pre-existing WCAG A/AA violations across the WE-docs catalog: site-wide `color-contrast` (hundreds of nodes on `/research/`, `/backlog/`, `/intents/`), plus `document-title`/`html-has-lang` misses on some rendered pages. Fix these in the WE-docs theme/templates (`src/css/style.css` token contrast, `src/_layouts/base.njk` `<html lang>`/`<title>`), then flip each cleaned route to `enforce: true` in `tests/a11y/route-allowlist.ts` (or the whole lane via `A11Y_ENFORCE=1`) so regressions become build-blocking. Per-route ratchet — enforce is earned as each route goes green, not imposed at once.
