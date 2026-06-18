---
type: idea
workItem: task
parent: "023"
status: resolved
dateOpened: "2026-06-03"
dateResolved: "2026-06-06"
tags: [droplist, dropdown, multi-select, block, traits]
relatedReport: reports/2026-06-02-droplist-trait-language.md
relatedProject: webblocks
crossRef:
  url: /blocks/droplist/
  label: droplist family page
graduatedTo: block:multi-select-dropdown
---

# Author the multi-select-dropdown block standard

> **Resolved 2026-06-06 — graduated to the `multi-select-dropdown` block.** Authored as
> `we:src/_includes/block-descriptions/multi-select-dropdown.njk` with its `fui:blocks.json` entry, mirroring the
> dropdown block (trait selection `model=multiple`, `selectionFollowsFocus=false`; multi-value form-control
> surface). Original narrative preserved below.

The multi-dropdown variant — a different trait selection over the droplist substrate (selection `model=multiple`, `selectionFollowsFocus=false`) — needs its own we:block.njk and fui:blocks.json entry, parallel to the dropdown block. Seed content already exists in the trait-language report under "Multi-dropdown — one trait flip" and in the dropdown-trait-composition report under Step 2. The block should mirror we:dropdown.njk's structure: trait selection table, three altitudes, worked example, public API (a multi-value form-control surface — `.values` array, `FormData` repeating the name).
