---
type: idea
status: open
dateOpened: "2026-06-03"
tags: [droplist, dropdown, multi-select, block, traits]
relatedReport: reports/2026-06-02-droplist-trait-language.md
relatedProject: webblocks
crossRef:
  url: /blocks/droplist/
  label: droplist family page
---

# Author the multi-select-dropdown block standard

The multi-dropdown variant — a different trait selection over the droplist substrate (selection `model=multiple`, `selectionFollowsFocus=false`) — needs its own block.njk and blocks.json entry, parallel to the dropdown block. Seed content already exists in the trait-language report under "Multi-dropdown — one trait flip" and in the dropdown-trait-composition report under Step 2. The block should mirror dropdown.njk's structure: trait selection table, three altitudes, worked example, public API (a multi-value form-control surface — `.values` array, `FormData` repeating the name).
