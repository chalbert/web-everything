---
bornAs: xt97yt1
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# report an operation that shells its home but exposes no pure argv builder

The mechanizable half of #3253 rests on a convention: an operation that shells the home it declares over exports a PURE argv builder, so a test can assert the exact command with no subprocess (`planOpen`, `verifyArgv`, `listArgv`). Nothing enforces it. A new operation that shells a home without one silently leaves the argv-equivalence check unbuildable for that operation, and the gate stays green. Deferred from #3253 because detecting a pure argv builder from source is heuristic — matching an exported *Argv or plan* name is a guess, and a heuristic gate over a convention manufactures false findings. Decide whether the registry should require it declaratively instead.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after (see the parent #3253 for the shape).
