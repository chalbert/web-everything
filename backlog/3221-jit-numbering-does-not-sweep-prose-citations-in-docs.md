---
bornAs: xm1y7m2
kind: task
parent: "2288"
status: open
dateOpened: "2026-08-21"
tags: []
---

# JIT numbering does not sweep prose citations in docs/

When an item lands, the drain renumbers its hash id to NNN and sweeps backlog blockedBy edges, but not prose citations outside we:backlog/. Observed 2026-08-21: #3214 was ratified and codified into we:docs/agent/platform-decisions.md while still the hash 3214; the drain numbered the card and rewrote the three sibling edges to 3214, leaving the standard citing an id that no longer exists. Recurs whenever a decision is codified into a standard before it lands — the codifiedIn field makes that the normal path, not an edge case.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
