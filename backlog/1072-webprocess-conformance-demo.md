---
type: idea
workItem: story
size: 3
parent: "1026"
status: open
blockedBy: ["1070", "1071"]
dateOpened: "2026-06-19"
tags: []
---

# webprocess conformance demo

Slice C of webprocess impl epic #1026 (blockedBy slice A contract). Runtime conformance demo exercising the self-driven artefact contract+runtime in a real browser, proving they satisfy the standard. Wired into the demo registry.

## Blocked-in-fact — runtime slice #1071 is the real prerequisite (2026-06-19)

Claimed in a batch and verified non-batchable: the card says "exercising the self-driven artefact **contract+runtime**", but the only WE-side artefact that exists is the **type-only, compile-erased** `we:process/contract.ts` (#1070). The runtime half — the driving loop, the meta-schema registries, default-recipe resolution — is explicitly impl that lives in **FUI/plateau-app** (per the contract module header) and is slice **B / #1071**, which is still `open`. There is nothing to exercise in a real browser yet: no runtime export in `we:process/`, no `webprocess` conformance vectors, no demo fixture. A demo would have to hand-roll the runtime, which violates the platform-first rule (it would BE slice B). Real fix applied: added `blockedBy: 1071` so the readiness projection drops it from the ready pool until the runtime lands (it was mis-flagged batchable on the contract-only blocker #1070). Cross-locus (FUI) + unbuilt → cannot be completed in a WE-only lane. Stays `open`.
