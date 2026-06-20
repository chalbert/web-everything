---
kind: story
size: 3
status: resolved
blockedBy: ["770"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Remediate WE-docs a11y violations + flip the rendered-site gate to enforce

The next rung of the #770 warn→enforce ratchet. The #770 gate (`we:tests/a11y/rendered-site-a11y.spec.ts`) shipped warn-only and surfaced real pre-existing WCAG A/AA violations across the WE-docs catalog: site-wide `color-contrast` (hundreds of nodes on `/research/`, `/backlog/`, `/intents/`), plus `document-title`/`html-has-lang` misses on some rendered pages. Fix these in the WE-docs theme/templates (`we:src/css/style.css` token contrast, `we:src/_layouts/base.njk` `<html lang>`/`<title>`), then flip each cleaned route to `enforce: true` in `we:tests/a11y/route-allowlist.ts` (or the whole lane via `A11Y_ENFORCE=1`) so regressions become build-blocking. Per-route ratchet — enforce is earned as each route goes green, not imposed at once.

## Progress (resolved 2026-06-16)
Probed the real gate first (`@axe-core/playwright` on the live `:8080` site, not a guess): **every** violation was `color-contrast` (serious) — the `document-title`/`html-has-lang` misses named in the body are no longer present. Four shared offenders, fixed at the token/theme level so the whole catalog clears at once:
- `--color-text-muted` slate-500 `#64748b` → slate-600 `#475569` (the dominant offender, ~1724 nodes) in [`we:src/css/style.css`](../src/css/style.css), swept across the inline `#64748b` usages in 17 `*.njk` templates + `we:backlog-burndown.js`.
- `--color-primary` indigo-500 `#6366f1` → indigo-600 `#4f46e5` (links on white **and** white-on-indigo badges — darker bg raises white-text contrast too); hover bumped to indigo-700 `#4338ca`.
- Inline-code red One-Dark `#e06c75` → red-700 `#b91c1c` in [`we:src/css/prism-theme.css`](../src/css/prism-theme.css) (light-bg `:not(pre) > code` only; the dark-bg language-classed variant already overrides to `#abb2bf`, the `.token.*` reds on `#282c34` left untouched).
- Resolved-child muted text slate-400 `#94a3b8` → `#475569` in `we:backlog.njk`/`we:backlog-pages.njk` (text `fg` only; the matching borders left as-is — borders aren't contrast-gated).
- **9 of 10 routes now `enforce: true`** in [`we:tests/a11y/route-allowlist.ts`](../tests/a11y/route-allowlist.ts) (`/`, `/intents/`, `/blocks/`, `/protocols/`, `/adapters/`, `/capabilities/`, `/demos/`, `/governance/`, `/research/`) — build-blocking and green under enforce. `/backlog/` is held warn-only and carved to **#805**: its remaining fixes are hard-coded hexes in `we:src/backlog.njk`, which a concurrent session is mid-feature on, so this batch deliberately did not commit that file (the committed `we:style.css` token already clears its `var(--color-text-muted)` usages; only the hard-coded badge/legend hexes remain). `check:standards` green.
