---
kind: story
size: 3
status: open
blockedBy: []
dateOpened: "2026-06-26"
tags: []
---

# Relocate we:blocks/renderers/module-service/traitServePath.ts to FUI per #1282

`we:blocks/renderers/module-service/traitServePath.ts` implements runtime trait-distribution planning (`traitServePath()`, `planTraitDistribution()`) for the MaaS serve path. It imports only from WE contracts (`we:blocks/renderers/module-service/servePathIR.ts`, `we:tools/trait-enforcer/traitManifestContract`) so #1730 left it in place without breaking any import. Per #1282 (zero-implementation) it is impl and belongs in `fui:blocks/renderers/module-service/`. Move the module and its `we:blocks/__tests__/unit/renderers/traitServePath.test.ts` to FUI, then delete the WE copies.
