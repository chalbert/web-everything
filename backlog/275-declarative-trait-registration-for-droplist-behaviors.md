---
type: idea
workItem: story
size: 5
parent: "193"
status: open
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
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

## Open design call (surfaced 2026-06-11, batch pre-flight)

The 7 behaviors today are **plain classes** instantiated programmatically by `AutoComplete`
(`new Selection()`, `new Filter()`, …) — **not** `CustomAttribute` trait mixins like
`blocks/traits/Sortable.ts` (the `defineLazy`/`traitManifest` model). Making them declarative is a fork:

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
