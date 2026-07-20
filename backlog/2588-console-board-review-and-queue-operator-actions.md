---
bornAs: xuff4b8
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["2584", "2522"]
tags: [plateau-loop, console, console-board, operator-actions, review, drag-to-queue, slice-2555]
---

# Console board review and queue operator actions

The operator acts on the board's *existing* cells (design-record §3i v19–v21): drag a ready item into a lane,
and review a finished build in a modal over the board. These are the read-and-act verbs on in-flight /
finished work — reviewing never leaves the board. The create/decide write affordances are the sibling slice
[#2587].

## Scope
- **Drag-to-queue (design-record §3i v20–v21, extends [#2522]).** Dragging a ready item highlights lanes
  (green = fits, amber = overlap-conflict) and the drop explains the consequence; a drop onto the drain lane
  is refused. The fit / overlap check reads the scope-lease state; it extends the existing build-queue verb
  ([#2522]), it does not re-implement queuing.
- **Review modal over the board (design-record §3i v21).** A `<dialog>` over the board (never a route
  change) showing spec-proven requirement rows + their evidence (each `proven` badge deep-links to the
  exact log/trace — design-record R5, the diff consumes [#2538]/[#2224]), auto-review findings, and the
  on-merge effects. Verbs: **merge · bounce · take over**. The taken-over / merge-held / bounced states are
  already in the taxonomy ([#2553]) — this slice wires the verbs that produce them.
- **Hover verbs on a cell (design-record §3i v19, the (status+flags) rule).** Each cell offers its verbs on
  hover/focus, overlaid without reflow, per the ratified attention-card grammar; verbs never trigger the
  cell's zoom. Secondary verbs (bounce) stay neutral-outlined buttons, never red (the 2026-07-17 ruling).

## Where the code goes (locus)
- The drag machinery, the review `<dialog>`, and the hover-verb layer land in this slice's own module
  `plateau-app:src/backlog-view/operator-actions.ts` (disjoint file from the sibling downstream slices),
  extending the board view under `plateau-app:src/backlog-view/` and acting on the cells [#2584] renders. The queue / merge / bounce /
  take-over actions ride the lane→PR + drain seams via the read port's **write** side
  (`POST /api/backlog/write`, lane→PR — the [#2558] write port); the view issues intents, it never writes
  `main` and never reaches a bare CLI / `gh` ([#2558] R2 boundary). The build-queue verb it extends is
  [#2522].

## Out of scope (other slices)
- Opening a decision from a lane, the new-work composer, and the new-spec→constitution loop → [#2587]
  (the create/decide write affordances). Cell rendering → [#2584].

## Acceptance
- Dragging a ready item highlights fitting (green) vs conflicting (amber) lanes, explains the drop
  consequence, and refuses a drop on the drain lane; queuing extends [#2522], not a parallel path.
- A finished build opens a review `<dialog>` **over the board** with spec-proven rows + deep-linked
  evidence, the visual diff, auto-review findings, and on-merge effects; merge / bounce / take-over each
  fire through the lane→PR + drain write seam (never `main` directly).
- Hover verbs appear without reflow per the (status+flags) rule and never trigger the cell's zoom; bounce is
  a neutral-outlined button.
- Both themes render; `plateau-app`'s `npm test` + `we:` `check:standards` pass.
