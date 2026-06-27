---
kind: story
size: 3
status: resolved
locus: frontierui
blockedBy: ["1891"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/blocks/renderers/component/customStates.ts
tags: [custom-state-set, states, native-first, a11y]
---

# Adopt CustomStateSet for native :state alignment in stateful blocks

> **Pre-flight (batch-2026-06-26-1793-1697) — re-homed to `frontierui`, blocked on a surfaced design fork (#1807).** Two findings from the survey: **(1)** the stateful block *implementations* live in FUI, not WE (zero-impl rule #1282), so this is a `frontierui` item. **(2)** The card's premise ("ad-hoc internal state to replace") is softer than assumed: the host attributes that looked like state (`AutoComplete` `resize`/`shift`) are public **config** (observed attrs + public setters — CustomStateSet must NOT replace those), and the one genuine internal state (`AutoComplete` open) is delegated to `Anchored` and already correctly modeled via `aria-expanded` with no CSS/demo consumer — so an imperative retrofit there is low-value. The real leverage is a **declarative** `:state()` surface on `<component>` (which already maps `form-associated` + `default-aria-*` via `ElementInternals`), whose authoring shape is undecided → filed as decision **#1807**. This story (the adoption + convention + demo) lands once #1807 settles the surface. Released unbuilt.

## Progress (batch-2026-06-27) — built; #1807 settled, slice A landed the surface

#1807 is **resolved** (→ #1830 contract + #1831 FUI epic), and #1831 **slice A (#1891)** already built the
declarative surface this story depends on: `states="…"` parse + lowering on `<component>` and the unplugged
`:state()` floor (`fui:blocks/renderers/component/customStates.ts` `addStates`/`toggleState`). So #1794's
residual was exactly what the pre-flight predicted — **adoption + convention + demo**, not an imperative
retrofit (the pre-flight found no clear-fit imperative block: the surveyed "stateful" host attrs are public
config or already `aria-expanded`-modeled). Delivered:
- **Demo** — added the `custom-states` case to `fui:blocks/renderers/component/__fixtures__/component-cases.ts`
  (case 10): a `<component states="active loading">` whose shadow CSS styles via native
  `:host(:state(active))` / `:host(:state(loading))` — end-to-end `:state()` styling, shown in both the
  Component Adapter Playground demo and the lowering conformance suite (164 lowering/source tests green).
- **Convention** — documented the native-first rule in `fui:blocks/renderers/component/customStates.ts`:
  expose genuinely-internal state as a custom state styled through `:state(...)`, never a reflected boolean
  attr/class, and never where a native ARIA state already models it; declarative `<component>` gets it free
  via `states=`, imperative blocks call `toggleState`.

FUI gate red is **pre-existing and unrelated** (34 `customElements.define` tag-parameterization / sibling
`fui:blocks.json` drift errors; none names this changeset — verified by stashing my files: 34→34).

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
