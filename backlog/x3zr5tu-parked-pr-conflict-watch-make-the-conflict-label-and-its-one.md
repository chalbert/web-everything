---
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Parked-PR conflict watch: make the conflict label and its one-time comment crash-safe

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Finding P4 (becomes an idempotent effect). we:scripts/conveyor/parked-pr-conflict-watch.mjs writes the merge-status:conflicting label (line 1094) before posting the resolution comment (line 1154). A crash between them loses the comment for good, because the label then marks the PR as already handled. Fix shape: post the marker-deduped comment first, then the label (the comment is idempotent by marker), or record both as effects in a run record (we:scripts/operations/run-store.mjs). Done when: a test kills the watch between the two steps and the next tick completes both; LIVE proof: one real conflicting PR shows both label and comment after a forced mid-step kill in a scratch run against a test PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
