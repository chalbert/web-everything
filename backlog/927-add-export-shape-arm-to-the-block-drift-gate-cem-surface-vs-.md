---
type: issue
workItem: story
size: 13
parent: "904"
status: open
locus: webeverything
blockedBy: ["916", "917", "918", "919", "920", "921", "922", "923", "924", "925", "948"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# Add export-shape arm to the block drift gate (CEM surface vs actual impl exports)

Extend validateBlockImplConformance (we:scripts/check-standards-rules.mjs) with a second arm that compares each block's declared exports/CEM surface against the resolved FUI impl module's ACTUAL exports — the deeper content-equality the #170 hazard implies (#659 shipped impl-existence only). Needs a TS export parse of the resolved impl; gated on all 10 impls existing (#916–#925) so there are exports to parse. locus webeverything. Slice of #904.

## Attempted in batch-2026-06-18 — surfaced a cross-block modeling mismatch; not a clean slice

Prototyped the export-shape arm (`validateBlockExportShape` + an fs-walk export gatherer in
`we:scripts/check-standards.mjs`) gathering each impl module's actual exports (named decls + re-export
resolution) and comparing against the contract's `exports`. Running it against the real corpus
revealed the arm **cannot be enforced cleanly yet** — it fails **7 pre-existing blocks** for two
structural reasons, not real export typos:

- **`implementedBy` names one file, `exports` span the module.** `router` points at
  `we:RouteViewElement.ts` but declares `registerRouter`/`RouteOutletElement`/… which live in sibling
  files (`we:registerRouter.ts`, `we:RouteOutletElement.ts`); same for `for-each`, `tabs`,
  `transient-component`. A single-file gather can never see them.
- **Package-specifier / `export type *` re-exports aren't statically resolvable by regex.**
  `resource-loader`/`type-ahead`/`view` re-export their type surface via
  `export type * from '@webeverything/contracts/…'` — a cross-package wildcard a regex gatherer can't
  follow, so it can't prove the surface.

**Conclusion:** a sound, enforce-ready export-shape gate needs (a) the `implementedBy`↔`exports`
modeling **aligned** first — either point `implementedBy` at an enumerable module index, or scope
`exports` to the named file — across the ~7 mismatched blocks, **and** (b) a real module resolver
(a TS program, not regex) that follows package + `export type *` re-exports. Reverted the prototype
(the gate must not ship false positives). **Re-scoped to size 8**; should carry a prereq to first fix
the `implementedBy`↔`exports` alignment (its own cleanup item) before the resolver lands. Released.

## Post-#948 map (alignment prereq done — what the resolver will meet)

#948 re-pointed every deep-file `implementedBy` (in the block JSON under `we:src/_data/blocks/`) at the
enumerable index barrel (e.g. `fui:blocks/router/index.ts`; CEM `path` regenerated to match). When the
real TS resolver lands here, it will partition into three groups — only the first is "clean", the rest
are **genuine findings the gate SHOULD surface**, not modeling artifacts to suppress:

- **Clean (barrel re-exports the full declared surface):** `router`, `for-each`, `type-ahead`,
  `resource-loader`. These were the true modeling artifacts #948 fixed — the resolver should pass them
  (note `resource-loader`/`type-ahead` still need the `export type *`/package re-export following, the (b)
  resolver work — regex can't prove them but a TS program will).
- **Real export drift — needs a source-of-truth call, NOT a modeling fix** (the barrel sees all siblings,
  has no wildcard, yet these declared symbols are absent from `fui:blocks/<block>/` entirely):
  - `tabs` — declares `TabsComponent`/`TabListAttribute`/`TabTriggerAttribute`/`TabPanelAttribute`; FUI
    ships only `TabGroupBehavior` (+ types). A contract(component+attributes)↔impl(single behavior)
    divergence. Resolve by either correcting `we:` `exports` to the `TabGroupBehavior` shape **or** filing
    a FUI build for the component+attribute surface.
  - `transient-component` — declares `SmartLink`, `withSelfReplacement` (absent from `fui:blocks/transient/`).
  - `view` — declares `ViewEngineOptions`, `ViewShowBehavior`, `ViewIfDirective`, `ViewSwitchDirective`
    (absent from `fui:blocks/view/`).
- **Renderer blocks have no barrel** — `collection-operations`, `data-grid`, `data-table`, `pagination`,
  `reorderable-list` keep a dir-style `implementedBy` (under `fui:blocks/renderers/`) but the dir holds
  only leaf modules (no index barrel). The resolver's gather must either walk the dir or require FUI to
  add a barrel — a design point #948 left untouched (it's FUI/gather scope, not WE `implementedBy`↔`exports`
  modeling). Decide it when (b) lands.
