---
name: resolve-on-land-or-conveyor-redispatches
description: "A card whose work MERGED to main but stays status:open gets re-dispatched by the conveyor as already-done work. Land should flip the born-hash's card to resolved; until it does, a resolve-sweep is periodically needed. Recall when landing a lane PR, or wondering why the conveyor re-launched finished work."
metadata:
  type: project
---

**Observed 2026-07-26/27 (resolve-sweep):** several conveyor/delivery stories were fully
delivered and merged to `origin/main`, yet their `backlog/*.md` card was still
`status: open`. Confirmed cases: **#2609** (dispatch-plan script + scope field),
**#2611** (`scripts/readiness/conveyor-state.mjs` tick state-read), **#2614** (learnings
drop-box + close-session sweep), **#2664** (jury workflow meta pure-literal + materialFile).
Each shipped under its **born-hash** lane (`WE #2609…`, JIT-numbered to the item at land),
the merge landed the code, but nothing flipped the card's `status`.

**Why it bites:** the conveyor (#2612) reads the backlog for `buildQueued`/`open` work. An
`open` card whose code is already on main looks like fresh, unblocked work, so the conveyor
**re-dispatches a delivery agent for work that's already done** — wasted lane, wasted CI, a
no-op or conflicting PR. The card state, not the working tree, is the dispatch signal
(see [[backlog-is-the-tracker]]), so a stale `open` is an active re-launch hazard.

**The fix pattern — resolve-on-land:** the land step (drain / `pr-land`) should flip the
delivered card `status: open → resolved` (add `dateResolved`) as part of the same merge that
lands its code, keyed off the born-hash the lane branch carries. The born-hash → item-number
JIT map already exists at land time (`drain: JIT-number x…→#NNNN`), so the card is
identifiable. Until that's automated, a periodic **resolve-sweep** is the manual backstop:
scan `open` conveyor/delivery cards, confirm the born-hash/num actually landed on main
(`git log origin/main | grep`, spot-check the named files), and resolve only the genuinely-
complete ones.

**How to apply / guard-rails:**
- Verify before resolving — a merged *branch name* is not proof. #2666's lane branch was
  named `2666-conveyor-redci-autoheal`, but the only merged commit was `file card`; the
  implementation never landed (it was `blockedBy`). Resolving it on the branch name alone
  would have been wrong. Confirm the scope's files/behavior are actually on main.
- Do NOT resolve **epics** because one child PR merged — an epic resolves only when every
  `parent:`-child is resolved (see [[backlog-is-the-tracker]] / resolve-epic-by-parent-edges).
- Do NOT resolve a **decision** because its prep-packet PR merged — a packet prepares the
  fork, it doesn't ratify it.
- Leave anything unconfirmed or partial `open` and flag it for manual check rather than
  guessing.

Related: [[single-session-should-use-a-lane]], [[producer-opens-pr-drain-reviews]].
