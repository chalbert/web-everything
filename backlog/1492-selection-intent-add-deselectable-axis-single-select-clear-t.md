---
kind: story
size: 2
status: resolved
relatedProject: webcomponents
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/selection.json"
tags: [intent, selection, deselect]
---

# selection intent — add deselectable axis (single-select clear-to-none)

Ratified #1470: add a named boolean dimension deselectable (default true) to we:src/_data/intents/selection.json, alongside model/immediacy/variant/grouping, plus the SelectionIntent interface field. deselectable:true ⇒ a single-select control can be cleared back to no-selection; false ⇒ a value is required. The permissive complement of required/aria-required. Renderers map it to deselect-on-re-activate (radio/segmented) or an empty-able select. Foundational contract slice — FUI radio (#1470 sibling) consumes it.

## Progress (batch-2026-06-21-1429-1487)

Added to `we:src/_data/intents/selection.json`:
- **`dimensions.deselectable`** — `values: ["true","false"]` (the boolean-dimension convention, e.g.
  `disclosure.findable` / `collection-operations.numericOrdering`), description records the
  most-permissive default `true`, the `required`/`aria-required` complement, and the
  deselect-on-re-activate / empty-able-select renderer mapping (#1470).
- **`SelectionIntent` interface** (the embedded TS in the description) — added `deselectable?: boolean;`
  with a comment noting default-true and the required-complement semantics.

Gate green (0 errors), JSON valid. Foundational contract slice; FUI radio (#1470 sibling) consumes it.
