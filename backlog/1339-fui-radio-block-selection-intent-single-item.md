---
kind: story
size: 3
parent: "1286"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/radio/"
tags: []
---

# FUI radio block — selection intent (single/item)

Greenfield fui:blocks/radio/ CustomElement (`<input type=radio>` group + roving-tabindex a11y) implementing the selection intent (single/item); unit+e2e tests; fui:src/_data/blocks.json entry (#784 gate); demo. locus: frontierui.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Built following the established FUI block pattern (config factory + `mountInDocument` mode-C contract,
no registered tag — defers to the open #841 tag-naming decision, like `button`/`card`):

- `fui:blocks/radio/Radio.ts` — `createRadioGroup` / `mountRadioGroup` / `mountInDocument` over native
  `<input type=radio>` options sharing a `name`. **Roving tabindex** (one Tab stop on the checked option,
  or the first enabled when none checked), Arrow-key rove+select with **wrap** and **disabled-option
  skipping**, `role=radiogroup` + `aria-labelledby` group label. Exported `RADIO_CSS`.
- `fui:blocks/radio/index.ts` — barrel.
- `fui:blocks/__tests__/unit/radio/Radio.test.ts` — **10 tests** (role/label, native inputs, initial
  value, roving tabindex both ways, onChange + Tab-stop move, Arrow wrap, disabled skip, group-disable,
  mode-C mount/teardown). All green.
- `fui:src/_data/blocks.json` — `radio` entry (#784 gate); `fui:demos/radio-demo.html` (auto-registered,
  `demoFile` resolves).

Gate: `npm run check:standards` adds the block cleanly (42 blocks / 42 demos, no radio finding); the 2
residual errors are the pre-existing `notification`/`signature-pad` manifest gaps (not this changeset).
