---
bornAs: xvj8sj0
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# verify has no gate input, so it cannot replace the call sites that choose one

The `verify` operation shells `we:scripts/verify-lane.mjs` but forwards no gate, while that home takes a gate command and `we:skills-src/conveyor/delivery-agent-brief.md` passes the item locus gate. So every call site choosing a gate cannot be rewired to the operation without silently dropping it — the #3224 scan flags the line and the honest answer today is an exemption marker. Add a gate input that passes through, and the exemption goes away.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
