---
bornAs: x95yxvd
kind: epic
parent: "3383"
status: open
scope: ["we:scripts/conveyor/__tests__/sim/world.mjs", "we:scripts/conveyor/__tests__/sim/scenario.mjs", "we:scripts/conveyor/__tests__/helpers/fake-gh.mjs"]
dateOpened: "2026-09-24"
tags: []
relatedReport: reports/2026-09-24-daemon-scenario-simulator.md
---

# Daemon scenario simulator — end-to-end daemon tests over fake GitHub, real git, scripted sessions

Run the REAL daemons (review, fix-dispatch, conflict watch, reapers, lane-pool, drain, self-sync + live smoke) together over many ticks against a stateful fake GitHub, real git in temp dirs and scripted fake claude sessions, with a fake clock. Design, the 98-row coverage matrix and two adversarial review rounds are in we:reports/2026-09-24-daemon-scenario-simulator.md. Step 1 (harness + 3 incident scenarios) lands with this epic; each child card is one group of matrix rows.

## Done when

1. Every matrix row in we:reports/2026-09-24-daemon-scenario-simulator.md is a scenario (green, or a filed bug it exposes), and all child cards are resolved.
