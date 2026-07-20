---
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["xq8fvck", "xc3ofgt"]
tags: [plateau-loop, console, console-board, scope-lease, lane-zones, slice-2555]
---

# Console board scope-lease zone

The physical-execution projection inside a lane (design-record §3i + §6d-2): a lane stacks four zones top→
bottom, and a running lane's file-scope lease is drawn as a chip that keeps conflicting work visible and out.
This renders the scope-lease + conflict-policy state onto the board; the underlying engine is [#2560].

**Shared axis — this builds on [#xc3ofgt], it does not define a second one.** The four zones are bands along
the *same* lane vertical axis the delivery-horizon slice [#xc3ofgt] owns (time-as-height). The top **running**
band **is** [#xc3ofgt]'s live conveyor region (cards rising to the horizon); this slice adds the **ready ·
purgatory · next-sprint** bands below it plus the lease/conflict cells. So it `blockedBy` [#xc3ofgt] (consumes
its vertical-axis layout), not just the renderer — the two slices are ordered, not competing layouts of the
same column.

## Scope
- **The four lane zones (design-record §6d-2, the "purgatory" refinement).** Each lane stacks — as bands
  along [#xc3ofgt]'s vertical axis — **running** (`status: active`; this band **is** [#xc3ofgt]'s conveyor
  region, not a re-layout of it) · **ready queue** (`buildQueued && openBlockers = 0`, waiting a free lane) ·
  **purgatory** (`buildQueued && openBlockers > 0` — approved but a dependency isn't done; fires when it
  lands) · **next-sprint** (`!buildQueued`, needs a manual upgrade). Splitting purgatory out from "queued"
  is the candidate distinct card-state this slice renders.
- **Lease + conflict cells (design-record §3i v15–v19).** The scope-lease chip on a running lane; the
  *overlap* hold, the *forced* cell (`⚠` overlap accepted, resolve step queued at drain), the
  *breach-paused* cell (`⏸` waiting for the owning lease); the `lease relinquished → column frees` marker;
  a free column offering the best conflict-free fits.
- **Overtake affordance (design-record §6d-3, work-conserving dispatch).** One shared rank, but dispatch is
  work-conserving: a blocked higher-ranked card keeps its rank slot while ready lower-ranked cards overpass
  it — render the `overtaken · waiting on #X · passed by N` affordance so it is obvious why the top card
  isn't running.
- **Policy surfacing.** The `⚙` per-program policy control for the two configurable knobs
  (overlap-at-launch, breach-mid-build) that [#2560] owns — the board reads and shows them.

## Where the code goes (locus)
- Zone stacking + lease/conflict cells land in this slice's own module
  `plateau-app:src/backlog-view/lease-zone.ts` (disjoint file from the sibling downstream slices), extending
  the board view under `plateau-app:src/backlog-view/` on the cells [#xq8fvck] renders, and laying the zone
  bands along the vertical-axis layout [#xc3ofgt] exports (a hard `blockedBy`). **Soft-consumes** the
  scope-lease + conflict-policy engine [#2560] (built on
  `we:scripts/lane-lease.mjs`) via the read-model `plateau-app:src/backlog-view/card-state-read-model.ts`
  ([#2552], resolved), which already maps lease / breach / stuck state → card-state; not a hard `blockedBy`
  on the engine epic, because the zone renders from the read-model + fixtures and the live engine wiring
  lands with [#2560]. No bare CLI / disk / `gh` from the view ([#2558] R2 boundary).

## Out of scope (other slices)
- The lease/conflict/policy **engine** itself → [#2560] (its own child epic). Cross-lane spans that cross
  *other* lanes (waits-on-multiple-leases, forked/fan-in) → [#x2kpohd].

## Acceptance
- A lane renders the four zones (running · ready queue · purgatory · next-sprint) with purgatory visibly
  distinct from a lane-waiting ready card.
- The lease chip, overlap-hold, forced (`⚠`), and breach-paused (`⏸`) cells render with the correct glyph
  + color grammar, and a freed lease shows the `column frees` marker.
- An overtaken top card shows `overtaken · waiting on #X · passed by N`; the `⚙` policy control shows the
  program's overlap + breach policy values.
- Both themes render; `plateau-app`'s `npm test` + `we:` `check:standards` pass.
