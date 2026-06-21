---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
preparedDate: "2026-06-21"
relatedReport: reports/2026-06-21-we-reference-renderer-disposition.md
tags: [decision, renderers, conformance, webblocks, constellation]
---

# Disposition of WE reference renderers (data-table/pagination) — deletable per #1353, or kept as WE conformance references + CollectionOperationsBehavior dependency?

**Prepared 2026-06-21 — ready to ratify.** A **ratify-shipped-code** disposition call (no greenfield
design, so no web survey) grounded in the **concrete-refs check** — every import / test / demo-copy
claim below was traced on disk 2026-06-21 (session report
`we:reports/2026-06-21-we-reference-renderer-disposition.md`). The governing rule
([#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)'s
conformance-gate carve-out) already settles the one fork; the recommended default carries a **bold**
pick. **Blocks #1355 / #1356** (size 5 each) — both are `blockedBy: [1467]`; resolving this unblocks
10 pts of demo-swap work.

## The axis — is data-table/pagination the #1326 *delete* case, or the conformance-reference case?

#1355/#1356 (slices of epic [#1353]) were scoped on the **#1326 pattern**: build the FUI demo, swap the
WE page to a #701 `fuiDemo` iframe, then **delete** `we:blocks/renderers/data-table` /
`we:blocks/renderers/pagination`. That pattern is correct only for **pure delivery runtime** with no
WE-side consumer (the resolved [#1326] `view`/`tabs` case). The single axis this decision turns on is
whether these two renderers are that case. They are not — they sit on the WE side of two consumers:

- **A WE runtime coordinator hard-imports both** —
  `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts:23-27`: `applyPipeline,
  aggregate` are a **value** import from `../data-table/renderDataTable` (L23-26) and `PageState` a type
  import from `../pagination/renderPagination` (L27). Deleting `data-table` breaks WE compilation of a WE
  file *not in the delete scope*.
- **Both are the shared CI conformance reference** —
  `we:blocks/__tests__/unit/renderers/data-table.test.ts`,
  `we:blocks/__tests__/unit/renderers/pagination.test.ts`,
  `we:blocks/__tests__/unit/renderers/collection-operations.test.ts` run against these exact files.
- **The demo copy declares them references, not delivery** —
  `we:src/_data/demos/data-table-demo.json:6`: *"the one shared source the CI conformance suite runs …
  The renderer is a deterministic reference; concrete strategies … live in Frontier UI."*

**Classification (per-fork pass).** Layer → WE **conformance-reference** layer (not FUI impl, not the
zero-runtime #1326 delivery case). [#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)
ruled the constellation cut at the contract-file seam — types → WE, all runtime → FUI — **with one
explicit exception: a runtime symbol stays in WE iff a WE-side conformance gate consumes it.** These
renderers are the textbook case of that carve-out (a WE conformance suite *and* a WE coordinator consume
them), so #817's own test keeps them in WE. The standing *separate/decouple* bias does not favour delete:
the renderer is already a decoupled reference; deleting it would *couple* WE conformance to a FUI build it
cannot import.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — disposition of the data-table/pagination renderers | **(a) Keep in WE as conformance references; re-scope #1355/#1356 to the demo-page iframe swap only (no renderer delete)** | (b) Delete per #1353, after re-homing CollectionOperationsBehavior + relocating the conformance reference to FUI | High (~90%) |

## Fork 1 — keep the renderers in WE as conformance references (a) vs delete them per #1353 (b)

*Fork-existence (genuine either/or):* the renderer **files** either remain in `we:blocks/renderers/` or
are deleted — they cannot do both, and the choice changes the scope of #1355/#1356. Neither branch is
incoherent ((b) is achievable *if* the coordinator + conformance are first re-homed to FUI), so this is a
real merit call, not a forced invariant.

**Crux:** is data-table/pagination the #1326 zero-runtime-delivery case the delete targeted, or a
WE-owned conformance reference under #817's carve-out? The traced refs above answer it: they have WE-side
consumers `view`/`tabs` never had.

- **(a) Keep them in WE as conformance references.** The demo *page* still swaps to the FUI `fuiDemo`
  iframe for the interactive surface, but the WE renderer + fixtures stay as the conformance source.
  #1355/#1356 reduce to demo-page-swap only — no renderer delete, no coordinator move.
  *Tradeoff:* WE retains a small runtime reference (by design — #817 endorses exactly this).
- **(b) Delete them per #1353.** First re-home `CollectionOperationsBehavior`'s dependency (move the
  coordinator + its conformance to FUI, or have it consume the FUI renderer) and relocate the conformance
  reference, then delete. *Tradeoff:* a larger constellation move with no benefit the reference shape
  lacks; turns two clean per-demo slices into a multi-file re-home. *Rejected as the default* — it
  contradicts #817's conformance-gate carve-out and couples WE conformance to an un-importable FUI build.

**Recommended default: (a)** — high confidence (~90%). #817's carve-out applies directly; (b) buys
nothing the reference shape lacks. *Red-team:* the attack is "#1245/#1326 mandate zero-runtime-in-WE —
delete the delivery copies." The rebuttal is #817's *explicit* exception: runtime consumed by a WE
conformance gate stays WE; these renderers are that case, `view`/`tabs` were not. The residual ~10% is
the longer-horizon question of whether behavioral conformance should run from a plateau in-browser tool
over WE vectors ([#899]) — that would revisit *where the gate runs*, not whether the reference is
WE-owned, so it does not move this call.

On ratify: resolve, then re-scope #1355/#1356 to **demo-page iframe swap only** (drop the renderer-delete
step from both).

---

## Context

- Surfaced while working #1355 in batch-2026-06-21; the #1353 split analysis batched #1354/#1355/#1356 on
  a *"no shared importer"* premise that is **false** for data-table/pagination (true only for the
  resolved #1354/`view`/`tabs` line).
- [#1326] (resolved) is the precedent the delete pattern came from — and the contrast that proves the
  point: it deleted `view`/`tabs` precisely because they had no WE-side consumer.

[#1353]: /backlog/1353-fui-host-the-three-remaining-reference-renderer-demos-data-t/
[#1326]: /backlog/1326-delete-we-blocks-view-tabs-runtime-copies-swap-we-view-tabs-/
[#1245]: /backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/
[#899]: /backlog/899-behavioral-conformance-runner-as-a-plateau-in-browser-tool-o/
