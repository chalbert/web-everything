---
bornAs: xscr9v2
kind: story
size: 2
parent: "2505"
status: resolved
dateOpened: "2026-07-21"
dateResolved: "2026-07-21"
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

## Delivered (plateau-app PR #94)
The precise root cause was narrower than first observed: `.app-shell.logged-off .app-main`
(`plateau-app:src/styles/layout.css`) is a **centered grid** (`place-items: center`). When content
overflows, `center` centers it *symmetrically*, so half a tall page (the ruling surface's ~17 decisions)
spills **above `scrollTop 0`** where it can't be scrolled to. It reproduced ONLY on the logged-off shell;
the logged-in shell is a plain block scroller that already worked (which is why it hid).

Fix — one line: `place-items: center` → **`place-items: safe center`** (centers content that fits, falls
back to start-alignment when it overflows, keeping the top reachable). No caller change — the #2587
`scrollIntoView` and the native `#rs-d-*` hash anchors both land once the target sits at a reachable offset
(the `.rs-decision` `scroll-margin-top` clears the sticky nav). Sighted in both themes: a deep-link to a
far-down decision scrolls it into view + highlights; a sticky-nav pill scrolls its section under the nav;
the short auth card still centers; an overflowing marketing page top-aligns and still reads correctly.

## Acceptance
- Clicking a sticky-nav pill scrolls that decision to the top of the surface (under the sticky nav).
- Landing on `/console-ruling?decision=<num>` scrolls the matching decision into view (not just highlights it).
- `plateau-app` `npm test` passes; a regression test asserts the focused decision is brought into the
  scroller's visible range.
