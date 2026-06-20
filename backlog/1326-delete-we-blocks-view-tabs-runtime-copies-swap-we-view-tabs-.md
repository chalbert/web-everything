---
kind: story
size: 3
parent: "1245"
status: open
dateOpened: "2026-06-20"
relatedProject: webblocks
locus: webeverything
tags: [blocks, duplication, single-source, frontierui, view, tabs, runtime]
---

# Delete we:blocks/{view,tabs} runtime copies — swap WE view-tabs demo to a #701 fuiDemo iframe (FUI canonical)

Slice of #1245 now unblocked (C #1312 landed; fui:demos/view-tabs-demo.html self-bootstraps). Delete we:blocks/view/ and we:blocks/tabs/ per the #1246 elimination ruling; re-host we:demos/view-tabs-demo.html as a #701 fuiDemo iframe pointing at the FUI-hosted demo so the page keeps working after the local runtime is gone.
