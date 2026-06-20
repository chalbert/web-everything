---
kind: story
size: 3
parent: "1286"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/checkbox/"
tags: []
---

# FUI checkbox block — selection intent (multiple/boolean)

Greenfield fui:blocks/checkbox/ CustomElement (`<input type=checkbox>` + indeterminate + a11y) implementing the selection intent (multiple/boolean); unit+e2e tests; fui:src/_data/blocks.json entry (#784 gate); demo. locus: frontierui.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Built on the FUI block factory pattern (config factory + `mountInDocument` mode-C, no registered tag —
#841 open):

- `fui:blocks/checkbox/Checkbox.ts` — `createCheckbox` (single boolean + the native `indeterminate`
  third state, cleared on first user toggle) and `createCheckboxGroup` (independent multi-select with an
  optional tri-state **"select all"** master that reflects checked / unchecked / **indeterminate** over
  the *enabled* options). `setCheckboxState` imperative helper, `role=group` + `aria-labelledby`,
  disabled handling, exported `CHECKBOX_CSS`.
- `fui:blocks/checkbox/index.ts` — barrel.
- `fui:blocks/__tests__/unit/checkbox/Checkbox.test.ts` — **11 tests** (single create/state/indeterminate
  clear, imperative set, group role/label/values, master tri-state at none/partial/all, master toggles all,
  disabled excluded from tri-state, mode-C mount/teardown). All green.
- `fui:src/_data/blocks.json` — `checkbox` entry (#784 gate); `fui:demos/checkbox-demo.html`
  (auto-registered, `demoFile` resolves).

Gate: adds cleanly (43 blocks / 43 demos, no checkbox finding); the 2 residual errors are the pre-existing
`notification`/`signature-pad` manifest gaps (not this changeset).
