---
bornAs: xd6j3hn
kind: story
size: 5
parent: "3963"
status: open
blockedBy: ["3966", "3965"]
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 7: CI-heal for frontierui and plateau

Red CI on a frontierui or plateau PR is never healed and nothing records it: reconcile marks ci-red owed-elsewhere (we:scripts/conveyor/reconcile-core.mjs:180-183), the tick heals only its own WE launches, and we:scripts/operations/ci-heal-pr-dispatch.mjs has no caller and names sessions without a repo. Make reconcile dispatch a CI-heal for every repo's ci-red, capped by the durable heal-mark count, and wire and repo-tag the dispatcher.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
