---
kind: task
parent: "3383"
status: active
scope: ["we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
tags: []
---

# stood-down PRs are invisible in the operator queue

A conveyor stand-down comment changes no labels by design, so a stood-down PR without review:human sits in nobody's queue (live: PR #2505). we:scripts/operations/operator-queue.mjs gets a STOOD DOWN section listing every open PR carrying a leading-line STAND_DOWN_MARKER comment, reusing we:scripts/conveyor/stand-down.mjs's countStandDownComments.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
