---
type: issue
workItem: story
size: 8
parent: "099"
status: open
blockedBy: ["558", "442"]
dateOpened: "2026-06-14"
tags: [auto-update, runner, pre-test, cross-consumer, frontier-ui, webregistries]
---

# Auto-update cross-consumer pre-test edge (the WE-net-new capability, via #092 graph)

Slice 3 of the #497 ruling (Fork 1 → A) — the one capability no incumbent offers. Pre-test a provider version against its consumers' suites BEFORE release, using the #092 provider↔consumer graph (graduated to webregistries; runtime graph built in #442). This is the WE-net-new edge that justified building an orchestrator rather than a pure config-emitter. Needs central graph knowledge a single-repo CI runner lacks, so it is the part most suited to the deferred hosted tier. Blocked by slice 1 (#558, the orchestrator core) and the #092 runtime graph (#442). Publishes @frontierui. Per #497 Ruling and slice plan.
