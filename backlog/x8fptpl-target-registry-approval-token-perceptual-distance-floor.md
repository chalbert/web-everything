---
kind: story
size: 8
parent: "xnu179a"
status: open
dateOpened: "2026-08-01"
blockedBy: ["xpcdbsy"]
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# Target registry + approval token + perceptual-distance floor

An independent ratified-mock target registry; an approval token signed over the mock content hash; a perceptual-distance floor that rejects any target too close to a build screenshot and escalates a target authored in the same lane/commit as the render code. Enforces the target-is-not-the-subject invariant.
