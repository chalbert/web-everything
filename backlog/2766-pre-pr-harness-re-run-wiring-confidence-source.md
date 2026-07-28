---
bornAs: xvqid81
kind: story
size: 3
parent: "2562"
status: open
blockedBy: ["2760"]
dateOpened: "2026-07-28"
tags: []
---

# Pre-PR harness re-run wiring + confidence source

Wire the harness re-run into the pre-PR flow and feed the confidence source from real signals. The harness runs the replay (replayed-tier slice) and any harness-owned probes (probe-tier slice) BEFORE the PR opens, so agent assertions are replayed-not-trusted at the gate and a criterion failing replay never reaches the green spec-proven bar. Enforce the minimum-tier launch/merge gate (from the foundation slice), and feed the launch gate's confidence (F2, #2561) from these verified per-criterion tiers + replay outcomes rather than a fixture. Blocked on the agent-authored, harness-replayed tier (the replay engine the pre-PR run invokes).
