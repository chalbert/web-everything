---
kind: story
size: 3
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Key the verify marker to what changed, not the exact commit

Today we:scripts/verify-lane.mjs's marker is keyed to the exact HEAD sha (readVerifyMarker/verifyGateDecision in we:scripts/lib/lane-verify.mjs; the finish-write compare-and-set in we:scripts/verify-lane.mjs) — any new commit on the lane, including a no-op merge of origin/main, invalidates the green marker and forces a fresh full run. Evidence: a mid-work merge of main (#2818/#2819 landing meanwhile) forced a re-run even though it conflicted only on we:scripts/operations/ci-heal-pr-dispatch.mjs, a file outside the lane's own touch-set. Change the marker's validity key from exact-sha to no-lane-relevant-file-or-affected-test changed since the marker was recorded, reusing the same changed-file/affected-test computation we:scripts/lib/verify-lane-gate.mjs's resolveDefaultGate already derives for gate selection, so a merge touching none of those files keeps the marker green while a genuinely overlapping merge still forces a re-run. Must stay safe for we:scripts/pr-land.mjs's finish-guard (#3321): it must still refuse to land on a marker whose recorded sha predates a real overlapping change.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
