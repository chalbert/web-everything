---
kind: story
size: 3
parent: "1294"
status: resolved
locus: frontierui
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "frontierui/intl/index.ts"
relatedProject: webvalidation
relatedReport: reports/2026-06-28-split-analysis-1294-nonengine-planes.md
tags: [relocation, intl, conformance]
---

# Relocate the intl runtime (provider/registry) to FUI

Slice 1 of the intl relocation cascade (#1294). Move the executable intl runtime — provider resolution + registry from we:intl/provider.ts and we:intl/registry.ts — out of WE per #1282 to fui:intl/, importing the contract via @webeverything/contracts/intl (we:intl/contract.ts stays in WE). Register the fui:intl alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.

## Progress

- **Status:** resolved
- **Branch:** batch-parallel/batch-parallel-2026-06-28 (serial lane; WE commit on `worktree-wf_6764346c-18c-13`)
- **Done:**
  - WE: `we:contracts/intl.ts` type-only re-export of `we:intl/contract.ts`; added `./intl` to `we:contracts/package.json` exports (published FUI→WE arrow, #872).
  - FUI: `fui:intl/provider.ts` (`NativeIntlProvider` + `nativeIntlProvider`), `fui:intl/registry.ts` (`CustomIntlProviderRegistry`, single active provider), `fui:intl/index.ts` barrel (`createDefaultRegistry`), `fui:intl/__tests__/registry.test.ts` (12 tests, green). All import the contract via `@webeverything/contracts/intl`, never a local copy.
  - FUI alias `@webeverything/contracts/intl` → WE `we:contracts/intl.ts` registered in `fui:vitest.config.ts` (+ the `intl/**/__tests__` include glob), `fui:vite.config.mts`, `fui:tsconfig.json`.
- **Next:** all done — FUI vitest (12/12) green. The WE `we:intl/` runtime + tests + `we:demos/webintl-conformance-demo.ts` stay in place (deleted in a later W4 slice), so each slice ships independently.
- **Notes:** Mirrors #1799 (webpolicy W1). Per #1282, WE keeps only definitions (`we:intl/contract.ts`); the executable runtime is FUI's.
