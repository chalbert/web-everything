---
bornAs: xc3ofgt
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["2584"]
tags: [plateau-loop, console, console-board, delivery-horizon, conveyor, size-scaled, slice-2555]
---

# Console board delivery-horizon and size-scaled conveyor

The board's time geometry (design-record §3i v28 + v25–v27): time is up. One dashed delivery-horizon line
crosses all lanes; running cards **rise with real progress** and cross at delivery; the past zone sits above
with a gray past-mask; history is day-folded and navigable. In the `▤` size-scaled mode, cell heights follow
the size estimate so a column's length reads as its likely run time. This layers geometry onto the rendered
cards from [#2584].

This slice **owns the lane column's vertical axis** — time-as-height: where a card sits and how tall it is.
The scope-lease zones [#2589] are bands laid out *along* this axis (its **running** band is this slice's
live conveyor region), so [#2589] builds on the axis established here rather than defining a second one.

## Scope
- **The conveyor (design-record §3i v28).** One dashed delivery-horizon line across all lanes; a running
  card's vertical offset = its plan progress (slow live creep, reduced-motion respected); a breach-paused
  card freezes at its bar. Finished-but-holding cards (auto-passed, review-parked, at drain) dock AT the
  line and exit upward only at merge.
- **Past zone + history.** Above the line is the past: the newest merged card peeks partially through
  (clipped, deliberate); `⌃ N days of history` expands into a per-lane scrollable history with day
  separators (scroll up = back in time; newest docks at the line).
- **Size-scaled mode (`▤`, a setting; design-record §3i v25–v27).** Cell heights follow the size estimate
  (≈ min/pt from the live median); per-cell `Σ n · ≈ Nm` chips; per-lane `queue ≈ X h` ETA; the NOW line
  becomes a dotted delivery horizon; an oversize card surfaces a slice affordance.
- **Two-track progress unified with crossing (design-record §6, "progress = crossing").** The horizon slices
  a card at its spec-proven fraction; the plan is a claim marker below; the checklist self-aligns (done rows
  above the line, grayed by the past-mask); bars survive only as summaries.

## Where the code goes (locus)
- Geometry + the conveyor renderer land in this slice's own module
  `plateau-app:src/backlog-view/conveyor.ts` (disjoint file from the sibling downstream slices), extending the
  board view under `plateau-app:src/backlog-view/` and positioning the cells [#2584] renders. It also
  exports the lane vertical-axis layout the scope-lease zones [#2589] consume. Consumes the graduated scale/progress/zoom mints — [#2534] (scale-ruler),
  [#2535] (progress secondary-track), [#2536] (semantic-zoom) — and the FUI blocks [#2539]/[#2540]/[#2542]
  (`fui:` reference implementations), rather than reinventing the ruler/track/zoom primitives.
- Motion respects `prefers-reduced-motion` (the design-record's standing rule); the view stays on the read
  port ([#2558] R2 boundary).

## Out of scope (other slices)
- The cells themselves (glyph/color/motion) → [#2584]. Scope-lease zone stacking → [#2589] (it lays its
  bands along the vertical axis this slice owns, so it `blockedBy` this slice — this slice does not build the
  zones).

## Acceptance
- The board shows one dashed delivery-horizon across all lanes; running cards rise by real plan progress and
  cross at delivery; a breach-paused card is frozen at its bar; reduced-motion is respected.
- The past zone renders above with the gray past-mask; the newest merged card peeks through; `⌃ N days`
  expands a per-lane, day-separated, scrollable history.
- `▤` size-scaled mode scales cell heights by size, shows per-cell `Σ · ≈Nm` chips and a per-lane `≈ X h`
  ETA, and offers a slice affordance on an oversize card.
- Both themes render; `plateau-app`'s `npm test` + `we:` `check:standards` pass.
