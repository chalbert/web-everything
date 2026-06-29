---
kind: story
size: 3
parent: "1600"
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-29"
tags: []
---

# Migrate table surfaces in we:src/_includes/project-* to FUI data-table

Migrate the ~33 `<table>` surfaces in `we:src/_includes/project-*.njk` to FUI blocks/renderers/data-table via the **transient-CE mount** (`<we-data-table>`, #1621 rule-7 model — the data-table counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1787 (the FUI `fui:embed/data-table-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

## Carry (batch-2026-06-29b parallel /workflow — serial-lane drop, mechanism mis-evaluated)

The `/workflow` serial-lane agent carried this `blocked-in-fact`, having evaluated the **#1905 build-splice / `rows="[[ ref ]]"` data-binding** path: it found the project tables are hand-authored rich-HTML (`<strong>`/`<code>`/`<a href>`/`colspan` group rows) and the data-table wire contract is JSON scalar-only (`fui:blocks/renderers/data-table/renderDataTable.ts:32`), so the rich cells can't cross the build harness's JSON boundary. **That reasoning is real but addresses the WRONG mechanism.** This item's body specifies the **transient-CE WRAP** (`<we-data-table>`, #1621 rule-7 — the #1606 `<we-code-view>` wrap precedent), and that is exactly what its 4 siblings did this same run and **landed clean**: `<we-data-table><table>…full rich SSR <table>…</table></we-data-table>` (see #1610 `d528a95e`, #1612 `0f7c93a5`) — the SSR `<table>` (rich cells intact) stays in light DOM and the element upgrades in place via the #1787 runtime embed. No scalar-JSON involved; no fidelity loss. So this is a **false-drop**: re-attempt by wrapping each of the 33 `<table>`s like the siblings (serial `/batch`, mechanical).

**One thing to confirm first (the only real fork):** #1611's earlier pre-flight once argued the wrap is semantically wrong — that `<we-data-table>` is a render-from-data kernel, not a wrap-existing-markup element. The 4 landed siblings (#1610/#1611/#1612/#1613) contradict that and the gate (incl. render check) passed. If the wrap is the sanctioned pattern, this item + the 4 siblings are all correct; if data-binding is actually required, the 4 siblings need rework. Confirm wrap-vs-databind before re-attempting. Also cleared the stale `blockedBy: ["1905"]` (resolved).
