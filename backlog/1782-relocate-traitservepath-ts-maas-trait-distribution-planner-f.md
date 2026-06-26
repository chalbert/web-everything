---
kind: story
size: 3
status: resolved
blockedBy: []
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: none
tags: []
---

# Delete the consumer-less MaaS trait-distribution-planner orphan out of WE per #1282 (was: relocate to FUI)

`we:blocks/renderers/module-service/traitServePath.ts` implements runtime trait-distribution planning (`traitServePath()`, `planTraitDistribution()`) for the MaaS serve path. Per #1282 (zero-implementation) it is impl and must leave WE.

## Re-scoped relocate → delete (2026-06-26)

Grounding the move flipped it from "relocate to FUI" to **delete**:

- **Consumer-less on both sides.** Its only runtime consumer, the #461 MaaS reference origin (`we:tools/maas/vite-plugin.ts`), was **deleted by #1730**; FUI never imported it (grep of `fui:` for `traitServePath`/`planTraitDistribution` = 0). It is 128 LOC of dead code + a 72-LOC test.
- **Not a clean import-carry.** It uses servePathIR's runtime *values* (`DEFAULT_BASE_PATH`, `SERVE_PATH.route`, `CACHE_POLICY`), and FUI's #872 type-only boundary forbids runtime cross-repo imports of WE — FUI **byte-replicates** these (`fui:tools/maas/wrapperServeHandler.mjs`). So relocating would move dead code *and* deepen the replication debt.
- **Nothing lost.** #1282 is satisfied either way; the #719 planning logic stays in git history, and the contract/IR it consumed (`we:blocks/renderers/module-service/servePathIR.ts`, the #716 trait-manifest contract) **stay in WE**. Rebuild in FUI if/when its MaaS actually serves traits — with a real consumer in hand.

## Done (2026-06-26)

Deleted `we:blocks/renderers/module-service/traitServePath.ts` + `we:blocks/__tests__/unit/renderers/traitServePath.test.ts`. WE `module-service/` now holds only contract/IR/vectors (`we:blocks/renderers/module-service/servePathIR.ts`, `we:blocks/renderers/module-service/servePathOpenAPI.ts`, `we:blocks/renderers/module-service/maas-servepath.openapi.json`, `we:blocks/renderers/module-service/conformance/`). `check:standards` clean.
