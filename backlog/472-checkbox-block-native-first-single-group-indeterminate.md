---
type: idea
workItem: story
size: 2
parent: "468"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webblocks (blocks.json#checkbox)
tags: []
---

# Checkbox block — native-first single + group, indeterminate

Native-first block over `<input type=checkbox>`: single checkbox, checkbox group, and the indeterminate state. Sliced from #468.

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `checkbox` block standard: a [blocks.json](../src/_data/blocks.json) entry (status `draft`,
type Component, `implementsIntent: input` + `composesIntents: [selection]`) plus its required
[block-descriptions/checkbox.njk](../src/_includes/block-descriptions/checkbox.njk) (the /blocks/ catalog
auto-renders it — verified live at `/blocks/checkbox/`). Captures the native-first stance:

- **Single** = the bare `<input type=checkbox>` + `<label>`, zero JS (the native element IS the block).
- **Group** = a coordinated set with a parent reflecting all/none/some.
- **Indeterminate** = the platform mixed tri-state (`el.indeterminate`), mapped to `aria-checked="mixed"`
  on the group parent (WAI-ARIA APG tri-state checkbox) — display/ARIA only, never a submitted value.
- **designDecisions** record: native-first (JS only for the group/mixed coordinator), indeterminate is
  the platform state not a coined one, and the explicit split from toggle/switch (#473) — deferred form
  value vs. immediate action, same substrate, separate blocks.

No `sourcePath` — the standalone control needs none; the group/mixed coordinator reference runtime is a
deferred Frontier UI build (standards-authoring complete here).
