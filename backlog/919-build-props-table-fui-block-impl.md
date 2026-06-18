---
type: issue
workItem: story
size: 3
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/props-table/PropsTableElement.ts
tags: []
---

# Build props-table FUI block impl

Build props-table in `fui:blocks/props-table/` (contract: we:src/_data/blocks/props-table.json). Render a component's Custom Elements Manifest (#653) as a sortable API table — attributes, properties, events, slots, CSS custom-properties and parts. Derived view over the CEM protocol, not a new control. locus frontierui. Slice of #904 (#626 Fork 1, #653 resolved).

## Built (batch-2026-06-18)

Shipped in **frontierui** at `blocks/props-table/`:

- **`fui:cemToRows.ts`** — pure projection of a CEM `custom-element` declaration into uniform rows across
  all populated member kinds (Attribute / Property / Event / Slot / CSS Property / CSS Part). Public
  fields only for Property; private/protected + methods excluded; empty kinds omitted
  (gracefulPartialManifest). `declarationFor(manifest, tag)` resolves the whole-manifest input.
- **`fui:PropsTableElement.ts`** — the `<props-table>` element + `registerPropsTable(tag='props-table')`
  (parameterized, #841). Driven by `.declaration` or `.manifest`+`tag`; renders a grouped (by kind),
  sortable table via a **DataTableBehavior** — the data-table IS the collection-operations renderer,
  so the column-sort affordance + `aria-sort` match every WE table (`composesIntents:
  ["collection-operations"]`, #919 reuses #917's intent). Derived view, no new conformance surface.
- **FUI `fui:src/_data/blocks.json`** — new `props-table` entry (sourcePath `blocks/props-table`,
  weSpecPath `/blocks/props-table/`) so the catalog-completeness gate (#784) maps the new family.

Gate: `check:standards` green (0 errors; 30 blocks / 28 families), 9 vitest specs pass, `tsc` clean.
