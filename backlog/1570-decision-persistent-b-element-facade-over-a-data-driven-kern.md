---
kind: decision
status: open
locus: frontierui
dateOpened: "2026-06-22"
tags: [packaging, custom-elements, persistent-b, block-model, "1442", "1457"]
---

# DECISION: persistent-B element facade over a DATA-driven kernel — how it sources its data

The wave-3 persistent-B conversions #1567 (`we-tree-select`), #1568 (`we-type-ahead`), #1569 (`we-data-grid`) are each scoped "mirror the shipping `fui:blocks/stepper/StepperElement.ts` reference, flat application, no fork." But `StepperElement` wraps a kernel that **scans the host's light-DOM markup** (`[data-step]` panels), whereas these three kernels are **data-array-driven** — `TreeSelectBehavior(host, nodes: TreeNode[], opts)`, and likewise type-ahead (items) / data-grid (rows + columns). So the reference does **not** specify how a persistent-B element supplies the data its kernel needs, and that choice is the element's authored public API — a real fork, not a permissive default.

## Why the StepperElement mirror under-specifies these three

`fui:blocks/stepper/StepperElement.ts` `#build()` does `new StepperBehavior(this, { progression })` — the
kernel reads the steps straight from the light DOM the author already wrote, so the element adds only
attributes + styling. **There is no data to source.** For the wave-3 trio the kernel's first argument after
`host` is a **structured data array** the element must produce from somewhere:

- `fui:blocks/tree-select/TreeSelectBehavior.ts`: `constructor(host, nodes: TreeNode[], opts)` —
  `TreeNode = { id, label, children?, selectable? }` (hierarchical).
- `fui:blocks/type-ahead/…`: an items/suggestions list.
- `fui:blocks/data-grid/…`: rows + column definitions.

No existing element facade parses light-DOM into such a data array (grepped — none), so there is no
in-repo convention to copy.

## The fork (options — not yet researched/ratified)

- **A — Light-DOM parse.** The element reads an authored markup convention into the data array
  (e.g. nested `<ul><li data-id data-selectable>` → `TreeNode[]`; a `<table>` → rows/columns; a
  `<datalist>`/`<option>` set → items). Most HTML-first / progressive-enhancement-friendly, but each block
  needs a **decided markup→data mapping** (itself an API), and tree/grid markups are non-trivial.
- **B — A typed property.** The element exposes `.nodes` / `.items` / `.rows` set programmatically; markup
  is optional. Simplest to implement, but JS-only (no author-markup form, weaker than the "support-both"
  framing).
- **C — A JSON attribute.** `data` as a serialized attribute the element parses. Declarative but clunky for
  large/hierarchical data and awkward to keep in sync.
- **D — Hybrid (recommend-shape).** Define ONE shared "persistent-B over a data kernel" pattern (a small
  base or helper) — light-DOM parse when markup is present (A), else the property (B) — and apply it
  uniformly to all three, so the three cards become flat applications of a *decided* pattern rather than
  three independent API inventions.

## Blocks

- #1567 (`we-tree-select`), #1568 (`we-type-ahead`), #1569 (`we-data-grid`) — all `blockedBy` this; each was
  scoped "no fork / mirror StepperElement", which doesn't hold for a data-driven kernel.

Surfaced 2026-06-22 (batch-2026-06-22-1545-1549) grounding #1567: claimed it, read `TreeSelectBehavior`'s
data-array constructor, and confirmed the named reference (`StepperElement`, light-DOM-scan) doesn't resolve
the data-source — a genuine fork shared by the trio. No design call was forced to keep them batchable. The
transient-A single-form-control conversions (#1554/#1555, resolved this batch) were unaffected — those
kernels are factory-config, not light-DOM-scan, so the question is specific to persistent-B-over-data-kernel.
