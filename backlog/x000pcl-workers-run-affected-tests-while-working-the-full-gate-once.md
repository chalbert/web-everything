---
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Workers run affected tests while working, the full gate once after the final commit

Evidence: a daemon-fix worker (fix procedure + #2811 unstick) spent 19 of 48 minutes in 13 full-suite verify runs. we:scripts/verify-lane.mjs already has a diff-driven default gate (we:scripts/lib/verify-lane-gate.mjs, #3372) and a run mode that skips the marker, and we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/fix-agent-ci-brief.md already point their mid-work {{GATE_COMMAND}} step at it — but the generic build/delivery briefs (we:skills-src/conveyor/delivery-agent-brief-v2.md, we:skills-src/conveyor/delivery-agent-brief.md) have no equivalent targeted mid-work step, so a worker iterating mid-task has nothing sanctioned narrower than a full suite. Give the generic worker/fixer briefs a targeted mid-work check (vitest related on the touch-set, mirroring the fix brief's GATE_COMMAND pattern) and confirm the terminal we:scripts/verify-lane.mjs request/check sequence is the ONLY full-suite run, once, after the final commit.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
