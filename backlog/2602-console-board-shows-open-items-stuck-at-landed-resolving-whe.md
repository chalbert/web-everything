---
bornAs: x8vx79a
kind: task
status: open
relatedTo: ["2509", "2555"]
tags: [plateau-loop, console, console-board, read-model, bug]
dateOpened: "2026-07-22"
---

# Console board shows open items stuck at "landed — resolving" when a non-resolve lane PR merged

Observed on `/console-board` (localhost:4000): multiple items sit permanently at **"landed — resolving"**
(UC-D1) in the drain lane. It is NOT a hung operation — no in-flight write, no failed poll, no console
errors. It is a read-model over-interpretation.

## Root cause
`plateau:src/backlog-view/lane-board-data.ts` `overlayToSignals` sets `sig.resolving = true` for **any**
item whose overlay carries a *merged* PR that isn't `status: resolved` yet (comment: "the resolve step runs
next"). But the overlay PR join (`plateau:src/backlog-view/overlay.ts`, `LEADING_LANE_NUM`) matches **any**
`lane/<num>-*` branch — build, resolve, slice, note, fix. So an item that stays legitimately OPEN after a
slice / note / fix PR merges reads as "resolving" forever (it never flips to resolved). The same merged PR
also makes `isInFlight` true, pinning the item to the drain lane.

Confirmed: the stuck cards (e.g. #2550, #2587, #2588, #2555, #2450, #2423) are all `status: open` on
origin/main, each with a merged non-resolve `lane/<num>-*` PR. Several were produced by an overnight batch
that merged doc-note / slice PRs on items that stay open by design.

## Fix
Gate BOTH the `resolving` signal and `isInFlight`'s merged-PR case on the merged PR being the item's **resolve
lane** (`lane/<num>-resolve[-…]`):
- Thread the PR's `headRefName` through the overlay (`OverlayState.pr`, a WE type-only contract field).
- `resolving = true` only for a merged resolve PR (UC-D1 stays transient, and a genuinely stuck resolve — a
  `-resolve` PR merged but status never flipped — still surfaces).
- A merged slice/note/fix PR (or a closed PR) is landed history, not live work → not in-flight → the open item
  renders by its durable status (ready-to-queue if unblocked, else off the working set), not stuck in a lane.
- Fail safe: a missing `headRefName` is treated as non-resolve, so an item is never falsely stuck "resolving".

## Acceptance
An open item whose only merged PR is a non-resolve `lane/<num>-*` branch does NOT render "resolving" and does
NOT occupy the drain lane; a merged `lane/<num>-resolve` PR on a not-yet-resolved item still reads UC-D1
"resolving". `plateau` `npm test` + `we:` `check:standards` pass; board sighted in both themes.
