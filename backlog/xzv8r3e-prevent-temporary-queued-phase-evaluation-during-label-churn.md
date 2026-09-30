---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-30"
tags: []
relatedReport: we:reports/2026-09-30-conflicting-prs-nobody-owns.md
---

# Prevent temporary queued phase evaluation during label churn

Address operator confusion caused by PRs temporarily reading as 'queued' during review:accepted label churn before conflict watchers apply review:changes.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
