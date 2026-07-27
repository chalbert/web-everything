---
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, dark-theme, a11y, v68-convergence, slice-2555]
---

# Console board dark theme skins card/rail/cell surfaces, not just accents

The board declares dark support (`plateau-app:src/backlog-view/lane-board.css` carries
`:root[data-theme="dark"]` / `prefers-color-scheme: dark` overrides). But mounted in dark at 1440w, only the
**accents** darken — the breadcrumb, the primary buttons, the infra banner, a few chips. Every **surface**
stays light: the lane cells, the cards, the left composer + glossary rail, the cross-lane span card, the
ready-to-queue cards, and the off-lane pool card all render white on a near-black page. The result is broken
and low-contrast in dark.

## Measured evidence
- Headless dark mount (`data-theme=dark`, PR #112 build) shows white cards / white rails / white lane cells on
  a dark body. Only accent selectors flip.
- Root cause: the base tokens the board consumes — `--color-surface`, `--color-surface-card`, `--color-border`,
  `--color-text`, `--color-text-secondary` — come from `plateau-app:src/styles/theme.css`, which is
  **light-only** globally (the app committed to light; the board carries its own scoped dark override). The
  board's dark override only re-colours a handful of accent elements (`.lb-verb`, `.lb-composer-submit`,
  `.lb-lev`, `.lb-infra-resume`), never the surface/border/text tokens — so cards keep their light values.
- Note: the v68 baseline is a light rendering; there is no committed dark baseline, so this is judged by eye,
  not by the comparator. It is nonetheless a real defect for anyone using the board in dark.

## Scope
- Under the board's dark scope (`:root[data-theme="dark"] .lb-root`, `.lb-root[data-theme="dark"]`, and the
  `prefers-color-scheme: dark` fallback), give the board a **complete** dark token set: surface, surface-card,
  border/border-light, text, text-secondary, text-muted — so every `.lb-*` surface reads as dark.
- Keep the ratified colour grammar (green/teal/purple/amber/red) legible and WCAG-AA on the dark surface (lift
  where needed, as the ruling-surface dark override already does).
- Cover the composer, glossary, lane cells, cards, cross-lane span, ready-queue, and off-lane pool.

## Acceptance
A dark mount at 1440w renders every board surface on a dark background with AA-legible text and grammar
colours — no white cards/rails/cells on a dark page. Light rendering is unchanged (still matches v68).
