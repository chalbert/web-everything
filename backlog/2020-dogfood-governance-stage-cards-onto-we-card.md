---
kind: story
size: 3
parent: "777"
status: open
blockedBy: ["2016"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: [dogfood, fui, ssr, governance]
---

# Dogfood governance stage cards onto we-card (SSR)

## Digest

`we:src/governance.njk` renders its lifecycle/stage cards as hand-styled `div`s with inline CSS and no `we-*`
components. Convert the stage cards to SSR-rendered `we-card` (with `we-badge` for stage status where present),
using the #2016 render path. Content-driven but structurally regular — a clean card conversion.

## Scope

- Replace hand-styled stage-card `div`s in `we:src/governance.njk` with `we-card` tiles via the #2016 SSR
  shortcode; move any stage status onto `we-badge`.
- Retire the now-dead inline card CSS in favor of the component's token-driven styling.
- Keep the JS-off baseline correct.

## Acceptance

- Governance stage cards render as SSR `we-card`; correct with JS disabled.
- Playwright before/after on the running dev server — no visual regression, 0 console errors.
- No remaining hand-styled stage-card `div`s / inline card CSS in `we:src/governance.njk`.

## Notes

- Depends on #2016. Any tabular governance content stays out until #1964 is settled.
