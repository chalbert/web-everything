---
type: issue
workItem: task
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: "demos/data-grid-edit-bootstrap-fixture.html + blocks/__tests__/e2e/data-grid-edit-bootstrap.spec.ts"
tags: [data-grid, editing, e2e, bootstrap, regression-guard]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Editable Data Grid auto-upgrade e2e — guard `grid:cell-edit` through the bootstrap

#132 shipped the editable sub-pattern as the `grid:cell-edit` behavior (`DataGridEditBehavior`),
registered in [we:bootstrap.ts](../plugs/bootstrap.ts) and unit-tested by *manual* attach (the test
constructs the behavior and calls `connectedCallback` directly). The navigation half got a dedicated
end-to-end guard in #144 (resolved) that drives the behavior **as the bootstrap auto-upgrades it** on a
real plugged page. Editing has no equivalent.

Add the parallel guard for editing: a plugged page with a plain
`<table role="grid" grid:cell-navigation grid:cell-edit>` where the bootstrap's
`CustomAttributeRegistry` upgrades **both** attributes, then assert end-to-end that Enter/F2 opens the
editor, arrows stay in the field (navigation not driven), and Enter/Escape commit/cancel — proving the
registration + auto-upgrade path, not just the hand-wired one. Mirror #144's harness and the
plugged-trait regression guard (#133).

## Progress

**Status:** resolved

**Done:**
- Fixture `we:demos/data-grid-edit-bootstrap-fixture.html` — plain authored
  `<table role="grid" grid:cell-navigation grid:cell-edit>` (all cells `tabindex="-1"`, Salary column
  authored `aria-readonly="true"`), upgraded ONLY via `window.attributes.upgrade(document.body)` — no
  manual `new DataGridEditBehavior()` anywhere.
- E2E `we:blocks/__tests__/e2e/data-grid-edit-bootstrap.spec.ts` (4 tests, all green): Enter opens an editor
  seeded with the cell value; while editing arrows stay in the field and the roving tabindex never moves;
  Enter commits in-place / Escape restores; and (bonus #159 guard) a read-only cell never opens an editor.
  Each fails if `registerDataGridEdit(window.attributes)` stops firing.

**Notes:** chose the Playwright-e2e home over jsdom integration, mirroring
`we:blocks/__tests__/e2e/data-grid-bootstrap.spec.ts` (#144). The cross-cutting "all registered behaviors
auto-upgrade" coverage gap remains tracked at #155 — this item only closes the `grid:cell-edit` case.
