---
kind: story
size: 5
parent: "3718"
status: active
scaffoldedBy: "prepare-3690"
dateScaffolded: "2026-09-20"
scope: ["we:scripts/conveyor/"]
dateOpened: "2026-09-20"
tags: []
---

# Build the concurrent-baseline comparison harness for delegation trials — run the same task through Claude and the delegated provider and judge the difference

#3690 Fork 2 ratifies a concurrent-baseline comparison as the evidence shape a delegation-trial bar should reach, and files the harness here rather than ruling it. Today selectSupervisionLevel counts a trailing clean streak against a fixed N; #3690's own grounding shows that is not statistical evidence (95% upper bound on the failure rate at N=5 is 45.07%, computed). Mature progressive-delivery systems compare a canary against a CONCURRENT BASELINE instead of counting clean runs -- Spinnaker Kayenta runs a Mann-Whitney nonparametric test per metric, wrapped by Argo Rollouts as an AnalysisTemplate per promotion step. Build the equivalent here: dispatch the same task to Claude and to the delegated provider, capture both diffs, judge the difference, and record the comparison as a trial pair in we:scripts/conveyor/run-scorecards.json so the router can read it. Two real comparative rows already exist in that store (claude-native/claude-sonnet-5 vs antigravity/claude-sonnet-4-6 on the same PR 2223 diff, both scoredAt 2026-09-15T14:35) -- they were produced by hand, which is the gap this closes. Not a re-ratification of the bar: #3690 Fork 2 clause (i) already requires the bar to be proportionate to what graduation unlocks, and this item supplies the better evidence that clause would draw on.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
