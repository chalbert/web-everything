---
kind: epic
parent: "777"
status: open
blockedBy: ["2016"]
dateOpened: "2026-07-01"
tags: [dogfood, fui, ssr, detail-pages, epic]
---

# Dogfood the WE-docs detail-page + content templates onto WE components (sweep)

## Digest

Beyond the catalog index pages, the **detail** and **content** templates are still 100% hand-rolled: the
`*-pages.njk` detail generators (`we:src/backlog-pages.njk`, `we:src/block-pages.njk`, `we:src/adapter-pages.njk`,
`we:src/intent-pages.njk`, `we:src/plug-pages.njk`, …) plus content pages (`we:src/research.njk`,
`we:src/semantics.njk`, `we:src/demos.njk`). These carry hand-authored cards, sections, and tables. This epic
sweeps them onto SSR `we-card`/`we-badge`/`we-tag` (via #2016), one template-family per slice, so the whole site —
not just the catalog indexes — renders from our own components.

This is an **epic**: slice per template family (detail-page generators; research/semantics/demos content). Slices
to be authored once #2016 lands and the first index conversions (#2018–#2020) prove the pattern at scale.

## Scope (to be sliced)

- Detail-page generators (`we:src/*-pages.njk`): card/section chrome → `we-card` + badge/tag; **table content
  excluded** until #1964 resolves wrap-vs-render-from-data.
- Content pages (`we:src/research.njk`, `we:src/semantics.njk`, `we:src/demos.njk`): custom layouts → components.
- Each slice: independent, dev-ready, Playwright before/after, JS-off baseline correct.

## Acceptance (epic)

- Every child slice resolved; a repo-wide check shows no hand-rolled card/badge/tag surfaces remain outside
  deliberately-excluded (table-shaped, #1964-gated) content.
- Feeds the per-page rollout ratchet #867.

## Notes

- Depends on #2016. Coordinate table surfaces with #1964. Companion to the ratchet story #867.
