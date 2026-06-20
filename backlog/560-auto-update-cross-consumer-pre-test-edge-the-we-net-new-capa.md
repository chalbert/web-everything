---
kind: story
size: 8
parent: "099"
status: resolved
blockedBy: ["558", "442"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "@frontierui/auto-update-orchestrator cross-consumer pre-test — preReleaseCrossConsumerGate + ConsumerGraph/ConsumerTestRunner seams (src/index.ts)"
tags: [auto-update, runner, pre-test, cross-consumer, frontier-ui, webregistries]
---

# Auto-update cross-consumer pre-test edge (the WE-net-new capability, via #092 graph)

Slice 3 of the #497 ruling (Fork 1 → A) — the one capability no incumbent offers. Pre-test a provider version against its consumers' suites BEFORE release, using the #092 provider↔consumer graph (graduated to webregistries; runtime graph built in #442). This is the WE-net-new edge that justified building an orchestrator rather than a pure config-emitter. Needs central graph knowledge a single-repo CI runner lacks, so it is the part most suited to the deferred hosted tier. Blocked by slice 1 (#558, the orchestrator core) and the #092 runtime graph (#442). Publishes @frontierui. Per #497 Ruling and slice plan.

## Progress

- **Resolved 2026-06-14.** Added the **cross-consumer pre-test edge** to
  `@frontierui/auto-update-orchestrator` (slice 3, #497 Fork 1 → A) — the WE-net-new capability no
  incumbent offers: pre-test a provider version against *its consumers'* suites BEFORE release, gating
  from the provider side (slice 1's pre-merge gate tests inside one consumer; this fans out to all).
  - **Injected seams (no-leakage):** `ConsumerGraph.consumersOf(providerId)` — the #092/#401 provider→
    consumer graph (open graph-model in webregistries; aggregated in plateau-app platform-manager #442);
    `ConsumerTestRunner.testConsumer(consumerId, candidate)` — applies the candidate in a consumer's
    checkout and runs its suite. The package never imports `@webeverything` — it consumes the graph's
    *shape* (mirrors #401's `SeamContract`/edge vocabulary), built elsewhere.
  - **`preReleaseCrossConsumerGate(providerId, candidate, {graph, runner, options})`** → an explainable
    `CrossConsumerDecision`: walks the graph for consumers, runs each suite, **blocks the release** if any
    regresses (naming it), else `clear-to-release`; `no-consumers` when the graph knows none. Gates only
    `confirmed` edges by default (`includePotential` opts in). **Seam-contract scoping:** when a
    `changedSurface` is supplied, a consumer whose `seam.consumerRequires` is disjoint from it is skipped
    as *unaffected* (consumerRequires ⊆ provider-supplies → a change matters only if it touches a required
    member); omit it for the safe, test-everything default.
  - **Verified:** 33 package tests pass (5 new covering clear/block/no-consumers/potential/seam-scoping),
    `tsc --noEmit` clean, FU `check:standards` green. Needs the central graph knowledge a single-repo CI
    runner lacks — the part most suited to the deferred hosted tier. Completes the #558 slice family
    (1 pre-merge → 2 post-deploy rollout → 3 cross-consumer pre-release).
