---
kind: task
parent: "940"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "fui:demos/rich-text-editor/index.html"
tags: []
---

# Rich-text-editor demo + Playwright e2e harness (engine switcher)

Foundational shared fixture for the #940 engine adapters: a FUI demo page exercising <rich-text-editor> with an engine="" switcher, plus a Playwright spec verifying real contenteditable selection/format on the native engine (happy-dom can't do selection/range). Each engine slice extends this switcher + adds an e2e assertion.

## Progress (batch-2026-06-18) — resolved

Shipped in `frontierui` (locus): `fui:demos/rich-text-editor/index.html` + `fui:demos/rich-text-editor/rich-text-editor.ts` (the
demo page) and `fui:demos/rich-text-editor/__tests__/engine-switcher.spec.ts` (the Playwright lane,
picked up by the existing `demos/**/__tests__/**/*.spec.ts` testMatch). The page mounts the real
`<rich-text-editor>` block, wires the `engine=""` switcher off the live `customEditorEngine` registry
(#629), and exposes a `window.__rte` surface (mirrors the durable-demo pattern). Seeds ONE demo-only
`plain` engine so the switcher has a second entry TODAY — each #940 slice replaces/extends it with a real
engine + adds an `<option>` and an assertion.

The spec (3 tests, all green against the FUI Vite origin :3001) verifies what happy-dom cannot:
(1) **real selection + format** — type into the live contenteditable, select its contents via the real
Selection/Range API, click Bold → assert the serialized value gained a bold wrapper; (2) the switcher
lists the registered engines (native default first); (3) **`engineIsSwappable`** — the serialized pivot
survives a native→plain engine swap. FUI `check:standards` clean for this changeset (the one error,
`plugs/webvalidation/` catalog drift, is concurrent #950 work — not in this changeset).
