---
type: idea
workItem: story
size: 5
parent: "586"
status: open
blockedBy: ["587"]
dateOpened: "2026-06-14"
tags: []
---

# Build the general picker surface (composed browse↔search)

Build the one general picker surface per #370 Fork 4 (compose, don't reinvent): popover container + search input intent + category grid, reusing droplist/autocomplete. Specify the APG Grid (2-D arrow nav, browse) ↔ Combobox/listbox (search) focus hand-off — the load-bearing a11y transform. Promote to a thin block ONLY if that hand-off can't be expressed as config over droplist/autocomplete. This surface is instantiated by many specific picker contexts (separate stories): full-page filtered collection, in-editor tooltip picker, reaction quick-picker.
