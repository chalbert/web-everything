---
bornAs: xya70as
kind: story
size: 3
parent: "2606"
scope: ["we:scripts/readiness/", "we:scripts/conveyor/"]
status: open
dateOpened: "2026-07-24"
tags: [conveyor, health, infra]
---

# Conveyor health: classify a widespread external-infra failure as one degraded-infra signal

When multiple lanes fail on the **same** external cause (GitHub PR-creation down, optionally corroborated by githubstatus.com reporting a "Partial System Outage"), the health/anomaly scan should emit **one** degraded-infra signal, not N independent stall alarms. Today N lanes blocked by one outage look like N separate stalls, which buries the real signal ("GitHub is down") under noise.

## Build

- In the health/anomaly scan, **cluster lanes that failed on a shared external cause** and emit a single `degraded-infra` signal for the cluster.
- Keep a genuine **per-lane stall** as its own signal — only same-cause external failures collapse.
- Optionally **poll githubstatus.com** as a corroborating input, done **defensively**: its own failure must never cascade into a false alarm or take down the scan.

## Acceptance

- Several lanes down on one external cause produce one `degraded-infra` signal, not N stall alarms.
- A real single-lane stall still surfaces on its own.
- A githubstatus.com poll failure degrades gracefully — no cascade.
