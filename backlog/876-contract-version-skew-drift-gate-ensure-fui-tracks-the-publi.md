---
type: issue
workItem: story
size: 3
parent: "872"
status: open
blockedBy: ["875"]
dateOpened: "2026-06-17"
tags: []
---

# Contract version-skew drift gate (ensure FUI tracks the published contract version)

Mitigates the new drift surface the package model introduces: #170 byte-equality guaranteed FUI==WE now, but a pinned npm version lets FUI lag WE's contract (version skew). Add a check (CI/check:standards lane) that fails when a consumer (FUI, plateau-app) depends on a non-current @webeverything/contracts version, so the package dependency is as drift-tight as the byte gate it replaces. Risk-mitigation story for the #872 epic.
