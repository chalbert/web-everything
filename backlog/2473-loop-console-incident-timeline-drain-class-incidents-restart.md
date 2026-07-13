---
bornAs: xv9u849
kind: story
size: 3
parent: "2474"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: incident timeline — drain-class incidents, restart-recovery, lease-loss

Richer than the dev-panel seed's pass list: a timeline of drain-class incidents, restart-recovery events, and lease-loss — which doubles as the evidence surface #2456 needs.

## Resolution (2026-07-13)

Shipped in plateau PR #25: a pure `deriveIncidents` (classifies the daemon's journal passes into `drain-fail` / `dup-nnn` / `pass-killed` / `lease-contention`, plus restarts + uptime from state) folded into `buildStatusReport`, and an "Incident timeline" section in the `plateau:tools/dev-panel/drain-daemon.html` surface. Derived entirely from the existing journal (`plateau:.drain-daemon/history.jsonl` + `plateau:.drain-daemon/state.json`) — no daemon change.

Follow-up (not blocking, feeds [#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/)): structured per-event restart-recovery and lease-loss markers live only in `plateau:.drain-daemon/daemon.log` (unstructured) today, so the timeline shows a restart COUNT but not each restart/lease-loss as its own timestamped row. Emitting those as structured records (an `incidents.jsonl` the daemon appends on start + on lease-reclaim) would complete the per-event timeline.
