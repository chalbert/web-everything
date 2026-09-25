---
bornAs: xpvbamr
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# verify-lane check calls a never-started request an abandoned backgrounded run

Live 2026-09-25: after we:scripts/verify-lane.mjs request with no runner alive, check (and the open-pr finish-guard via we:scripts/lib/lane-verify.mjs verifyGateDecision) reported 'abandoned — a backgrounded run that never completed' and told the caller to re-run in the foreground. The run was never started, only requested and never picked up. Distinguish requested-not-started from started-then-abandoned (the marker already records the request; add whether a gate ever began, e.g. the gate-execution-starting signal verify-dispatch watches), and give the correct next step for each. Prove on a live case.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
