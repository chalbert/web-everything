---
type: idea
workItem: story
size: 5
parent: "193"
status: resolved
locus: frontierui
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/blocks/droplist/parseOptions.ts
tags: []
---

# Declarative trait registration for droplist behaviors

The droplist behaviors (Anchor, Anchored, Clearable, Filter, FocusDelegation, LiveStatus, Selection) are composed *programmatically* by `<auto-complete>` in Frontier UI (`frontierui/blocks/droplist/`). To support standalone declarative use they need Frontier UI's lazy trait registration plus value-string option parsing.

Split from [#193](/backlog/193-droplist-frontierui-migration-followups/) (bullet 1).

## Scope

- **Lazy trait manifest + Enforcer registration** — register each behavior via Frontier UI's
  `defineLazy` / `traitManifest`, with the `vite.config` `traitEnforcer` wiring, so a behavior
  activates from a declarative attribute (`<ul anchored="bottom-start;flip">`, `<input filter="async">`)
  rather than only via `<auto-complete>`'s programmatic composition.
- **Value-string option parsing** — restore the `@withOptions` / `FieldValue` equivalent that was
  dropped during the plateau → Frontier UI port, so an attribute value string (`"bottom-start;flip"`)
  parses into the behavior's options object.

## Acceptance

Each droplist behavior activates declaratively from its attribute (with options parsed from the value
string) without `<auto-complete>`, covered by tests; the existing programmatic composition is unchanged.

## Design decision (recommended — surfaced 2026-06-11, batch pre-flight)

The 7 behaviors today are **plain classes** instantiated programmatically by `AutoComplete`
(`new Selection()`, `new Filter()`, …) — **not** `CustomAttribute` trait mixins like
`fui:blocks/traits/Sortable.ts` (the `defineLazy`/`traitManifest` model). Making them declarative is a fork:

- **Wrap (recommended)** — a thin `CustomAttribute` adapter per behavior that instantiates the existing
  class and feeds it parsed options. **Additive**, so the programmatic composition `AutoComplete` relies
  on is untouched — which is exactly what the Acceptance criterion ("existing programmatic composition is
  unchanged") demands. Each adapter is small; the behaviors stay the single source of logic.
- **Refactor** — make each behavior itself extend `CustomAttribute`. Invasive: it changes the very path
  `AutoComplete` composes, risking regressions in the shipped element for no functional gain over wrapping.

Take the **wrap** path unless a behavior genuinely can't be driven through its current constructor API.

**Sizing:** this is bigger than the `size: 5` tag implies — 7 behaviors × (adapter + value-string
parsing + tests) **plus reconstructing the dropped `@withOptions`/`FieldValue` parser from scratch**
(it did not survive the plateau → Frontier UI port; nothing equivalent exists in the tree today). Re-point
to 8, or split into "value-string parser + 1 reference behavior" then "remaining 6 behaviors", before
batching. (Released from an in-flight batch for this reason — it's a focused refactor, not a quick task.)

## Resolution (2026-06-14, batch) — split per the sizing note's recommendation

Took the split path. **The wrap/refactor fork is moot**: all 7 behaviors already extend
`CustomAttribute` (the tree was refactored after the design-decision note above was written), so no
adapter layer is needed — the real and only gap was value-string → options parsing.

Delivered (locus **frontierui**):
- `fui:blocks/droplist/parseOptions.ts` — the reconstructed `@withOptions`/`FieldValue` value-string parser:
  a spec-driven grammar (`;`-separated positional + bare boolean flags + `key=value` with type coercion,
  forward-compatible ignores of unknown keys).
- **Anchored** as the reference behavior — a static `optionSpec` + a guarded
  `Object.assign(this.options, parseOptions(this.value, …))` in `connectedCallback`. The guard (a no-op
  on empty `value`) keeps the programmatic `<auto-complete>` composition unchanged — the Acceptance
  invariant, asserted by a test.
- `anchored` registered in the `vite.config` `traitEnforcer` map, so `<ul anchored="bottom-start;flip">`
  activates declaratively without `<auto-complete>`.
- Tests: `fui:blocks/droplist/__tests__/declarativeOptions.test.ts` (10 — parser grammar + Anchored
  declarative activation + programmatic-unchanged guard + static-spec). Existing droplist suites
  (behaviors, AutoComplete) still green.

The remaining 6 behaviors (Anchor, Clearable, Filter, FocusDelegation, LiveStatus, Selection) are
mechanical replication of this pattern → carved to **#542** (`blockedBy: 275`).
