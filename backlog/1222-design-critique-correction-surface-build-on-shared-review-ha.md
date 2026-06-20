---
type: issue
workItem: story
size: 8
parent: "1033"
status: open
blockedBy: ["1036"]
dateOpened: "2026-06-20"
tags: [design-reference, vision, design-critique, human-in-the-loop, plateau, training-data]
---

# Design-critique correction surface — build on shared review harness (preserve-both records)

Build the plateau-app surface that shows a page's #1034 design critique, lets a human comment + correct it (8 closed axes 1-5 + open findings CRUD incl. drag-box regions), and persists each pair preserve-both per the #1036 ruling: { proposed (read-only), corrected (gold), comment, annotator/timestamp/verdict }. Per Fork-1A, extract the contract-agnostic review harness (queue / screenshot-canvas / persist / no-leakage shell) shared with plateau:src/vision-review/ (#1084) and migrate the twin onto it; the critique editor composes it. Phase-1 localStorage (key plateau.design-review.v1) + seed queue; corpus read/write-back parked to #554. Un-parks the #513 distillation loop.
