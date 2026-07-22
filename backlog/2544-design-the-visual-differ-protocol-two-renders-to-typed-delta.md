---
bornAs: xh4htpb
shortTitle: "Visual-differ protocol design"
kind: decision
status: open
dateOpened: "2026-07-18"
tags: []
---

# Design the visual-differ protocol — two renders to typed delta regions

Fork E follow-on from #2538: design the visual-differ protocol — the seam that turns two renders into the typed delta regions the visual-diff intent reviews (pixelmatch / odiff / reg-cli are the prior art). Mirrors Web Graph's CustomGraphLayout/CustomGraphRenderer two-seam split: the differ emits regions (type + nature + anchor); the review surface (the intent) dispositions them. Needs prep — survey the differ tools, shape the protocol contract (input renders, region output, pixel vs structural anchoring), decide the DI-injectable vendor seam.
