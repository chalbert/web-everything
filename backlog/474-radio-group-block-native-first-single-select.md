---
type: idea
workItem: story
size: 2
parent: "468"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "block:radio-group"
tags: []
---

# Radio group block — native-first single-select

Native-first block over an `<input type=radio>` group: single-select choice composing Selection Intent single + Focus Delegation roving. Sliced from #468.

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `radio-group` block standard: [blocks.json](../src/_data/blocks.json) entry (status
`draft`, type Component, `implementsIntent: selection` + `composesIntents: [focus-delegation]`) +
required [block-descriptions/radio-group.njk](../src/_includes/block-descriptions/radio-group.njk)
(renders live at `/blocks/radio-group/`).

- **Native-first**: N `<input type=radio>` sharing a `name`, in `<fieldset>`/`<legend>` — exclusivity +
  single value + the roving keyboard model are all the platform's, zero JS.
- **Composes focus-delegation (roving)**: native radios already give arrow-move-and-select with the
  group as one Tab stop — the block composes that intent rather than re-implementing traversal.
- **Single-select**, distinct from the checkbox group (#472): `selection model: single` vs `multiple`.
  WAI-ARIA APG Radio Group alignment.

No `sourcePath` — native case needs none; enhanced styling/behavior is a deferred Frontier UI build.
