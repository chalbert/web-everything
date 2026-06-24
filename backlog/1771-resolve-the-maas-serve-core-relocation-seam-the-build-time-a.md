---
kind: decision
status: open
relatedProject: webcomponents
blocks: ["1730"]
dateOpened: "2026-06-24"
tags: [maas, placement, zero-implementation, renderers, devtools-placement]
---

# Resolve the MaaS serve-core relocation seam — the build-time author-mode projector imports the serve() the card relocates

The #1730 relocate is not a clean per-file move: the build-time author-mode projector that #1730 keeps WE-resident imports the serve() core that #1730 moves to FUI, and serve() itself sits on the shared component/jsx/functional renderer transform core — so satisfying #1282 needs a real seam decision, not a file shuffle.

## The entanglement (verified 2026-06-24, claiming #1730)

#1730 says: relocate the MaaS runtime serve impl → FUI, **keep** in WE only the build-time `serve()` projection (the #954 author-mode build-emit) + conformance vectors + IR defs. Grounding the move shows the seam isn't clean:

- **The staying projector imports the moving core.** `we:blocks/renderers/module-service/authorModeSource.ts:19` — the #954 build-emit projector that `we:scripts/gen-author-mode-source.mjs` runs at build time and that #1730 keeps WE-resident — does `import { serve, FORMS, ServeForm } from './moduleService'`. If `we:blocks/renderers/module-service/moduleService.ts` moves to FUI, this WE-resident projector would import FUI code — a **banned WE→FUI backward edge** (DAG; the DAG bans upstream WE→FUI code imports, #1595).
- **`serve()` sits on the shared renderer transform core.** `we:blocks/renderers/module-service/moduleService.ts:17-19` imports `parseDefinition`/`generateClassSource` from `we:blocks/renderers/component/declarativeComponent`, `htmlToJsx` from `we:blocks/renderers/jsx/htmlToJsx`, and `generateFunctionalSource` from `we:blocks/renderers/functional/functionalComponent`. Moving `serve()` either drags that whole transform core to FUI or stands up a FUI→WE-impl edge — neither is in #1730's "move `we:blocks/renderers/module-service/`" scope.
- **The #461 reference origin couples in.** `we:tools/maas/vite-plugin.ts:52-61` ssr-loads `we:blocks/renderers/module-service/moduleService.ts` + `we:blocks/renderers/module-service/definitionRegistry.ts` + `we:blocks/renderers/module-service/fetchHandler.ts` at runtime (the WE-resident delivery origin flagged in #1770). It moves with the serve core.
- **The gate reads the file.** `we:scripts/check-standards.mjs:1204` + `we:scripts/check-standards-rules.mjs:1253` read `we:blocks/renderers/module-service/moduleService.ts` for the `ServeForm`-union conformance check — the gate path follows wherever the union lives.

## What you decide

How to satisfy #1282 (runtime delivery out of WE) without breaking the WE-resident #954 author-mode build-emit. Rough branches (to be prepared):

- **A — Split serve() into a build-time kernel (stays) + runtime delivery (moves).** Extract the minimal `serve()`/`FORMS` projection kernel that `we:blocks/renderers/module-service/authorModeSource.ts` + conformance vectors need into a WE-resident author/validate module; move only the delivery siblings (`we:blocks/renderers/module-service/fetchHandler.ts`, `we:blocks/renderers/module-service/productionDelivery.ts`, `we:blocks/renderers/module-service/prewarm.ts`, `we:blocks/renderers/module-service/reactivity.ts`, `we:blocks/renderers/module-service/incrementalUpdate.ts`) + the `we:tools/maas/vite-plugin.ts` origin → FUI. Open question: does the kernel still drag `we:blocks/renderers/component`/`we:blocks/renderers/jsx`/`we:blocks/renderers/functional`?
- **B — Graduate the whole `we:blocks/renderers/` transform core to FUI**, and have WE's build-emit consume it across a runtime boundary (CLI / cross-origin, the DAG bans upstream WE→FUI code imports, #1595), not a code import — `we:scripts/gen-author-mode-source.mjs` runs the FUI tool to emit `we:src/_data/authorModeSource.json`. Larger, but aligns all renderer impl to #1282.
- **C — Treat the WE module-service runtime as a redundant reference impl and delete it** (FUI already ships its own #1029 wrapper-serve origin). Keep only the build-time `serve()` kernel + conformance vectors + IR. Needs verification that #1029 supersedes the module-service serve path (they may be distinct: MaaS serves authored components, #1029 serves framework wrappers).

## Lineage

Surfaced claiming #1730 in `batch-2026-06-24-1768-1730` (a buried fork the pre-flight skim missed; caught at claim-time grounding). #1730 `blockedBy` this. Grounds: #1282 (zero-impl), `we:docs/agent/platform-decisions.md` devtools-placement, the DAG bans upstream WE→FUI code imports, #1595. Same shape as #1577→#1747 (a relocate card that was actually a coupled design fork).
