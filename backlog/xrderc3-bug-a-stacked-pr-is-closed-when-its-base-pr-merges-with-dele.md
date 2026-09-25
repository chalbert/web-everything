---
kind: task
parent: "x95yxvd"
status: open
scope: ["we:scripts/lib/pr-merge-gate.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Bug: a stacked PR is closed when its base PR merges with --delete-branch

Incident I-03 (2026-09-24): merging a PR with --delete-branch deletes its branch through the refs API, and GitHub then CLOSES any PR based on it instead of retargeting. No fix exists. Reproduce with the simulator's fake GitHub (it models close-on-base-delete), then fix at the merge step (retarget dependents before deleting, or skip deletion while dependents are open). See we:reports/2026-09-24-daemon-scenario-simulator.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
