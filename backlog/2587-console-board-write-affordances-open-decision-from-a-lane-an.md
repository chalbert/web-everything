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
  one-click direct law change.

### Gate correction (2026-07-21 feasibility scoping) — only the OUTPUT half is unblocked
A prior note called this UNBLOCKED. That is only half-true, and the missing half is load-bearing:
- **Output half — DONE / unblocked.** Filing a decision on accept is real today: `plateau:scripts/backlog.mjs`
  `scaffold` accepts `--kind=decision` (kind validation line ~508), the client scaffold plan in
  `plateau:src/backlog-view/write-action.ts` passes kind straight through, and
  `plateau:src/backlog-view/composer.ts` already lists `decision` in `COMPOSER_KINDS`. The filed decision then
  rides the shipped ratify surface (`plateau:src/backlog-view/ruling-surface.ts`, PR #91). Note prepare→ratify
  is three decoupled verbs (scaffold files it OPEN → `prepare-stamp` sets preparedDate → `resolve --codified-to`
  ratifies), not a single scaffold call — but each step already exists.
- **Input half — GATED, not built.** Where a "new-spec candidate" comes FROM does not exist. Per the
  design-record `plateau:docs/backlog-console-design.md` §3e (lines 183-184), candidates are emitted by the
  **L3 build inspector (mockup v5)**, which is unbuilt — there is no candidate feed, type, store, or event.
  The runner event union (`plateau:src/build-runner/events.ts`) carries no per-requirement / spec-candidate
  event. So the surface has **no data source**. Building it tonight would mean a manual, hand-typed
  composer-style stand-in that (a) contradicts §3e-2's auto-surfacing intent, (b) largely duplicates the
  already-shipped composer (which can file `kind:decision` today), and (c) still needs a **net-new rejection
  store** ("reject records the rejection" has nowhere to persist). Deferred: build the L3 build inspector +
  a spec-candidate runner event first (housed under the supervision epic #2551), then this loop consumes them.

## Where the code goes (locus)
- Extends the write family in `plateau-app:src/backlog-view/` (the open-decision affordance acts on a cell from
  #2584; the candidate loop is a new surface). Both write through the read port's write side
  (`POST /api/backlog/write`, lane→PR) which now carries the `scaffold` verb the composer added — decision-filing
  reuses that seam. No bare CLI / `gh` / `main` write from a rendering path (#2558 R2 boundary).

## Acceptance
- Accepting a new-spec candidate that generalizes FILES A DECISION (prepare → ratify via the `scaffold` verb),
  never a direct constitution edit; rejecting it records the rejection, not a law change.
- Both themes render; `plateau-app` `npm test` + `we:` `check:standards` pass.
