# Backlog split analysis — #1902 (focused `/slice 1902`)

**Date:** 2026-06-28 · **Run:** focused single-item · **Verdict:** ✅ **CAN SPLIT** → 3 slices

[#1902](/backlog/1902-build-the-fui-homed-data-table-ssr-harness-we-eleventy-orche/)
*Build the FUI-homed data-table SSR harness + WE Eleventy orchestration* — `story`, `size: 8`,
`parent: "1600"`, `locus: frontierui`. Implements the **ratified** #1867 design
(`we:docs/agent/platform-decisions.md#ssr-data-table-build-harness`, resolved 2026-06-28). The item's
own body already names three components and tags itself "split via `/slice` before batching."

## Work-investigation pass (read the real surface)

Two Explore passes over FUI (`fui:` root) and WE confirmed the seams fall exactly on the three named
components, and that **all three are net-new** (no impl to remove):

**FUI** — `evaluate()`/render exist; the CLI and the in-place enhancer do **not**:
- Renderer `fui:blocks/renderers/data-table/renderDataTable.ts:333` (`renderDataTable(rows, config): HTMLTableElement`) — DOM-only, **no string/SSR variant**; stamps `data-action`/`data-field`/`data-group` but **not** raw `data-sort-value` per cell → the cell-key contract is net-new work.
- Evaluator `fui:plugs/webexpressions/CustomExpressionParser.ts:42-47,61` (`ResolvedValues`, `evaluate?(resolved)`) — DOM-free, present.
- Embed entry `fui:embed/data-table-in-document.ts:44-52` + CE `fui:blocks/renderers/data-table/DataTableBehavior.ts:82-100` — currently **register + CSS-inject + rebuild-from-`.rows`/`.config`** (`replaceChildren`). There is **no in-place enhancer** that reads `data-*` off existing `<tr>`s and reorders them. (Fork-2(c) needs exactly that distinct client path.)
- **No keyed-batch stdin/stdout CLI** in FUI (`fui:scripts/check-standards.mjs` is catalog-only; `fui:package.json` has no `bin`). Test shim confirmed: `fui:vitest.config.ts:12` (`happy-dom`).

**WE** — both build seams exist; nothing wired:
- `we:.eleventy.js:259-272` (watch targets / collections) — **no transform** for a `we-data-table` SSR splice; a new build hook is required.
- `we:src/_layouts/base.njk:493` already imports the FUI embed entry (#1787 done).
- **No build-time web-expression evaluator** and **no subprocess to FUI** today (`we:src/_data/buildId.js:7,11` is the only `execSync`, git-SHA only). WE has **no `plugs/` source dir** (confirmed; #1282 zero-impl).
- No template uses `rows="[[ ref ]]"` yet — it is the feature being built; the `/_maas/data/` route is FUI-owned and the build must **not** read it.

## Split-safety rubric — all five hold

| # | Condition | Verdict |
|---|---|---|
| 1 | Volume, not uncertainty | ✅ #1867 **ratified** (both forks decided) — no buried decision; the size is 3 distinct components across 2 repos. |
| 2 | ≥2 nameable slices, real home | ✅ Three seams, each `file:line`-citable; two repos (FUI ×2, WE ×1). |
| 3 | Slices land small | ✅ Re-estimates: A·5, B·3, C·5 — each ≤5 with named files, no buried fork. |
| 4 | Clean DAG, real independence | ✅ A ∥ B proceed **in parallel** (both FUI, against the ratified cell contract), then C integrates. |
| 5 | Every slice demoable | ✅ Each demoable in its home repo via a fixture (FUI vitest for A/B; WE build for C). |

## Could split — proposed slices

| Slice | Item | kind·size | locus | blockedBy | Scope |
|---|---|---|---|---|---|
| **A** | **#1902** (kept in place, re-sized 8→5) | story·5 | frontierui | — | **FUI build-CLI.** Keyed-batch stdin/stdout, version-pinned FUI build-artifact (never PATH-resolved); `evaluate()` the deterministic context → `renderDataTable()` → SSR `<table>` whose cells carry **raw `data-*` sort keys** (`<td data-sort-value>`, `<th data-type data-sortable>`). Extends the renderer to stamp the raw key in the **same** projection as the cell text (the #1867 residual-risk mitigation). Tests under `happy-dom`. |
| **B** | new `#1904` | story·3 | frontierui | — | **FUI in-place DOM enhancer.** The `we-data-table` CE client behavior that **reorders/hides existing `<tr>`s** on sort/filter/page by reading the `data-*` keys — **no re-render, no JSON island** (the distinct path the rebuild-from-data CE lacks today). Demoed on a static SSR fixture shaped to the ratified contract. |
| **C** | new `#1905` | story·5 | webeverything | **#1902, #1904** | **WE Eleventy orchestration.** New `we:.eleventy.js` build hook detects a `we-data-table rows="[[ ref ]]"` binding, gathers the deterministic build context, shells out to the FUI CLI over the subprocess boundary, splices the returned SSR HTML. **Never** reads the dev `/_maas/data/` route. Demoed on one real `#1600`-family surface (or a build fixture). |

### Slice DAG

```
A (#1902 · FUI CLI)  ─┐
                      ├─►  C (#1905 · WE orchestration)  ─►  #1609 #1610 #1611 #1612 #1613
B (#1904 · enhancer) ─┘
```

A and B are independent (both FUI, both against the ratified cell contract) → **both batchable now**.
C integrates the two and shells out to A's CLI → batchable once A+B land. The `#1600` table→data-table
family (#1609–#1613), currently `blockedBy: ["1902"]`, re-points to the integration slice **C (#1905)**
— they need the full harness (SSR splice **and** the client enhancer), which only exists after C wires
A+B end-to-end.

### Execution shape (already-parented edge case)

#1902 has `parent: "1600"`, so per *Executing a split* it is **not** converted to an epic. It stays a
`story` re-sized to its core slice (A, the FUI CLI), and B/C are scaffolded as **siblings under #1600**.
Net flow on `go`: **+2 slices** (#1904, #1905); #1902 re-sized 8→5; family ×5 re-pointed `1902 → 1905`.

## Could not split

None — single-item focused run; the one candidate splits cleanly.

## Open questions to register

None new. The split consumes a fully-ratified design (#1867); no deferred fork, no `kind: decision`
spin-off, no shared-fixture prerequisite blocking the carve.
