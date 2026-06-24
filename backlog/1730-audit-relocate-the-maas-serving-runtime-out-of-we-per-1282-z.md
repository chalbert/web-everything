---
kind: story
size: 8
status: open
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
tags: []
---

# Audit + relocate the MaaS serving runtime out of WE per #1282 (zero-implementation)

The MaaS serve core lives in WE at we:blocks/renderers/module-service/ — we:blocks/renderers/module-service/moduleService.ts (serve(), a self-described 'v1 walking skeleton' resolver), plus productionDelivery/prewarm/fetchHandler/reactivity/incrementalUpdate siblings. #1282 (resolved) ratified WE = contract/protocol/interface only, withdrawing the reference-implementation tier — so the runtime-serving portion reads as impl that belongs in FUI (impl→FUI). Audit the dir against #1282: relocate the runtime serve implementation to FUI; KEEP in WE only the allowed parts — the build-time serve() projection used as an author/validate script (we:scripts/gen-author-mode-source.mjs emitting we:src/_data/authorModeSource.json, the #954 build-emit) and any conformance vectors / IR definitions. Surfaced while ratifying #1701 (which only consumes the pre-emitted data and is unaffected). Verify per-file before moving; some of the dir may be legitimate definition/conformance that stays.

## Blocked — embedded fork (2026-06-24, `batch-2026-06-24-1768-1730`)

Claimed and ground the move: it is **not** a clean per-file relocate. The build-time author-mode projector this card keeps WE-resident (`we:blocks/renderers/module-service/authorModeSource.ts:19`) **imports `serve()`** from the `we:blocks/renderers/module-service/moduleService.ts` it relocates — moving that file would force a banned WE→FUI code import. And `serve()` (`we:blocks/renderers/module-service/moduleService.ts:17-19`) sits on the shared `we:blocks/renderers/component` / `we:blocks/renderers/jsx` / `we:blocks/renderers/functional` transform core. The coupled seam decision is filed as **#1771** (`blockedBy`); not pure-agent buildable until it settles. Released back to `open`.

## Note (2026-06-24, from #1778): owns the WE functional-impl delete

#1778 built the FUI functional renderer (`fui:blocks/renderers/functional/functionalComponent.ts`) and
relocated its test, but **could not delete** `we:blocks/renderers/functional/functionalComponent.ts`:
`we:blocks/renderers/module-service/moduleService.ts:21` value-imports `generateFunctionalSource` for the
`'functional'` ServeForm, and moduleService is WE-resident until this card relocates it. So the WE
functional impl is now an orphan *except for moduleService* — **delete it here** when moduleService moves
(its FUI twin already exists; point FUI-moduleService's `'functional'` branch at
`fui:blocks/renderers/functional/functionalComponent`).
