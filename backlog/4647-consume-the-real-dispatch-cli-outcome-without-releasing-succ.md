---
bornAs: x34sep8
kind: story
size: 3
tier: pinned
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
relatedReport: reports/2026-09-30-builder-launch-misread-root-causes.md
---

# Consume the real dispatch CLI outcome without releasing successful build claims

The builder parses the CLI summary as a persisted run, so every accepted launch lacks the effects array it expects. The 2026-09-30 probe reproduced the false failure from the real outcome serializer; consume its runId through the same run store and validate the dispatch effect before changing ownership.

## Evidence

we:skills-src/conveyor/build-dispatch-daemon.mjs:127; we:scripts/operations/cli-adapter.mjs:1210; we:skills-src/conveyor/build-dispatch-daemon.mjs:419. Full incident evidence: we:reports/2026-09-30-builder-launch-misread-root-causes.md.

## Design

Use the actual CLI envelope contract, resolve its runId in the configured store, and validate operation, item, effect type, status and pollable handle. Preserve ownership for indeterminate or unreadable confirmation; release only a confirmed refusal. Never treat the planner verdict or a bare inFlight key as proof of launch. Keep the generic envelope compatible.

## Done when

1. An integration probe serializes a real dispatch outcome through outcomePayload and feeds the builder boundary: a persisted accepted dispatch retains its claim, guard and capacity accounting, with no failure or hold. Cover failed, refused, corrupt, missing and mismatched records without launching agents.
2. Soak break: after the regression gate, stop active development for at least 30 minutes while the normal builder performs at least three naturally scheduled ticks and one real eligible delivery. Capture correlated run IDs, dispatch acknowledgements, claims and occupancy before and after the break; zero missing-effect failures and zero duplicate launches. Do not force retries to satisfy the soak.

## Follow-ups

The diagnosis-only lane could not run its gates: the sandbox denied the verifier marker and the standards admission lock. Run both gates in the implementing lane with normal repository permissions; do not bypass either.

Keep serializer-to-consumer and process-lifecycle probes at the real boundary; helper-only fixtures did not reveal this incident. Record testing lessons here, not in shared agent documentation.
