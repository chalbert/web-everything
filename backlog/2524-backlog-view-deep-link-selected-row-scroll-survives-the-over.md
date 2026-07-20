---
bornAs: xyyk7i8
kind: task
parent: "2505"
status: resolved
dateOpened: "2026-07-15"
dateStarted: "2026-07-20"
dateResolved: "2026-07-20"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: deep-link selected-row scroll survives the overlay re-render

On a deep link (`/backlog/:id`, #2517) the selected row is scrolled into view once on load, then the row is left where it lands. But the live build-state overlay (#2509) is fetched separately and arrives later; when it does, the rail is re-rendered by replacing `rail.innerHTML`, which resets `scrollTop` to 0 — so the deep-linked row scrolls back out of view. The detail pane is still correct and the row is still marked active; only the rail scroll position is lost.

This predates #2513 (it is not a virtualization bug — content-visibility only made it easy to observe, since the estimated row heights already make the one-shot scroll imprecise for far-down targets). The fix is to re-reveal the selected row after a rail re-render that wasn't caused by the user (e.g. the overlay arriving), and to stop re-revealing once the user has scrolled or selected something else — so an incoming overlay never yanks the viewport away from where the reader is.

**Acceptance:** after a deep link to a far-down item, the selected row stays in view once the overlay arrives (the late re-render no longer resets the scroll); a subsequent user scroll or selection is never overridden by a later re-render.
