---
bornAs: xnyv96y
kind: story
size: 2
parent: "2489"
status: resolved
scaffoldedBy: "slice-d-bookkeeping"
dateScaffolded: "2026-07-14"
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — health badge + anomalies band (surface the verdict in the console)

Slice D of the health & anomaly-detection epic (parent #2489). Surface slice A's
([#2488](/backlog/2488-loop-console-detectanomalies-core-stall-zero-merge-with-read/)) rolled-up
`health` verdict + raw `anomalies` in the `plateau:tools/dev-panel/drain-daemon.html` console:
a header health badge (green healthy / amber degraded / red STUCK) as the at-a-glance smoke
detector, and a "Health" section listing each active anomaly (type · since · detail) with a
severity badge — muted when healthy, with a coloured left rule when degraded/stuck. Read-only,
from the existing 5s status poll — no new endpoint, no daemon change. Turns the console from a
mirror into a visible smoke detector (the we #477 70-min deadlock looked healthy on every counter).
