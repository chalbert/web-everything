---
kind: story
size: 2
status: open
relatedProject: webcomponents
dateOpened: "2026-06-21"
tags: [intent, selection, deselect]
---

# selection intent — add deselectable axis (single-select clear-to-none)

Ratified #1470: add a named boolean dimension deselectable (default true) to we:src/_data/intents/selection.json, alongside model/immediacy/variant/grouping, plus the SelectionIntent interface field. deselectable:true ⇒ a single-select control can be cleared back to no-selection; false ⇒ a value is required. The permissive complement of required/aria-required. Renderers map it to deselect-on-re-activate (radio/segmented) or an empty-able select. Foundational contract slice — FUI radio (#1470 sibling) consumes it.
