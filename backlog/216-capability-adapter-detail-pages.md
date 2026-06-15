---
type: idea
workItem: story
size: 3
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: src/capability-adapter-pages.njk
tags: [capability-provider, adapters, capability-adapter, discovery, detail-pages, catalog]
crossRef: { url: /backlog/206-capability-adapter-registration-table/, label: "Follow-up of #206 (registered adapter table)" }
---

# Per-registered-capability-adapter detail pages

Follow-up surfaced closing out
[#206](/backlog/206-capability-adapter-registration-table/). The registered capability adapter table
(`capabilityMatrix.json` → `impls[]`, rendered on `/capabilities/`) currently exposes each adapter
only as a **column header + inline `summary`** in the matrix grid. The `adapters.json` pattern that
#206's scope explicitly invokes goes one step further: each registered item has a
`adapter-descriptions/{id}.njk` **detail page** explaining what it bridges.

## Scope

- A per-adapter detail page (or section) for each registered capability adapter (`face`,
  `base-select`, …) — what the impl is, why each capability tiers the way it does (the cells that are
  `polyfill-ok`/`capability-hard` are the interesting story), and which intents it can/can't serve
  native. Mirror the `adapter-descriptions/{id}.njk` convention.
- Link the matrix column header → its adapter detail page; the provider already exposes the rows via
  `adapters()` (#206), so the page can render from one source.
- **DoD** — a detail page per registered adapter, linked from `/capabilities/`; `check:standards`
  green (extend the discovery-surface validator if a description partial becomes required per adapter,
  per the [catalogs auto-render](../docs/) note).

## Progress
- **Status:** resolved — per-adapter detail pages live at `/capabilities/adapters/{id}/`, linked from the matrix.
- **Branch:** docs/standard-authoring-workflow
- **Done:** `src/capability-adapter-pages.njk` paginates `capabilityMatrix.impls` → detail page (prose partial + data-driven tier breakdown grouped by state + sibling-adapter cross-links); `capability-adapter-descriptions/{face,base-select}.njk` prose partials (what it is / why each tier / native serve-can/can't); matrix column headers in `capabilities.njk` + `capability-pages.njk` now link to the adapter page; `check-standards.mjs` requires a partial per registered adapter row. check:standards 0/0; clean 11ty build emits both pages.
- **Next:** —
- **Notes:** mirrors the `adapter-descriptions/{id}.njk` + `adapter-pages.njk` convention; tier facts render from the single source (`capabilityMatrix.json`), prose lives in the partial.

## Notes

Optional / discovery-polish — the #206 DoD (registration + query + single-row-add + row-shape
validator) is already met without this. Pairs with #211 (per-capability detail pages): #211 is the
*capability* (row) detail, this is the *adapter* (column) detail.

**Graduated to** `src/capability-adapter-pages.njk` — /capabilities/adapters/{id}/ detail pages + capability-adapter-descriptions/{id}.njk partials + per-adapter description validator.
