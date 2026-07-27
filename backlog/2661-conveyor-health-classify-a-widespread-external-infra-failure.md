---
bornAs: xya70as
kind: story
size: 3
parent: "2606"
scope:
  - we:scripts/readiness/conveyor-state.mjs
  - we:scripts/readiness/__tests__/conveyor-state.test.mjs
  - we:scripts/conveyor/infra-blocked.mjs
  - we:scripts/conveyor/__tests__/infra-blocked.test.mjs
  - we:scripts/conveyor/status-board.mjs
  - we:scripts/conveyor/__tests__/status-board.test.mjs
  - we:scripts/conveyor/tick-core.mjs
  - we:scripts/conveyor/__tests__/tick-core.test.mjs
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

## Scope note (file-level rescope, #2619 finer-lease)

Narrowed from the two whole dirs (`we:scripts/readiness/` + `we:scripts/conveyor/`) to the three files the health
scan actually touches: the scan itself lives in `we:scripts/readiness/conveyor-state.mjs` (`assessHealth` — the
per-lane stall verdict that must learn to cluster same-cause failures); the shared-external-cause correlation +
defensive githubstatus poll already live in `we:scripts/conveyor/infra-blocked.mjs` (`correlateCause` /
`fetchGithubStatus`), which this item extends; and `we:scripts/conveyor/status-board.mjs` renders the single
`degraded-infra` signal. `we:scripts/conveyor/tick-core.mjs` is the live tick-loop consumer of
`state.health.stalled` — it currently pushes one "lane-stalled" note per lane, so it must change to emit ONE
degraded-infra note (else the N alarms persist in the tick loop even after the scan clusters them). Each carries its
`__tests__` file. This de-collides #2661 from the couple item #2684 (both
formerly held the whole `we:scripts/readiness/` dir). It stays coupled to #2641 only via `we:scripts/conveyor/`,
which #2641 legitimately holds while it builds the ledger pipe.
