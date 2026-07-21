---
bornAs: xscr9v2
kind: story
size: 2
parent: "2505"
status: open
dateOpened: "2026-07-21"
tags: [plateau-loop, console, decision-surface, ruling-surface, bug]
---

# Ruling surface in-page scroll is swallowed by the app-shell scroll container

Deep-link / in-page navigation to a specific decision on the ruling surface does not scroll the decision
into view. Two callers hit it:

- The surface's own sticky-nav anchor links (`plateau-app:src/backlog-view/ruling-surface.ts` — the
  `href="#rs-d-<id>"` list). Clicking a nav pill does not move the viewport to that decision.
- The #2587 open-decision deep link (`/console-ruling?repo=…&decision=<num>`). The landed slice highlights
  the target decision (`.rs-focused`) reliably, but the accompanying `scrollIntoView` is a no-op, so the
  highlighted decision can be off-screen when the surface is taller than the viewport.

## Root cause (observed)
The ruling surface renders inside the app shell's `main.app-main`, which is the actual overflow scroller
(`overflow-y: auto`). At mount, the decisions block sits outside `main.app-main`'s reachable scroll range —
`main.scrollTop` stays `0` while the target's `getBoundingClientRect().top` resolves far negative, and a
computed scroll delta clamps to `0` (a sticky `.rs-nav` at ~167px compounds it). It is a container-geometry
issue, not a race: the position holds after the surface settles. Neither native hash-anchor scrolling nor
`scrollIntoView` moves the scroller.

## Fix direction (to investigate)
Give the ruling surface a proper inner scroll container (mirror the backlog rail's #2524 pattern in
`plateau-app:src/backlog-view/backlog-view.ts`, where `rail.scrollTop` + `scrollIntoView({block:'nearest'})`
work because `.rail` is the direct scroller), OR correct the `main.app-main` ↔ surface height/overflow so
`scroll-margin-top` anchors resolve. Once fixed, both the sticky-nav anchors and the #2587 deep-link focus
scroll correctly with no caller change (the #2587 `scrollIntoView` call is already in place, best-effort).

## Acceptance
- Clicking a sticky-nav pill scrolls that decision to the top of the surface (under the sticky nav).
- Landing on `/console-ruling?decision=<num>` scrolls the matching decision into view (not just highlights it).
- `plateau-app` `npm test` passes; a regression test asserts the focused decision is brought into the
  scroller's visible range.
