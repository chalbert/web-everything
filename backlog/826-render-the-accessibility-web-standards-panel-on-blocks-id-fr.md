---
type: idea
workItem: story
size: 3
parent: "623"
status: open
blockedBy: ["803"]
dateOpened: "2026-06-17"
tags: []
---

# Render the Accessibility & Web Standards panel on /blocks/{id}/ from block.webStandards

Add an 'Accessibility & Web Standards' section-card to src/block-pages.njk rendering block.webStandards (one row per concern → usage prose + a 'Reference ↗' link to the concern's contract URL), with graceful absence (no field → no panel, same as fuiDemo/composesIntents). The realization layer of the #803 ruling: webStandards is the per-component realization SoT (authored on 29/75 blocks, first at blocks.json:25) and block-pages.njk currently renders none of it. Field-shape stays the flexible {concern:{usage,reference}} bag; structuring it for display is a later supported refinement, not part of this slice.
