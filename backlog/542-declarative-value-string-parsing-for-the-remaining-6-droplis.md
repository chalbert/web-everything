---
type: idea
workItem: story
size: 5
parent: "193"
locus: frontierui
status: resolved
blockedBy: ["275"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: frontierui/blocks/droplist/
tags: []
---

# Declarative value-string parsing for the remaining 6 droplist behaviors

Apply the #275 parseOptions mechanism + traitEnforcer registration to the other 6 droplist behaviors (Anchor, Clearable, Filter, FocusDelegation, LiveStatus, Selection) so each activates declaratively from its attribute value string.

## Context — #275 delivered the mechanism + a reference behavior

#275 (the parent split's first slice) reconstructed the dropped `@withOptions`/`FieldValue` parser as
`frontierui/blocks/droplist/parseOptions.ts` (spec-driven: positional + bare flags + `key=value` with
type coercion), wired it into **Anchored** as the reference behavior (a static `optionSpec` + a guarded
`Object.assign(this.options, parseOptions(this.value, …))` in `connectedCallback`), and registered
`anchored` in the `vite.config` `traitEnforcer` map so `<ul anchored="bottom-start;flip">` activates
declaratively. Locus: **frontierui**.

## Scope — repeat the pattern for the other 6

For each of Anchor, Clearable, Filter, FocusDelegation, LiveStatus, Selection:
- Declare a static `optionSpec: OptionSpec` describing its value-string grammar (the per-behavior part —
  e.g. `filter="async"` is a bare flag; `selection` carries `multiSelectable`/`controller`; `anchor`
  carries `surface`/`openOn`/`dismissOnCommit`/`boundaryEl`). The selector/element-ref options
  (`controller`, `for`, `surface`, `boundaryEl`) stay `string` ids in the value string.
- Merge `parseOptions(this.value, …)` over defaults on connect, guarded on a non-empty `value` so the
  programmatic `<auto-complete>` composition stays byte-for-byte unchanged (the #275 invariant).
- Add the attribute to the `traitEnforcer` `traitMap`.
- Tests: declarative activation + a programmatic-unchanged guard per behavior (mirror
  `blocks/droplist/__tests__/declarativeOptions.test.ts`).

## Note — behaviors are already CustomAttribute subclasses

The #275 "wrap vs refactor" fork is **moot**: all 7 behaviors already extend `CustomAttribute` (the tree
was refactored after that note was written). No adapter layer is needed — the only gap is value-string →
options parsing, which #275's mechanism already solves. This is mechanical replication across 6 files.

**Graduated to** `frontierui/blocks/droplist/` — static optionSpec + parseOptions merge across {Anchor,Clearable,Filter,FocusDelegation,LiveStatus,Selection}.ts + vite.config.mts traitMap; declarativeOptions.test.ts.
