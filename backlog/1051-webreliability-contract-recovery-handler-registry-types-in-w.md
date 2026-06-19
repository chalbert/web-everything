---
type: idea
workItem: story
size: 3
parent: "1019"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:reliability/contract.ts"
tags: []
---

# webreliability contract — recovery-handler registry types in @webeverything

Slice A of webreliability impl epic #1019. Define the recovery-handler registry contract (handler-registration + offline-retry/resumable-transfer types) in @webeverything per the resolved [the Project/Protocol bar](docs/agent/platform-decisions.md#project-protocol-bar)/#028/[constellation placement](docs/agent/platform-decisions.md#constellation-placement)/#503 design. Type-only crosses the seam. Foundation slice. NOTE: the protocol-level error-recovery seam is a SEPARATE design-gated slice held behind decision #1032 — not scoped here.

## Progress

Shipped `we:reliability/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/reliability`): `CustomRecoveryHandler` (the `tryRecover(error, context):
Promise<RecoveryResult | null>` provider seam), `RecoveryContext`, `RecoveryResult`, closed
`RecoveryOutcome` (`retry|queued|fallback|abort`), plus the two stateful facets `OfflineQueueEntry`
and `ResumableTransferState`. Mirrors the contract already specified in
`we:src/_includes/project-webreliability.njk`. Runtime handlers + `customRecovery` registry stay impl
(→ FUI). The protocol-level error-recovery seam stays carved out to decision #1032.
