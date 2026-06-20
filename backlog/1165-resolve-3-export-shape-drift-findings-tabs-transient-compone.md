---
type: decision
workItem: story
size: 3
parent: "904"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Resolve 3 export-shape drift findings (tabs/transient-component/view): correct contract exports vs file FUI build

De-buried from #927 (its post-#948 map named these as "genuine findings the gate SHOULD surface, not
modeling artifacts"). The export-shape arm (#927) surfaces **3 genuine contract↔impl drifts** — declared
`we:` `exports` absent from the resolved FUI barrel (verified file-by-file 2026-06-19). Each is a
**source-of-truth call**, not a build: either the `we:` contract over-declares (correct
`we:src/_data/blocks/<id>.json` `exports` to the real impl surface) **or** the FUI impl is incomplete
(file a `locus: frontierui` build for the missing symbols).

## The 3 findings — per-block fork (correct contract ⟷ build impl)

- **`tabs`** — declares `TabsComponent` / `TabListAttribute` / `TabTriggerAttribute` / `TabPanelAttribute`;
  `fui:blocks/tabs/index.ts` ships only `TabGroupBehavior` (+ types). A whole component+attributes vs a
  single behavior — the **largest** divergence. Fork: re-spec `exports` to the `TabGroupBehavior` shape
  **or** build the component+attribute surface in FUI.
- **`transient-component`** — declares `SmartLink` + `withSelfReplacement`, both absent from
  `fui:blocks/transient/` (which ships `TransientElement`/`AutoHeading`/`calculateHeadingLevel`/
  `registerTransient`). Fork: drop the two from the contract **or** build them.
- **`view`** — declares `ViewEngineOptions` / `ViewShowBehavior` / `ViewIfDirective` / `ViewSwitchDirective`,
  all absent from `fui:blocks/view/` (which ships `ViewEngine`/`ViewBehavior` + types). Fork: trim the
  contract **or** build the show/if/switch directive surface.

**Recommended default (low confidence): correct the contract per block** (the leaner end-state — the
declared surface looks aspirational vs what FUI actually built), **unless** a block's missing symbols are
genuinely intended product surface, in which case file the FUI build. Decide per block; a "build" verdict
spawns its own `locus: frontierui` story under #904.

**Relationship to #927:** does NOT block #927's arm — warn-first surfaces these as findings (the arm's
purpose). Resolving them (+ #1164) is the prerequisite to flipping `EXPORT_SHAPE_ENFORCED`. Slice of #904.
