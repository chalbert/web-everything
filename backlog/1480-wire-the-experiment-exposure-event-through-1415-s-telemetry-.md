---
kind: story
size: 2
parent: "099"
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/intents/experiment.json"
tags: []
---

# Wire the experiment exposure event through #1415's telemetry sink

Ratified by #1414 (Fork 3). The experiment intent DECLARES the exposure; #1415's swappable telemetry sink DELIVERS it — a named seam, not a merge (mirrors OpenFeature's Tracking⊥Evaluation split). Residual to settle: the ordering guarantee — the exposure must fire before the arm's effect is measured; decide whether that needs a contract beyond #1415's emit.

Blocked on #1415 (the sink contract), #1479 (the intent that declares the exposure), and #1476 (the vocabulary entry). #1476 adds the experiment-exposed event to the Analytics Event Vocabulary protocol; this item is the intent-side wiring that emits it — a distinct parallel track, not a merge.

## Progress (batch-2026-06-22-1510-1483)

All three blockers verified resolved (#1415 sink, #1479 `we:src/_data/intents/experiment.json`, #1476 `we:src/_data/protocols/analytics-vocabulary.json` — stale `blockedBy` cleared). Wired the exposure emission into the experiment intent (`we:src/_data/intents/experiment.json`):

- **Summary + two description sections** declare that resolving an arm emits an Experiment Exposed event (`experimentId`/`variant`/`subjectId`) through the **analytics intent's existing `track()` emission seam** — per #1414 Fork 3 / #1415 an exposure IS a `track()` composing the #1476 vocabulary entry, **never a second transport** (OpenFeature Tracking ⊥ Evaluation).
- **Ordering residual SETTLED — no new contract.** The "exposure before measurement" guarantee is a **fixed structural invariant of the emission point**: the exposure fires AT arm resolution (when the provider returns `{value, variant, reason}`), which by construction precedes any downstream effect/metric attributed to the arm. So it needs **no contract beyond #1415's `emit`**. (De-dup of repeat exposures = the sink's emission-seam policy, not an intent surface.)

`node -e JSON.parse` valid; `check:standards` green. The exposure is a declarative intent-level seam reusing analytics — no runtime impl crosses into WE (that's the FUI/provider side).
