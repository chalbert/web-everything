---
bornAs: xtr4j8i
kind: story
size: 3
parent: "2489"
status: resolved
scaffoldedBy: "evidence-cards"
dateScaffolded: "2026-07-14"
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability, evidence]
---

# Loop console — operating-evidence view (summarizeEvidence + cli evidence; feeds #2456)

Turns the daemon's raw pass journal into decision-grade operating evidence — the #2456 gate's questions
(did drain-class incidents stop; how often did restart-recovery run) plus the throughput / park /
human-pull-in trends (handoff rec #3). A PURE `summarizeEvidence` reducer over the FULL journal (not the
status tail): span, per-window classification, lifetime counters, throughput bucketed over time, merge /
park / fail / noop / idle rates, pass-duration avg/p95, distinct `review:human` PRs pulled in, drain-class
incidents. Plus a `plateau:tools/drain-daemon/cli.mjs` `evidence [--json]` command that reads the whole
journal on-demand (not the 5s poll) and prints it with a throughput sparkline. Deterministic, never throws,
fresh-process (no daemon restart). Precise time-to-land needs slice B's per-pass PR ids (out of scope; merge
throughput is the proxy). Browser panel is the follow-up (2494). Impl in plateau-app; WE holds zero impl.

