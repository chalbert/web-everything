---
kind: decision
parent: "xjbdhzb"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should diff size refuse a PR, not just escalate it

The contract states diffLines 400 is a care-level signal and explicitly NOT a hard block (#2563). Human defect detection collapses past ~400 LOC and our AI PRs run 408 at p75, so a refusal is the largest deterministic lever available. Ruling this reverses a ratified decision, and it must not land before the escalation basis is recomputed cumulatively — otherwise it raises the stakes on an evasion that is already open.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
