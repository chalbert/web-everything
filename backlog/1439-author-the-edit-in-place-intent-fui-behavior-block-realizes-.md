---
kind: story
size: 5
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [edit-in-place, inline-edit, editing, intent, realizing-build]
---

# Author the edit-in-place intent + FUI behavior block (realizes #1397 ruling)

Realize the #1397 ratified placement: mint the edit-in-place WE intent (dimensions draft: activation = click|dblclick|F2|programmatic, commitOn = blur|enter, cancelOn = escape reverts-to-baseline, editor pointer), composing input/validation/focus-delegation/(opt) rich-text rather than re-owning them — adopt the WAI-ARIA APG Enter/F2/Esc vocabulary. Then the FUI behavior block that realizes it + a demo, and wire data-grid editable cells to compose it (first consumer, no grid-contract change). Author one crisp sentence delimiting this intent's commitOn vs validation's execution/commitment so they don't both claim 'commit on blur'. File via /new-standard.
