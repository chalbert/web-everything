---
type: idea
workItem: story
size: 2
parent: "904"
status: resolved
blockedBy: ["1204", "1205", "1165"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Flip EXPORT_SHAPE_ENFORCED=true once renderer coverage and barrel-block drifts land

Terminal step of the #170/#927 export-shape arm: flip EXPORT_SHAPE_ENFORCED from false to true at we:scripts/check-standards-rules.mjs:1425 so contract↔barrel export-shape drift becomes a hard gate error, not a warning. Gated (per the const's own comment) on #1164 renderer coverage landing (#1204) + all declared-but-absent symbols resolved: the 3 barrel-block drifts (#1165) and the 3 renderer Module drifts (#1205). Flipping before those are clean would red the gate. blockedBy #1204, #1205, #1165.

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Flipped `EXPORT_SHAPE_ENFORCED false → true` in `we:scripts/check-standards-rules.mjs` (the const guarding the #170/#927 8e arm). Contract↔barrel export-shape drift is now a **hard gate error**, not a warning.

Safe to flip because every gating prerequisite landed this batch + earlier: #1164 renderer coverage (#1203 barrels + #1204 repoint — all 5 renderers covered), the 3 barrel-block drifts (#1165: view built #1217, tabs/transient trimmed), and the 3 renderer Module drifts (#1205/#1229/#1230). **Verified:** the full unscoped `check:standards` stays green (0 errors) with enforcement on — all 7 covered barrel blocks pass (declared `exports` ⊆ barrel surface). The 30 #1164 non-barrel blocks remain logged un-coverable (skipped, not failed) by design.

Terminal step of the export-shape arm — the contract↔impl surface is now drift-proof at the gate.
