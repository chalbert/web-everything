---
kind: story
size: 3
parent: "1294"
status: open
dateOpened: "2026-06-28"
tags: []
---

# Relocate the reliability runtime (provider/registry) to FUI

Slice 1 of the reliability relocation cascade (#1294). Move the executable reliability runtime — provider + registry from we:reliability/provider.ts and we:reliability/registry.ts — out of WE per #1282 to fui:reliability/, importing the contract via @webeverything/contracts/reliability (we:reliability/contract.ts stays in WE). Register the fui:reliability alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.
