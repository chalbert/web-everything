---
type: idea
workItem: epic
parent: "1008"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:reliability/contract.ts"
tags: []
---

# webreliability implementation — recovery-handler registry

Implementation epic for the webreliability standard (offline-retry / resumable transfer). Design lineage: #011 / #028 / #101 / #503. Scope: recovery-handler registry (contract to @webeverything, provider runtime to FUI). Carved from the #1008 triage roadmap. Slice into stories once the contract is scoped; conformance demo as proof.

**Sliced** (registry trio): #1051 (recovery-handler registry contract → @webeverything), #1052 (registry runtime → FUI, blockedBy #1051), #1053 (conformance demo, blockedBy #1051). **One slice is still held:** the protocol-level error-recovery seam is a true GAP (no design, no impl) — its contract shape is decided in [#1032](/backlog/1032-design-the-protocol-level-error-recovery-seam-for-webreliabi/) (a `type: decision` card under this epic), which must ratify (via `/prepare` → `/decision`) before the error-recovery impl slice is scoped. The registry trio above is unblocked and excludes it.
