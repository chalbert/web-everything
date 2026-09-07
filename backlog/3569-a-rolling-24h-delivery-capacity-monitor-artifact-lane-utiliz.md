---
bornAs: xet3s3v
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/readiness/conveyor-instrument.mjs", "we:scripts/readiness/velocity-metrics.mjs", "we:scripts/conveyor/status-artifact.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/lane-pool.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# A rolling 24h delivery-capacity monitor Artifact — lane utilization, queue depth, dispatch rate, feeding mechanical + operator recommendations

The operator wants a rolling 24h view of how well the mechanical conveyor fills its available delivery capacity — lane utilization %, queue depth over time, dispatch rate, expensive-cmd (heavy-admission) concurrency, and conflict/bounce rate — feeding suggestions back to the mechanical layer and to the operator. Investigated 2026-09-07: no existing surface covers this. we:scripts/readiness/velocity-metrics.mjs (#2686) derives throughput/cycle-time/WIP from backlog dateOpened/dateStarted/dateResolved fields at WEEK granularity — a useful macro view, not a fine-grained rolling-24h operational one. we:scripts/readiness/conveyor-instrument.mjs (#2680) already has the RIGHT shape for the fine-grained half — a mark-dispatch/mark-setup CLI, a we:.conveyor/dispatch-log.json sidecar, and a poolSaturation() function — but it is confirmed DEAD: no call site in we:skills-src/conveyor/runner.mjs, we:scripts/conveyor/tick-core.mjs, or we:scripts/operations/dispatch-lane.mjs ever calls mark-dispatch/mark-setup, and no we:.conveyor/dispatch-log.json exists on disk. There is also no periodic snapshot of lane-pool state, queue depth, or heavy-admission slot usage anywhere — a rolling-window view needs new, durable time-series capture, not just a new renderer. Placement: we:backlog/3560-artifact-page-live-conveyor-queue-status-queued-in-flight-bl.md (open, blockedBy #3277) is a close cousin — a LIVE SNAPSHOT of queued/in-flight/blocked state from the same data sources (we:scripts/readiness/dispatch-plan.mjs, we:scripts/readiness/conveyor-state.mjs, lane-pool status) — but it is explicitly current-state, not historical trend; this item's rolling-24h requirement is a different data shape (a persisted time series) that #3560 does not cover and should not be forced to. The 'Decision Board' (#3277 / x7wehz2 / #3562) is the wrong home semantically — it is about WHAT TO DECIDE, not delivery throughput/capacity. Recommendation: build this as its OWN artifact (reusing #3560's live-state reads for its 'current' tile, cross-referencing it explicitly so the two surfaces don't diverge), most plausibly backed by the Artifact tool's own db capability for the rolling snapshot history rather than a repo-committed log. Exact data-collection mechanism (resurrect we:scripts/readiness/conveyor-instrument.mjs's mark-dispatch wiring vs. a fresh periodic snapshot pass) and publish cadence/mechanism (session-driven like we:scripts/conveyor/status-artifact.mjs today, or #3277's operation once it lands) are open implementation choices for whoever builds this, not dictated here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
