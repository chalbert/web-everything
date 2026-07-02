---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: []
---

# Split the FUI blocks/view directive registry to per-entry self-registration (mirror #1145/#1146) so directive items stay concurrent-and-merge-clean

Evidence from batch-2026-07-01-wf (2nd real multi-lane /workflow run): 3/6 concurrent items merge-failed at the central gate; #2068 and #2012 overlap the FUI directive cluster on frontierui:blocks/view/registerViewDirectives.ts and frontierui:blocks/view/index.ts (both hand-edited barrels — a templates.define() list plus an export list) shared with serial items #2075/#2076, so the probe under-predicted the shared-barrel touch and the partition ran them concurrent then conflict then gate-red then reopened. Fix: apply the same per-entry split #1145/#1146 did for the WE registries — each directive self-registers in its own file and the barrel is generated (glob) — so a new or edited directive writes ONLY its own file (disjoint) and directive-touching items stay concurrent AND merge clean, strictly better than co-serializing. Ties into the export-shape/barrel track #1164. The orchestrator self-heal (reopen plus ref-preserve) worked; this is partition-quality, not a correctness hole.

## Progress

Done. Per-entry self-registration, mirroring #1145/#1146:

- **New contract** `fui:blocks/view/viewDirectiveEntry.ts` — a `ViewDirectiveEntry` descriptor (`substrate: 'behavior' | 'template'`, `name`, `impl`) each directive file exports as `viewDirectiveEntry`.
- **Each of the 5 directive files** (`ViewShowBehavior`, `ViewIfDirective`, `ViewSwitchDirective`, `AsyncRegionDirective`, `DeferDirective`) now exports its own `viewDirectiveEntry` co-located with the class — the only file an add/edit touches.
- **`fui:blocks/view/registerViewDirectives.ts`** no longer carries a hand-edited `.define()` list: it `import.meta.glob`s the sibling `./*.ts` files (eager), filters those exporting a `viewDirectiveEntry`, and dispatches each to its substrate. Both public function signatures (`registerViewDirectives(attributes)` / `registerViewTemplateTypes(templates)`) are unchanged. Added `/// <reference types="vite/client" />` for the `import.meta.glob` type (FUI had no vite-env decl; self-contained, no shared tsconfig edit).
- **`fui:blocks/view/index.ts`** — dropped the 5 directive-class re-exports (the export-list collision); they're internal now (glob-registered; zero external importers — tests import by deep path). Barrel keeps `ViewEngine`/types/`ViewBehavior`/register fns/`resolveBinding` and now re-exports the `ViewDirectiveEntry` types.

Result: adding or editing a directive touches ONLY its own file — no shared-barrel append, so directive-touching items stay concurrent AND merge clean. **New test** `fui:blocks/__tests__/unit/view/registerViewDirectives.test.ts` (3 tests) pins the glob aggregation: view:show on the attribute substrate, all four structural directives on the template substrate matched by type value, substrates disjoint — so a directive that forgets its entry can't silently drop. Verified: `tsc --noEmit` clean for view, `check:standards` 0 errors, view unit suite 93→96 green, broader plugs/webdirectives suite green.
