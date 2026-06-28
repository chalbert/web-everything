---
kind: story
size: 3
parent: "1294"
status: open
dateOpened: "2026-06-28"
tags: []
---

# Relocate the analytics runtime (provider) to FUI

Slice 1 of the analytics relocation cascade (#1294). Move the executable analytics runtime — provider from we:analytics/provider.ts — out of WE per #1282 to fui:analytics/, importing the contract via @webeverything/contracts/analytics (we:analytics/contract.ts stays in WE). Register the fui:analytics alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.
