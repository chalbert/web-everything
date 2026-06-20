---
type: idea
workItem: story
size: 2
parent: "904"
status: open
blockedBy: ["1204", "1205", "1165"]
dateOpened: "2026-06-20"
tags: []
---

# Flip EXPORT_SHAPE_ENFORCED=true once renderer coverage and barrel-block drifts land

Terminal step of the #170/#927 export-shape arm: flip EXPORT_SHAPE_ENFORCED from false to true at we:scripts/check-standards-rules.mjs:1425 so contract↔barrel export-shape drift becomes a hard gate error, not a warning. Gated (per the const's own comment) on #1164 renderer coverage landing (#1204) + all declared-but-absent symbols resolved: the 3 barrel-block drifts (#1165) and the 3 renderer Module drifts (#1205). Flipping before those are clean would red the gate. blockedBy #1204, #1205, #1165.
