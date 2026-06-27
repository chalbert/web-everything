---
kind: story
size: 3
status: open
locus: frontierui
blockedBy: ["1831"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
tags: [custom-state-set, states, native-first, a11y]
---

# Adopt CustomStateSet for native :state alignment in stateful blocks

> **Pre-flight (batch-2026-06-26-1793-1697) — re-homed to `frontierui`, blocked on a surfaced design fork (#1807).** Two findings from the survey: **(1)** the stateful block *implementations* live in FUI, not WE (zero-impl rule #1282), so this is a `frontierui` item. **(2)** The card's premise ("ad-hoc internal state to replace") is softer than assumed: the host attributes that looked like state (`AutoComplete` `resize`/`shift`) are public **config** (observed attrs + public setters — CustomStateSet must NOT replace those), and the one genuine internal state (`AutoComplete` open) is delegated to `Anchored` and already correctly modeled via `aria-expanded` with no CSS/demo consumer — so an imperative retrofit there is low-value. The real leverage is a **declarative** `:state()` surface on `<component>` (which already maps `form-associated` + `default-aria-*` via `ElementInternals`), whose authoring shape is undecided → filed as decision **#1807**. This story (the adoption + convention + demo) lands once #1807 settles the surface. Released unbuilt.

`ElementInternals.states` (the `CustomStateSet` API) lets a custom element expose internal states that style via the native `:state(...)` selector, instead of reflecting boolean attributes/classes. Per the native-first default, stateful blocks should start as standard-aligned as possible — so we should review where blocks currently model internal state ad-hoc and adopt `CustomStateSet` where it's the right primitive.

Review pass first: which blocks expose internal state, what they use today (attributes/classes/data-*), and where `:state()` is the better fit. Then adopt it in the clear cases and document the convention.

## Build
- Survey stateful blocks; identify ad-hoc state modeling that `CustomStateSet` would replace.
- Adopt `ElementInternals.states` + `:state()` styling in the blocks where it fits.
- Capture the convention so new blocks reach for it by default.

## Acceptance
- At least the clear-fit blocks expose state via `CustomStateSet` and style through `:state()`.
- The convention is documented; a demo case shows `:state()` styling.
- `check:standards` green.

_Converted from `we:plans/CustomStateSet.md` (#1792 hidden-docs cleanup)._
