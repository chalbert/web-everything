---
kind: story
size: 5
parent: "2505"
status: open
dateOpened: "2026-07-27"
tags: []
---

# Feature-tracking screen case taxonomy to webcases

The full case space of the feature-tracking screen — 115 cases across 8 families: S screen (17), F feature-row (15), K forecast (9), M detail/markers (38), E error (16), L latency (13), C concurrency (3), R theme/responsive (4) — each with an FT-<family><n> code, a machine-readable assert line, and a rendered? flag. Graduate to a we:feature-tracker.webcases.ts registry + conformance test (the #797/#2553 pattern, mirroring the plateau-app plateau:card-taxonomy.webcases.ts).

Sibling to #2553 (card-state conformance spec). Error (E) and latency (L) are first-class; a completeness-critic added the concurrency (C) and theme/responsive (R) families. Open thresholds to resolve at build (fold into #2687 forecast primitive): the stalled zero-throughput window, the too-noisy variance cutoff, the min-resolved-slice sample size (no-basis vs thin vs enough), and the bottleneck fleet-share trigger.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046
