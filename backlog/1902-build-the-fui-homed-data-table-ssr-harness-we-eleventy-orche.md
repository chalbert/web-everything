---
kind: story
size: 5
parent: "1600"
locus: frontierui
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
relatedReport: reports/2026-06-28-backlog-split-analysis.md
tags: [data-table, ssr, build-integration, frontierui]
---

# Build the FUI data-table build-CLI (evaluate → render → SSR `<table>` with raw cell keys) (per #1867 ruling)

Slice A of the #1867 harness (sliced 2026-06-28 — `we:reports/2026-06-28-backlog-split-analysis.md`). Build the **FUI-homed build-CLI** the WE Eleventy build shells out to: keyed-batch stdin/stdout, version-pinned (locked FUI build-artifact, never PATH-resolved). It `evaluate()`s the deterministic context (`fui:plugs/webexpressions/CustomExpressionParser.ts:42-47`), then `renderDataTable()` (`fui:blocks/renderers/data-table/renderDataTable.ts:333`, DOM-only — run under the existing `happy-dom` shim, `fui:vitest.config.ts:12`, and serialize) to an SSR `<table>` whose interactive cells carry **raw `data-*` sort keys** (`<td data-sort-value>`, `<th data-type data-sortable>`) — not reparsed display text. The renderer has no string variant and does not yet stamp per-cell raw keys, so this extends it to emit the cell text **and** its `data-*` raw value from one resolved-row projection (the #1867 residual-risk mitigation). Homed in **FUI** (`locus: frontierui`).

The CLI's keyed-array stdin/stdout contract is the seam slice C (#1905, WE orchestration) shells out to. Demoable standalone via a FUI vitest fixture (keyed JSON in → keyed SSR HTML out). The client-side in-place enhancer is slice B (#1904); end-to-end build wiring is slice C (#1905). The #1600 table→data-table family ([#1609](/backlog/1609-migrate-table-surfaces-in-we-src-includes-project-to-fui-dat/)–[#1613](/backlog/1613-migrate-table-surfaces-in-we-src-includes-research-descripti/)) re-points to #1905. The non-deterministic app case is #1827.

## Progress (batch-2026-06-27)

Slice A landed in `frontierui`:

1. **Renderer extension — raw `data-*` keys (the #1867 Fork-2 skew mitigation), `fui:blocks/renderers/data-table/renderDataTable.ts`:**
   - `dataRow()` now stamps `<td data-sort-value="<raw>">` on **sortable** (interactive) cells — the
     unformatted `field` value, emitted from the **same resolved-row projection** as the display text, so the
     in-place client enhancer (#1904) sorts on the raw key, never reparsed display.
   - `th()` stamps `<th data-sortable data-type="…">` on sortable headers; added `Column.type?: 'text' |
     'number' | 'date'`, resolved by `resolveColumnType()` (explicit `type`, else inferred `'number'` from a
     `numeric` sort key, else `'text'`). Deterministic — no per-row inspection.
2. **Build harness core — `fui:blocks/renderers/data-table/buildHarness.ts`:**
   - `serializeDataTableSSR(rows, config)` → `renderDataTable(...).outerHTML` (the ruling's string SSR
     variant, run under FUI's happy-dom shim).
   - `runDataTableBuildBatch(entries)` → **keyed-batch in `[{key,rows,config}]` → keyed-batch out
     `{producer, results:[{key,html|error}]}`**, with per-entry isolation (one binding's failure → its own
     `error`, others still render) and the `BUILD_HARNESS_PRODUCER` version pin.
   - `toDeclarativeConfig()` projects the entry to the **JSON-native declarative subset** (columns minus
     `format`, plus `sort`/`group`/`order`/`caption`); drops `filter` + `format` (function-valued, never
     serialize per #1867 — filtering is the runtime/client concern). `assertJsonNativeRows()` fails loud on a
     non-`Cell` value.
3. **CLI process wrapper — `fui:tools/data-table-build/cli.ts`:** registers a happy-dom `document` global,
   reads keyed-batch JSON from stdin → `runDataTableBuildBatch` → stdout. The version-pinned artifact slice C
   (#1905) shells out to — compiled by `build:plugs` (tsc), never PATH-resolved.
4. **Proof — `fui:blocks/renderers/data-table/__tests__/buildHarness.test.ts` (4 tests):** the card's
   standalone demo (keyed JSON in → keyed SSR HTML out), reusing the shared `data-table-cases` fixtures
   **round-tripped through `JSON.parse(JSON.stringify(...))`** (proving the input is genuinely JSON-native);
   asserts the raw `data-*` keys, numeric-type inference, and keyed-batch isolation.

**Scope boundary:** "evaluate the deterministic context" resolves to consuming already-resolved build-known
rows (the `evaluate(resolved)` output); parsing a `rows` **web-expression string** against a `ResolvedValues`
context is slice C's upstream gather (#1905), and the non-deterministic app case is #1827. `check:standards`
+ all 42 data-table tests (38 existing + 4 new) + project `tsc` green. Demoable; unblocks slice C (#1905,
`blockedBy: ["1902","1904"]`).
