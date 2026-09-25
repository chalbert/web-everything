---
bornAs: x7i6buo
kind: story
size: 3
parent: "4163"
status: open
blockedBy: ["4164"]
scope: ["we:scripts/check-standards.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# check:standards area checks run only when their area changed (path triggers)

In --local mode, gate the area-specific sections of we:scripts/check-standards.mjs on path triggers from the changed-file set: TypeScript module-contract checks (createProgram, ~0.6s) only on blocks/plugs/demos changes; statute/memory/anchor checks (~1.9s) only on docs/agent or agent-memory changes; codegen placement (walkPkgs), plug/block drift, vite proxy coverage, Playwright container pin, template a11y only when their own inputs change. Otherwise CI's full run covers them. Trigger table lives in one declared place, next to the scope context. Done when the replay proof (4164) shows zero lane-own misses and before/after timings.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
