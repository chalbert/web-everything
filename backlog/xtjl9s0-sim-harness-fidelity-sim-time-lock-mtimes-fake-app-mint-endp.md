---
kind: story
size: 5
parent: "x95yxvd"
status: open
scope: ["we:scripts/conveyor/__tests__/sim/fake-clock-preload.mjs", "we:scripts/conveyor/__tests__/helpers/fake-gh-shim.mjs", "we:scripts/operations/__tests__/helpers/fake-claude-shim.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim harness fidelity: sim-time lock mtimes, fake App-mint endpoint, pagination, claude cwd contract

Close the places the simulator could lie (matrix G-41, G-42, round-2 corrections): daemon-written lock mtimes must follow the fake clock (patch fs.stat or utimes on write), a fake GitHub App mint endpoint so the token/shim rows become reachable, real per_page pagination in the fake gh, gh run list, and pin what cwd claude agents --json reports with a live probe. Also run adversarial round 3 on the matrix. See we:reports/2026-09-24-daemon-scenario-simulator.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
