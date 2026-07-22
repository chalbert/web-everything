---
bornAs: xprj9ov
shortTitle: "Spec-candidate → decision loop"
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-20"
tags: [plateau-loop, console, console-board, decision-surface, write-seam, slice-2555]
---

# Console board write affordances — new-spec-candidate → decision loop

Slimmed twice. The **new-work composer** (the `scaffold` write verb + the docked composer) shipped — carved to
its own resolved story (`plateau-app:src/backlog-view/composer.ts`). The **open-decision-from-a-lane** concern
also shipped (below). What remains is the ONE "surface a requirement as a candidate → file a decision" concern.

## Delivered so far (open-decision-from-a-lane + the per-launch waiver)
- **Open-decision-from-a-lane (§3d-2 + §3f-A / §3g-T2).** A decision-awaiting board cell (UC-A9) offers
  **Open decision**, which NAVIGATES to the dedicated ruling surface (`/console-ruling?decision=<num>`) — it
  never ratifies inline in the biased launch frame. `plateau-app:src/backlog-view/lane-board.ts` +
  `plateau-app:src/backlog-view/ruling-surface.ts` (the focus/highlight). plateau-app PR #91.
- **The scoped, auto-expiring, per-launch waiver** (the "only in-context write" this slice promised) shipped as
  #2582's Guard 3 — recorded to a git-ignored server-held JSON, logged, TTL'd, never lane→PR, offered from the
  statute policy-menu gate. plateau-app PR #93.

## Remaining (this slice)
- **New-spec-candidate → constitution-promotion loop (design-record §3e-2 + §3f-D).** A requirement surfaced
  mid-build appears as a new-spec candidate with accept / reject; accepting a candidate that generalizes is
  **promoted to the constitution by FILING A DECISION** (prepare → ratify via the `scaffold` verb), never a
  one-click direct law change. This is now UNBLOCKED (the ratify surface + the scaffold verb it files through
  both exist).

## Where the code goes (locus)
- Extends the write family in `plateau-app:src/backlog-view/` (the open-decision affordance acts on a cell from
  #2584; the candidate loop is a new surface). Both write through the read port's write side
  (`POST /api/backlog/write`, lane→PR) which now carries the `scaffold` verb the composer added — decision-filing
  reuses that seam. No bare CLI / `gh` / `main` write from a rendering path (#2558 R2 boundary).

## Acceptance
- Accepting a new-spec candidate that generalizes FILES A DECISION (prepare → ratify via the `scaffold` verb),
  never a direct constitution edit; rejecting it records the rejection, not a law change.
- Both themes render; `plateau-app` `npm test` + `we:` `check:standards` pass.
