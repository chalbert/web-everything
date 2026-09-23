---
bornAs: xn7fg50
kind: story
size: 5
parent: "3963"
status: active
blockedBy: ["3956"]
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
tags: []
---

# Multi-repo slice 4: repo-aware fix and CI briefs

The fix and CI-heal briefs cd into the lane and then run WE scripts by relative path (rearm, stand-down, ci-heal-mark) with no --repo, and hardcode WE's check:standards gate -- in a plateau lane those scripts don't exist. Add {{REPO}}, {{LANE_REPO}}, {{GATE_COMMAND}}, {{WE_ROOT}}, {{ATTRIBUTION}} to BRIEF_REQUIRED_BY_KIND in we:scripts/operations/dispatch-lane.mjs; every tool call becomes node {{WE_ROOT}}/scripts/... --repo={{REPO}}; add a lint failing a relative node scripts/ call after cd into the lane.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
