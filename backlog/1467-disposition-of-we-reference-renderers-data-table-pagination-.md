---
kind: decision
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-21"
relatedReport: reports/2026-06-21-we-reference-renderer-disposition.md
tags: [decision, renderers, conformance, webblocks, constellation]
---

# Disposition of WE reference renderers (data-table/pagination) — deletable per #1353, or kept as WE conformance references + CollectionOperationsBehavior dependency?

**Prepared 2026-06-21. Recommended ruling CORRECTED in discussion + RATIFIED 2026-06-21 → (b).**
A **ratify-shipped-code** disposition call (no greenfield design, so no web survey) grounded in the
**concrete-refs check** — every import / test / export claim below was traced on disk 2026-06-21
(session report `we:reports/2026-06-21-we-reference-renderer-disposition.md`). The prepared default (keep
the renderers in WE under #817's carve-out) **was wrong**: it conflated the WE **verifier** with the
**renderer** the verifier tests, and it predates applying **resolved [#899]**, which decides this axis
directly. Corrected recommended default is now **(b)** — the renderer + backend semantics + coordinator
are impl → FUI; WE keeps the contract types + vector corpus + the assertion-semantics verifier.
**Blocks #1355 / #1356** (size 5 each, both `blockedBy: [1467]`).

## Amended 2026-06-22 by #1566 — the *verifier implementation* leaves WE too

This ruling kept **"WE keeps … the assertion-semantics verifier"** (the golden-reader impl). #1566
(ratified 2026-06-22) **overturns that part**: WE holds only the **declarative contract** — the verifier
*interface* + the vector/golden **corpus** + the golden **schema**. The verifier **implementation** and the
conformance **run** move to **Plateau** (a neutral, non-implementer product layer; the original
cross-impl-neutrality reason the verifier could not be FUI is satisfied by Plateau, not by WE). FUI is one
*target* via a binding it owns. The rest of #1467 (renderer + backend semantics + coordinator → FUI; WE
keeps contract types + vectors) **stands**. Codified at
[we:docs/agent/platform-decisions.md#devtools-placement](../docs/agent/platform-decisions.md#devtools-placement) +
`#constellation-placement` (both amended). Unchanged carve-out: WE conformance *tooling* a WE-side
`we:check.ts` gate runs over WE's **own declarative artifacts** stays WE; only the verifier of an
*implementation's runtime output* moves.

## The axis — is the *renderer* a WE conformance reference, or a runnable backend that belongs in FUI?

#1355/#1356 (slices of epic [#1353]) were scoped on the **#1326 pattern**: build the FUI demo, swap the
WE page to a #701 `fuiDemo` iframe, then **delete** `we:blocks/renderers/data-table` /
`we:blocks/renderers/pagination`. The prepared analysis argued these two renderers are *not* that case
because two WE consumers import them — a coordinator and the CI conformance suite — so #817's carve-out
("a runtime symbol stays in WE iff a WE-side conformance gate consumes it") keeps them. That reasoning
**over-reads the carve-out**. The carve-out covers the conformance gate's *own machinery* (the verifier),
not the *subject the verifier renders and inspects*. "A WE test imports it" cannot be the test for
staying in WE — by that logic every FUI impl WE exercises would migrate into WE.

**What the file actually contains.** [we:blocks/renderers/data-table/renderDataTable.ts](../blocks/renderers/data-table/renderDataTable.ts)
(444 lines) staples four distinct concerns into one file:

1. **Contract types** (L25–96) — `DataTableConfig`, `PipelineResult`, `GroupResult`, … → WE (already a contract).
2. **Backend semantics** (L134–255) — `applyPipeline`, `aggregate`, `summaryText`, `nextSortState`, `sortStateOf`, `applySortClick`, `announce` (the filter/sort/group/aggregate compute the coordinator imports).
3. **DOM renderer** (L304–373) — `renderDataTable`, `cellContent`, `cellDisplayText` (config → `HTMLTableElement`).
4. **The verifier** (L390) — `auditDataTable(root: HTMLElement, rows, config)` — inspects a rendered DOM tree against the APG / Intl.Collator / SQL contract.

The CI test [we:blocks/__tests__/unit/renderers/data-table.test.ts](../blocks/__tests__/unit/renderers/data-table.test.ts:13-26)
imports `dataTableCases` (the **vectors** — already a separate data file,
`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts`), then `renderDataTable` **and**
`auditDataTable`. **Why the renderer is imported by the gate:** only because `auditDataTable` needs a
live-rendered `<table>` to inspect and the sole producer sits in the same file — co-location, not
gate-membership.

**Resolved [#899] decides this directly.** #899 (status: resolved, codified in
`we:docs/agent/platform-decisions.md#constellation-placement`) ratified the behavioral-conformance model:
WE owns **the vector corpus (JSON) + vector schema + the assertion-semantics verifier**; the verifier
**consumes an observed trace as DATA** (read through DOM/ARIA), **never a live render/clock**; **ALL
runnable backends (mount/dispatch + clock impl) → FUI.** Live-rendering *inside* the WE gate is the exact
pattern #899 eliminated. So the carve-out keeps the **verifier (`auditDataTable`) + vectors**, not the
**renderer**. The renderer being imported by the WE test today is interim live-render scaffolding, not a
sanctioned WE reference.

**Classification (per-fork pass).** Renderer + backend semantics + coordinator → **runnable backend**
(FUI). Verifier + vector corpus + contract types → **WE conformance plane**. The standing
*separate/decouple* bias agrees: keeping an impl renderer in WE *couples* the standard to one concrete
backend; #899's split decouples them (one contract, many backends, conformance over data).

### Recommended path at a glance

| Fork | Recommended default (corrected) | Rejected | Confidence |
|---|---|---|---|
| 1 — disposition of the data-table/pagination renderers | **(b) Impl → FUI: `renderDataTable`/`cellContent` (backend) + `applyPipeline`/`aggregate`/sort-state (semantics) + `CollectionOperationsBehavior` (coordinator) move to FUI; WE keeps contract types + vector corpus + `auditDataTable` verifier; conformance runs over vectors per #899** | (a) Keep the renderers in WE as permanent conformance references | High (~90%) |

## Fork 1 — renderer is impl → FUI (b) vs keep renderer in WE as conformance reference (a)

*Fork-existence (genuine either/or):* the renderer **files** either remain in `we:blocks/renderers/` or
move to FUI — the choice changes the scope of #1355/#1356. Both branches are coherent, so this is a merit
call settled by a higher ruling (#899), not a forced invariant.

**Crux:** does the WE conformance gate audit a **live render** (renderer must stay WE) or a **stored
observed trace / golden vector** (renderer → FUI)? **Resolved #899 already answered: vectors.** The WE
verifier reads observed DOM/ARIA as data; it does not host the backend that produces it.

- **(b) Renderer + semantics + coordinator → FUI (recommended).** WE keeps the contract **types**, the
  **vector corpus** (`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts` — already separate
  data, plus golden/expected outputs), and `auditDataTable` (the assertion-semantics **verifier** =
  #899's WE gate). FUI receives the runnable backend (`renderDataTable`/`cellContent`), the backend
  semantics (`applyPipeline`/`aggregate`/sort-state), and `CollectionOperationsBehavior` (also a runnable
  backend). *Tradeoff:* a multi-file constellation move — but it is exactly #899's ratified shape, and the
  vectors are already extracted.
- **(a) Keep the renderers in WE as conformance references.** *Rejected* — contradicts resolved #899
  (live-render inside the WE gate is the eliminated pattern) and #817's main holding (runtime → FUI); the
  carve-out it leaned on covers the verifier, not the rendered subject.

**Recommended default: (b)** — high confidence (~90%). *Red-team:* the attack on (b) is "the WE CI badge
needs *something* to render today — deleting the renderer reds the suite." Rebuttal: #899's model has the
verifier assert the **stored golden output** (data) against the contract, with the live render exercised
in FUI against the same WE vectors — no WE-side renderer required; the vectors are already a separate
file. Residual ~10%: confirming `auditDataTable` can assert against stored output without recomputing via
`applyPipeline` (a refactor the build does), and that the golden outputs are captured as vector data.

On ratify: resolve (codified-to #899's vector-conformance model), then **re-scope #1355/#1356**: keep the
demo-page iframe swap **and** the renderer delete, but each must (1) leave `auditDataTable` + the vector
corpus + types in WE, and (2) the `CollectionOperationsBehavior` coordinator re-home to FUI is a **third
slice** (not folded into the two demo swaps). File the coordinator re-home as a new item on ratify.

---

## Context

- Surfaced while working #1355 in batch-2026-06-21; the #1353 split analysis batched #1354/#1355/#1356 on
  a *"no shared importer"* premise that is **false** for data-table/pagination — but the fix is not "keep
  the renderer in WE" (the first-pass read), it is "the shared importers are themselves impl that re-home
  to FUI under #899."
- [#1326] (resolved) deleted `view`/`tabs` because they had no WE-side consumer; here the consumers exist
  but are *also* impl, so they move too rather than anchoring the renderer in WE.
- Reusable lesson (→ memory): a WE conformance gate is the **verifier** that reads observed output as
  data; the impl it renders/tests is the **subject under test** and lives in FUI. Being imported by a WE
  test does not make code WE — resolved #899 codifies exactly this (verifier + vectors → WE, runnable
  backend → FUI).

[#1353]: /backlog/1353-fui-host-the-three-remaining-reference-renderer-demos-data-t/
[#1326]: /backlog/1326-delete-we-blocks-view-tabs-runtime-copies-swap-we-view-tabs-/
[#1245]: /backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/
[#899]: /backlog/899-behavioral-conformance-runner-as-a-plateau-in-browser-tool-o/
