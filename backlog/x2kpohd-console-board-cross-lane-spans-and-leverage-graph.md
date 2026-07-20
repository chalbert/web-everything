---
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["xq8fvck"]
tags: [plateau-loop, console, console-board, cross-lane, spans, leverage, slice-2555]
---

# Console board cross-lane spans and leverage graph

The two views that cross lane boundaries (design-record §3i + §6d-1/§6d-4): work that waits on or fans
across multiple lanes, and the leverage graph that shows what a card *frees*. This renders the family-B
cross-lane card states + the ⚡ leverage overlay onto the cells from [#xq8fvck].

## Scope
- **Cross-lane spans (design-record §3i v19+ · taxonomy family B).** The waits-on-multiple-leases card
  (span-only docking with `⌃` tacks; a dashed wire crosses untouched lanes for a non-adjacent span, the
  board may quietly reorder lanes to adjacency); overlaps-a-second-lane (starts when BOTH free);
  forced-past-overlap; the `⛓` cross-lane dependency link drawn on hover (a bezier to the blocker); the
  `⚔` rival-pair (order swappable).
- **Fan-out / forked / fan-in — a logical overlay, NOT sub-lanes (design-record §6d-1, ratified).** `∥`
  disjoint siblings run **across separate fungible lanes**, not nested sub-lanes; "forked ×N" is a
  grouping/leverage overlay ("these N cards, in N lanes, released by A, reconverge at the fan-in"). Fan-out
  = prediction; forked = in-flight; fan-in may be degraded (which sibling blocks + converge-partial). Use
  the "across lanes / a tracked fan" wording, never "sub-lanes."
- **Leverage graph (design-record §6d-4, use the right field).** The always-visible `⚡` chip carries the
  two WE numbers — **frees-now = `unblocksToReady`** (items whose *last* open blocker is this one) vs
  **gates = `transitiveUnblocks`** (the gated downstream weight) — in **teal** (the ratified leverage color,
  never green). Hovering a cell lights its whole downstream closure teal across lanes with edges to the
  directs (color grammar: purple = waits-on, teal = frees). Semantic-zoom disclosure: a teal color-corner
  at coarse zoom, the count/weight revealed as you zoom in.

## Where the code goes (locus)
- Span docking + the leverage overlay land in this slice's own module
  `plateau-app:src/backlog-view/cross-lane-spans.ts` (disjoint file from the sibling downstream slices),
  extending the board view under `plateau-app:src/backlog-view/` on the cells [#xq8fvck] renders. The three leverage numbers are the deterministic, zero-cost CLI values from
  [we:src/_data/backlog.js](src/_data/backlog.js) (`directUnblocks` ≠ `unblocksToReady` ≠
  `transitiveUnblocks`) read through the read port ([#2558] R2 boundary — no bare CLI from the view).
- Consumes the graduated swimlane mint [#2537] / FUI [#2543] (`fui:` span/lane primitive) rather than
  hand-rolling the cross-lane geometry.

## Out of scope (other slices)
- Within-lane lease zones (running/queue/purgatory + breach/forced *in one lane*) → [#xzsx09z]. The
  delivery-horizon geometry → [#xc3ofgt].

## Acceptance
- A waits-on-multiple-leases card docks span-only with `⌃` tacks and a dashed wire for a non-adjacent span;
  `⛓` dependency links and the `⚔` rival-pair render; a fan is drawn as an across-lanes overlay (never
  "sub-lanes").
- The `⚡` chip shows frees-now (`unblocksToReady`) and gates (`transitiveUnblocks`) in teal; hovering a
  cell lights its downstream closure teal across lanes; coarse zoom shows only the teal corner, the numbers
  reveal on zoom-in.
- Both themes render; `plateau-app`'s `npm test` + `we:` `check:standards` pass.
