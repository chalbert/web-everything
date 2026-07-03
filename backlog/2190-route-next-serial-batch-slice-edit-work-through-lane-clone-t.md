---
kind: story
size: 8
status: resolved
blockedBy: ["2183", "2189"]
relatedTo: ["104", "2123", "2138", "2178"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [pr-flow, lanes, batch, next, slice, close-out]
---

# Route /next, serial /batch, /slice edit work through lane-clone → ready-to-merge PR

Spin-off (c) of #2183 — the **per-path PR routing** slice, F3-second (after `/workflow`, #2189). Today the
solo/serial edit paths (`/next`, the serial `/batch`, `/slice`) still commit **direct to `main`**. Under
#2183 direction 1, main only ever moves via a PR merge, so these paths must instead work a **lane clone →
ready-to-merge PR**, exactly like the parallel path now does.

## Scope

- `/next` (single-item build), the **serial** `/batch` loop, and `/slice`'s on-disk write each move their
  edit work into a lane clone (`we:scripts/lane-pool.mjs`), claim-in-lane, work, resolve, commit, open a
  `ready-to-merge`-labelled PR (`we:scripts/pr-land.mjs --no-wait`), and STOP — no direct-to-main commit.
- Every path's **close-out** changes: the closing-session / batch close no longer expect work on local
  `main`; the "did it land" audit reads open PRs, not the working tree.

## Reshapes #104 (commit-on-current-branch)

#104 says "commit on the checked-out branch, never branch-first." Lane clones are not shared-checkout
branches — each is its own clone with its own HEAD — so this **composes** with #104 rather than violating it
(no `checkout -b` on the shared tree). But the invariant's phrasing ("commit on main") no longer describes
the edit paths; #104 must be re-scoped to "commit on the lane clone's HEAD; main advances only via PR merge."

## Open sub-questions (carry to design)

- **Cross-session claim visibility.** With the claim riding a PR instead of a main commit, two sessions can
  both pick one open item. Decide the signal readiness reads to avoid double-claim (a pushed claim ref? a
  short-lived reservation? accept-and-heal at drain time via the #2071 id/dup heal?). This is the residual
  #2189 left open.
- Whether `/slice` (which only writes new backlog items, no code) needs the full lane-PR path or a lighter
  decision-authoring route shared with #2187.

## Acceptance

- `/next`, serial `/batch`, and `/slice` make **zero commits to `main`**; each completed item is an open
  ready-to-merge PR.
- #104 is re-scoped in `we:docs/agent/*` to the lane-clone-HEAD model.
