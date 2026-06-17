---
type: issue
workItem: story
size: 5
parent: "872"
status: active
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
tags: []
---

# Factor pure-contract modules from runtime impl across WE contracts

Prerequisite for a type-only contract package: split each WE contract module into a pure-contract half (types/interfaces only, compile-erased) and a runtime-impl half. Pilot on guard/provider.ts — a mixed module carrying contract types (GuardRegion, GuardContext, GuardDecision, CustomGuardProvider) plus runtime (assertGuardDecision, ALLOW, GuardDecisionError, NativeGuardProvider) — then apply the pattern to the other contracts (validators, positioning, validity-merge, the #694 families). The pure-contract half becomes a @webeverything/contracts entry; the runtime half stays impl (→ FUI). Without this split, only whole-file byte-copy is possible (the #834 finding).
