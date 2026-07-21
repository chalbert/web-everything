---
bornAs: xprj9ov
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-07-20"
blockedBy: ["2565"]
tags: [plateau-loop, console, console-board, decision-surface, write-seam, slice-2555]
---

# Console board write affordances — open-decision-from-a-lane + spec-candidate loop

Slimmed from the original size-5 slice. The **new-work composer** (the `scaffold` write verb + the docked
composer) already SHIPPED — carved to its own resolved story (`plateau-app:src/backlog-view/composer.ts`). What
remains here are the two "decide / govern" write concerns.

## Scope (remaining)
- **Open-decision-from-a-lane (design-record §3d-2 + §3f-A).** A decision-awaiting lane cell (taxonomy UC-A9)
  offers **Open decision**, which NAVIGATES to the ratify surface (#2565's full-page channel) — it does NOT
  ratify in place (§3g-T2: ratifying inside the red "this blocks your launch" gate is a biased frame). The
  board provides only the open-from-a-lane affordance + a scoped, auto-expiring, per-launch waiver (never a
  global policy edit from a launch context).
- **New-spec-candidate → constitution-promotion loop (design-record §3e-2 + §3f-D).** A requirement surfaced
  mid-build appears as a new-spec candidate with accept / reject; accepting a candidate that generalizes is
  **promoted to the constitution by FILING A DECISION** (prepare → ratify), never a one-click direct law change.

## Blocked on
- **#2565** (the decision-ratify surface) — open-decision NAVIGATES there; without a ratify route the affordance
  has nowhere to go. The spec-candidate loop also files a decision that #2565 rules.

## Where the code goes (locus)
- Extends the write family in `plateau-app:src/backlog-view/` (the open-decision affordance acts on a cell from
  #2584; the candidate loop is a new surface). Both write through the read port's write side
  (`POST /api/backlog/write`, lane→PR) which now carries the `scaffold` verb the composer added — decision-filing
  reuses that seam. No bare CLI / `gh` / `main` write from a rendering path (#2558 R2 boundary).

## Acceptance
- A decision-awaiting lane cell offers **Open decision** that navigates to #2565's surface (never ratifies
  inline); the only in-context write is a scoped, auto-expiring, per-launch waiver.
- Accepting a new-spec candidate that generalizes FILES A DECISION (prepare → ratify), never a direct
  constitution edit.
- Both themes render; `plateau-app` `npm test` + `we:` `check:standards` pass.
