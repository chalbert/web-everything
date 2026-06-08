---
type: idea
workItem: task
parent: "023"
status: resolved
dateOpened: "2026-06-03"
dateStarted: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: block:autocomplete
tags: [droplist, autocomplete, combobox, block, traits, filter]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef:
  url: /blocks/autocomplete/
  label: Autocomplete block
---

# Author the autocomplete block standard

The autocomplete variant — editable input + filterable listbox — needs its own block.njk and blocks.json entry. It is the richest droplist member and the one whose authoring most pressure-tests the substrate: composing it surfaces the *focus host ≠ collection* distinction, the `controller` parameter on focus-delegation, the `type-ahead → filter` swap, and `filter` as a thin composition over loader + live-status.

Seed content already exists in the dropdown-trait-composition report under "Autocomplete in detail" (focus host vs collection, the controller param, type-ahead → filter, the typing trace) and in the trait-language report under "Autocomplete — swap one trait, move the focus host". The `controller` prototype on FocusDelegation (see [focus-delegation-controller](/backlog/029-focus-delegation-controller/)) has **landed** (plateau `FocusDelegation.ts`: a `controller` option moves keydown + `aria-activedescendant` to the input, the collection stays out of the tab order, and `activedescendantchange` still fires on the listbox so Selection keeps coordinating) — so the focus-host-≠-collection substrate this block needs is now proven and the runnable spec can be claimed.

## Progress
- **Status:** resolved — graduated to the `autocomplete` block (`<auto-complete>`), a distinct concrete droplist member.
- **Branch:** docs/standard-authoring-workflow
- **Done:** Added the `autocomplete` entry to `src/_data/blocks.json` (5 design decisions: focus-host≠collection, filter↔type-ahead swap, filter=loader+live-status composition, distinct `<auto-complete>` element, form-associated commit glue). Authored `src/_includes/block-descriptions/autocomplete.njk` (full 3-altitude spec page, renders 200 on :3000/:8080). `gen:inventory` clean, `check:standards` green (31 blocks).
- **Next:** —
- **Notes:** The still-`proposed` autocomplete-specific traits (`filter` + `clearable`) are tracked as a follow-up in [#122](/backlog/122-filter-clearable-trait-surfaces/). This block is a spec/contract page (no runnable renderer/demo), matching its dropdown / multi-select-dropdown siblings.
