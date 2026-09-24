---
bornAs: xzce0e8
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Decision: one probation system for any new system or ruling

Follow-up of #3922. Generalise model probation (we:scripts/lib/model-probation.mjs, #model-probation-graduation-criteria) from models to any subject: a registry entry per subject (metrics source, baseline, tripwires, review date, exit criteria), one scheduled watcher that runs every tripwire and files review cards without switching anything off, one review routine. Exit stays an explicit operator act. The planner build is its first subject.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
