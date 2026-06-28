---
kind: story
size: 3
parent: "1294"
status: open
dateOpened: "2026-06-28"
relatedProject: webvalidation
relatedReport: reports/2026-06-28-split-analysis-1294-nonengine-planes.md
tags: [relocation, intl, conformance]
---

# Relocate the intl runtime (provider/registry) to FUI

Slice 1 of the intl relocation cascade (#1294). Move the executable intl runtime — provider resolution + registry from we:intl/provider.ts and we:intl/registry.ts — out of WE per #1282 to fui:intl/, importing the contract via @webeverything/contracts/intl (we:intl/contract.ts stays in WE). Register the fui:intl alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.
