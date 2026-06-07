---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [data-grid, a11y, keyboard, editing, apg]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Editable Data Grid cells — the APG editable-grid sub-pattern

The [Data Grid block](/blocks/data-grid/) (#123) realizes the **navigation** half of the WAI-ARIA APG
Data Grid pattern: `role="grid"` cell focus, roving tabindex, arrow/Home/End/Ctrl/Page movement. APG
also documents an **editable** mode the navigation grid composes with — and it is deliberately out of
scope for #123, which shipped read-only navigation.

Add cell editing as a distinct enhancement over the navigation contract:

- **Enter / F2** put the focused cell into edit mode (a text field inside the gridcell); **Escape**
  cancels and restores the value; **Enter** commits and returns focus to the cell.
- While editing, arrow keys move the caret **within** the field, not between cells — the grid's
  navigation is suspended until edit mode exits (APG's editing/navigation mode distinction).
- A committed value emits an observable change; the commit strategy (in-place, optimistic, deferred
  to a server) is a Frontier UI / app concern, named as a seam — the block owns only the mode model.
- Extend `auditDataGrid` (or a sibling audit) + the conformance demo with an editable fixture so the
  mode transitions and the "arrows edit the field, not the grid" invariant are CI-guarded, exactly as
  the navigation contract is.

Decide whether this is an option on the Data Grid block or its own composed block (mirror the
parallel-blocks vs. upgrade reasoning #123 settled for Data Table vs. Data Grid).
