---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/agent-activity.mjs", "we:scripts/operations/live-state.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# WIP feed reads finish inside their time limit and the conveyor check never reports stopped when unsure

Live 2026-10-02: Plateau's /wip page showed unknown everywhere. The running-jobs read takes about 35s but is cut at 30s; the conveyor check times out and the page then says conveyor stopped although it runs; the publisher reads the primary webeverything checkout, 1795 commits behind. Fix: make the running-jobs read fit (filter to live rows before enrichment, longer limit), report unknown instead of stopped on a timed-out conveyor check, and read WE state from an up-to-date checkout. Source: the WIP design note from the 2026-10-02 design pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
