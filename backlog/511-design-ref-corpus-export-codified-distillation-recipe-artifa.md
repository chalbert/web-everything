---
type: idea
workItem: story
size: 3
parent: "490"
status: open
dateOpened: "2026-06-14"
tags: []
---

# Design-ref corpus export + codified distillation recipe artifact (per #488 F5)

A versioned, model-agnostic training artifact for the on-device verdict classifier: a design-refs export step that reads items/*/meta.json (visionVerdict) + quarantine/* into a {frame,verdict} training manifest with a held-out split, plus the distillation recipe (config + dated-revision log) so a base-model switch re-runs the recipe rather than re-labelling. Reads the format archiveQuarantinedFrame (#489) already materialises; fixture-tested like archive-quarantine.test.mjs, so it builds without real corpus data. Slice A of epic #490.
