---
type: idea
workItem: story
size: 3
parent: "604"
status: open
blockedBy: ["733"]
dateOpened: "2026-06-16"
tags: []
---

# Roll out the fuiDemo embed to the remaining WE blocks whose FUI demo already exists

Apply #733's one-line {% fuiDemo %} pattern across the blocks with an existing FUI-hosted demo: for-each (for-each-demo.html), tabs (view-tabs-demo.html), interpolation-text-node (text-interpolation-demo.html), nav-list/nav-section (navigation-demo.html), conditional-view (visibility-gate.html), tooltip (positioning-shift.html). One line each in the description partial; static code sample retained. Full coverage of demo-less blocks stays external-gated (#705/#398).
