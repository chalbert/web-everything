---
kind: task
parent: "2502"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/"]
dateOpened: "2026-09-08"
tags: []
---

# Add a runCli-level integration test proving headSha survives into every emitted merge-sweep bucket (#2502 follow-on)

#2502 added a tip commit headSha to every considered-PR entry we:scripts/merge-ai-prs.mjs's buildDrainVerdicts attaches, and threaded it through planLabelDrain's deferred bucket. Its own tests prove headSha survives onto the exported buildDrainVerdicts/planLabelDrain objects (verdicts, plan.ready, plan.deferred entries) — the literal, unmodified objects the runCli push/map sites for all six emitted buckets (toMerge/merged/skipped/parked/deferred/failed) read .headSha off, with no rebuild or field-drop in between. Two independent converge review rounds on #2502 asked for a stronger test that drives we:scripts/merge-ai-prs.mjs's runCli() itself (mocking gh/execSync) and asserts headSha directly on result.toMerge/merged/skipped/parked/deferred/failed, rather than relying on object-identity through the exported functions. runCli is not currently exported and no existing test in we:scripts/__tests__/merge-ai-prs-*.test.mjs drives it directly — a deliberate standing convention per that suite's own file-header docs. Satisfying the ask needs exporting runCli (or extracting its bucket-construction into a separately-testable helper) plus a real gh/execSync mocking harness, which is out of #2502's own scope. Filed so the review committee's prevention guard is captured rather than dropped. Done when: a test exists that exercises the real runCli() code path (or an extracted, separately-exported equivalent) and asserts a non-null real oid is present on at least one entry of each of the six result buckets.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
