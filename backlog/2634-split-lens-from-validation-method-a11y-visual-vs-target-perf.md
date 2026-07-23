---
bornAs: x1y2w7s
kind: story
size: 5
buildQueued: true
parent: "2636"
status: open
blockedBy: ["2633"]
scope: ["we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Split lens from validation method: a11y, visual-vs-target, perf method registry

In `we:scripts/lib/review-core.mjs`, separate the *lens* (a perspective — correctness, security, a11y, perf, visual-vs-target) from the *method* (the tool that grounds it — axe scan, screenshot-diff against a target, Lighthouse, static reviewer). A juror = lens + method + model; keeping them orthogonal makes config composable. Stand up a method registry and a resolver: care-level + the diff's touch-set → the lens set → the methods each lens attaches (e.g. a UI-file diff auto-pulls a11y + visual; a script diff does not). Depends on the contract slice for the care→method mapping. Aggregation is unchanged (still `DIVERSITY_SELECTION`).
