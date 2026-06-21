# WE reference-renderer disposition (data-table / pagination) — prep for #1467

**Date:** 2026-06-21 · **Decision item:** [#1467](/backlog/1467-disposition-of-we-reference-renderers-data-table-pagination-/)
· **Blocks:** [#1355](/backlog/1355-fui-host-data-table-renderer-demo-swap-we-page-to-701-iframe/),
[#1356](/backlog/1356-fui-host-pagination-renderer-demo-swap-we-page-to-701-iframe/)
(slices of epic [#1353]) · **Governing ruling:** [#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)
(constellation placement — the conformance-gate carve-out) · **Reference-runtime epic:** [#1245]

This is **not greenfield design** — it ratifies the disposition of *shipped* WE files against an
already-ratified constellation rule. So per the prepare workflow it **skips the web prior-art survey**
and instead runs the **concrete-refs check**: trace the actual imports / tests / demo copy in the real
tree and apply the governing ruling. All refs below were verified on disk 2026-06-21.

## The premise that #1353 batched on is false

The #1353 split analysis batched #1354/#1355/#1356 on *"no shared importer → clean per-demo delete+swap"*
(the #1326 pattern: build FUI demo → swap WE page to a #701 `fuiDemo` iframe → **delete** the WE runtime
copy). For `view`/`tabs` (#1326, resolved) that premise held — they were pure delivery runtime. For
data-table / pagination it **does not**:

1. **A WE runtime coordinator hard-imports both renderers.**
   `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts:23-27`:
   ```ts
   import {
     applyPipeline, aggregate,
     type Row, type DataTableConfig, type GroupResult,
   } from '../data-table/renderDataTable';      // L23-26 — VALUE import
   import type { PageState } from '../pagination/renderPagination';   // L27 — type import
   ```
   `applyPipeline` / `aggregate` are **value** imports — deleting `data-table/renderDataTable` breaks WE
   compilation of a WE file that is *not* in the delete scope.

2. **Both renderers are the shared CI conformance reference.** The unit suites
   `we:blocks/__tests__/unit/renderers/data-table.test.ts`,
   `we:blocks/__tests__/unit/renderers/pagination.test.ts`, and
   `we:blocks/__tests__/unit/renderers/collection-operations.test.ts` all run against these exact files —
   they are the source the demo badges and CI exercise identically.

3. **The demo copy declares them references, not delivery.**
   `we:src/_data/demos/data-table-demo.json:6`: *"The renderer, the audit, and the fixtures are the **one
   shared source** the CI conformance suite runs … The renderer is a deterministic **reference**; concrete
   strategies (an alternate comparator, server-delegated ordering, virtualization) live in Frontier UI."*

So these are **conformance references + an in-WE dependency**, categorically distinct from the
zero-runtime-delivery `view`/`tabs` case the #1326 / #1245 delete targeted.

## The governing rule already settles it — #817's conformance-gate carve-out

#817 ruled the constellation cut at the contract-file seam — types → WE, all runtime → FUI — **with one
explicit exception**: *a runtime symbol stays in WE iff a WE-side conformance gate consumes it; otherwise it
moves to FUI.* These renderers are the textbook case of that exception:

- consumed by a WE-side conformance suite (the three `__tests__/unit/renderers/*` files above), **and**
- consumed by a WE runtime coordinator (`CollectionOperationsBehavior`).

Under #817's own test the renderers **stay in WE**. The #1326 delete was correct precisely because
`view`/`tabs` had *no* such WE-side consumer; data-table / pagination do.

## Classification (per-fork pass)

- **Which layer?** WE **conformance-reference** layer — not FUI impl (concrete strategies live in FUI per the
  demo copy), not pure delivery runtime (#1326 case). It is the deterministic reference the conformance
  vectors run against.
- **Fork-existence:** a genuine either/or — the renderer *files* either remain in `we:blocks/renderers/` or
  are deleted; they cannot do both. Neither branch is incoherent (b is achievable *if* the coordinator +
  conformance are first re-homed to FUI), so it is a real merit call, not a forced invariant.
- **Bias check:** the standing *separate/decouple* bias does not push toward delete here — the renderer is
  already a decoupled reference; deleting it would *couple* WE conformance to a FUI build it cannot import.

## Recommendation

**(a) Keep the renderers in WE as conformance references; re-scope #1355/#1356 to the demo-page iframe swap
only (no renderer delete).** High confidence (~90%) — #817's conformance-gate carve-out applies directly and
the alternative (b) requires re-homing a WE coordinator + relocating the CI conformance source, a larger
constellation move with no benefit the reference shape lacks. The residual is purely whether WE should host
*any* runtime reference at all (a position #817 already rejected); a future move of behavioral conformance to
a plateau tool (#899) would revisit *where the gate runs*, not whether the reference is WE-owned.

The deliverable, safe part of #1355/#1356 — building the FUI interactive surface and swapping the **demo
page** to a #701 `fuiDemo` iframe — proceeds either way; only the **renderer delete** is removed from their
scope.

[#1353]: /backlog/1353-fui-host-the-three-remaining-reference-renderer-demos-data-t/
[#1245]: /backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/
