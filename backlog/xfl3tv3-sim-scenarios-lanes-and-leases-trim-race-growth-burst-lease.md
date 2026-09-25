---
kind: story
size: 8
parent: "x95yxvd"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim scenarios: lanes and leases (trim race, growth burst, lease reaper races, two holders per lane, TTL under a live session)

Matrix rows I-10, I-11, N-20, N-33, N-38, G-01, G-02, G-03, G-04, G-24, G-26 in we:reports/2026-09-24-daemon-scenario-simulator.md. G-01..G-04 are high-risk races expected to find real bugs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
