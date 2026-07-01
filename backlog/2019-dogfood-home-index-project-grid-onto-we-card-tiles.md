---
kind: story
size: 3
parent: "777"
status: open
blockedBy: ["2016"]
dateOpened: "2026-07-01"
tags: [dogfood, fui, ssr, home]
---

# Dogfood the home/index project grid onto we-card tiles (SSR)

## Digest

`we:src/index.njk` (~132 lines) renders the landing project grid with hand-written `.project-card` `div`s and no
`we-*` components. Convert the grid to SSR-rendered `we-card` tiles (with `we-badge`/`we-tag` where the cards carry
status or category), using the #2016 build-time render path. Small, self-contained, high-visibility surface — good
proof that the catalog dogfood pattern (`we:src/intents.njk:56-69`) generalizes to the home page.

## Scope

- Replace `.project-card` `div`s in `we:src/index.njk` with `we-card` tiles via the #2016 SSR shortcode.
- Map any per-card status/category onto `we-badge` / `we-tag`.
- Preserve layout and responsive behavior; keep the JS-off baseline correct.

## Acceptance

- Landing page project grid renders as SSR `we-card`; correct with JS disabled.
- Playwright before/after on the running dev server — no visual regression, 0 console errors.
- No remaining hand-rolled `.project-card` markup in `we:src/index.njk`.

## Notes

- Depends on #2016.
