---
type: issue
workItem: story
size: 3
parent: "872"
status: open
blockedBy: ["875", "877"]
dateOpened: "2026-06-17"
tags: []
---

# Contract version-skew drift gate (ensure FUI tracks the published contract version)

Mitigates the new drift surface the package model introduces: #170 byte-equality guaranteed FUI==WE now, but a pinned npm version lets FUI lag WE's contract (version skew). Add a check (CI/check:standards lane) that fails when a consumer (FUI, plateau-app) depends on a non-current @webeverything/contracts version, so the package dependency is as drift-tight as the byte gate it replaces. Risk-mitigation story for the #872 epic.

## Blocked-in-fact on #877 (2026-06-17, batch-2026-06-17)

The version-skew surface this gate guards **does not exist yet**: consumers currently resolve `@webeverything/contracts` via the #878 **dev-time path-mapping** (`../webeverything/contracts` source) — there is no pinned version, so FUI always tracks WE's current contract and cannot skew. A "non-current version" can only arise once #877 stands up **published, versioned** packages and a consumer's `package.json` pins one. Building the gate now would have nothing to check (no version field in any consumer dep). Added `blockedBy: ["877"]`; cascade-frees once publication exists. (#875, the byte-copy retirement this guards the replacement of, is resolved.)
