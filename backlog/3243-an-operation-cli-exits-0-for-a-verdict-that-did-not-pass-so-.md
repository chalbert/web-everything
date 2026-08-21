---
bornAs: x0uj8hj
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# an operation CLI exits 0 for a verdict that did not pass, so a caller reading the exit code reads green

Measured on `verify`: a `check` run returning `ok: false` with a non-empty `blocking` list exits **0**, because `we:scripts/operations/cli-adapter.mjs` maps `stopped: complete` to exit 0 and never consults the verdict. Any skill or shell following the raw homes convention (`we:scripts/verify-lane.mjs` exit 2 = red) then reads a red verification as green. `we:skills-src/conveyor/delivery-agent-brief.md` carried exactly that prose beside the rewired command until this was found. The operation layer is what turned a three-valued answer into data, so either the exit code agrees with the verdict or every caller must be told never to read it. Decide which, then make it structural.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
