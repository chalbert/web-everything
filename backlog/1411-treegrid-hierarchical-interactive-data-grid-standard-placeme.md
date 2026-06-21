---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, treegrid, data-grid, tree, apg, gap]
---

# Treegrid — hierarchical interactive data grid standard: placement

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **treegrid** is a 2-D grid whose rows form an expand/collapse hierarchy (file explorers, grouped data
tables, nested org views) — the APG Treegrid pattern, with 2-D arrow navigation plus row
expand/collapse. WE has `data-grid` (2-D grid nav) and `tree-select` (hierarchy) but **no standard for
their combination**.

**Decision:** is treegrid just a *composition* of `data-grid` + `tree-select` (document the pattern, no new
standard), a dimension of `data-grid` (`hierarchy: true`), or its own block. Most likely "composition or
data-grid dimension" — lowest-confidence of the APG harvest, filed so the call is explicit. Refs:
[we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json),
[we:src/_data/blocks/tree-select.json](../src/_data/blocks/tree-select.json). **Needs `/prepare`.** Unsure
⇒ decision; costs nothing.
