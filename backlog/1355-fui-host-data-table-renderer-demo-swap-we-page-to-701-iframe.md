---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1660"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-23"
tags: []
---

# FUI-host data-table renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/data-table

Build fui:demos/data-table-demo.html self-bootstrapping the (complete) FUI data-table renderer; swap we:demos/data-table-demo.html to a #701 fuiDemo iframe; delete we:blocks/renderers/data-table + we:demos/data-table-demo.{ts,css}. #1326 pattern.

## Pre-flight note — unmet build precondition; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Skipped in-batch: this is **not** the clean size-3 delete+swap the #1326 precedent was. #1326 (size 3) only
deleted+swapped because its self-bootstrapping `fui:demos/view-tabs-demo.html` **already existed** — it was
built first as the *separate* landed item #1312. Here `fui:demos/data-table-demo.html` does **not** exist
yet (no data-table demo under `fui:demos/`), so this card bundles building a self-bootstrapping FUI
demo that faithfully reproduces the 216-line `we:demos/data-table-demo.ts` + browser-verifying it renders,
**then** the swap + delete. Recommend splitting the demo build (the #1312-analog) into its own prereq and
making this card the delete+swap `blockedBy` it; both need a focused session with the FUI dev server for
live render verification before the WE source is deleted.

## Re-scope from #1467 ruling (ratified 2026-06-21 → b)

The delete is confirmed **but bounded by #899's vector-conformance split** (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule) — impl → FUI, not a clean wipe:

- **Leave in WE:** `auditDataTable` (the assertion-semantics **verifier** = #899's WE gate) + the vector
  corpus `we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts` + the contract **types**. The WE
  conformance suite asserts the **stored golden output** (data), no live WE render.
- **Move to FUI:** the runnable backend `renderDataTable`/`cellContent`/`cellDisplayText` + the backend
  semantics `applyPipeline`/`aggregate`/`summaryText`/sort-state/`announce`.
- **Precondition:** `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` value-imports
  `applyPipeline, aggregate` from this renderer — its re-home to FUI is a **separate prereq slice** (filed
  per #1467); this card is `blockedBy` it, since the import must move before the renderer can leave WE.

## Pre-flight (batch-2026-06-22-1545-1549) — demo+move DONE; bounded delete surfaced a fork → `blockedBy: 1566`

Claimed + ground the current state: the demo-build (`fui:demos/data-table-demo.html`) **already exists**, the
FUI renderer move (`renderDataTable`) **is done**, and the collection-operations precondition (its
`applyPipeline`/`aggregate` import) is **gone** — so the only residual is the **bounded delete + iframe
swap**. But grounding the delete surfaced a genuine unresolved fork (filed as **#1566**): WE's verifier
`auditDataTable(root, golden)` lives **in** `we:renderDataTable.ts` and needs a rendered root the renderer
produces; the WE conformance test renders via the backend in all three sections (golden audit, drift guard,
interactive); and the verifier has **diverged** (FUI ported `auditDataTable(table, rows, config)`). The
#1467 ruling fixed the boundary, not the mechanism. Completing the delete needs a design choice (stored-root
fixture / golden-JSON-only / reconcile verifiers / move auditDataTable) — not forced here. `blockedBy: 1566`;
released. Carry-forward reason: **not-batchable** (fork).

## Pre-flight (batch-2026-06-22-1581-1582-1576-1355-1531) — #1566 ruled; re-pointed `blockedBy: 1566 → 1576` (Plateau home absent)

#1566 is **resolved** (ruled: WE holds zero executable — keeps only the conformance *interface* + golden
**corpus** + **schema** as data; the verifier impl `auditDataTable`, `goldenToRoot`/`buildGoldens`, and the
conformance **run** move **WE→Plateau**; the backend `renderDataTable` is already in FUI). Grounding the
delete under that ruling: it is **atomic** — `auditDataTable` + `goldenToRoot` + `buildGoldens` /
`serializeGolden` live inside `we:blocks/renderers/data-table/renderDataTable.ts` +
`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts`, and
`we:blocks/__tests__/unit/renderers/data-table.test.ts` value-imports **all** of them, so the WE backend
can't be deleted until that verifier code has a **Plateau conformance home** to land in (Fork 2a) and the WE
suite is rewritten to data-validation-only (Fork 1a).

**Verified absent:** there is **no** Plateau conformance home yet (`plateau:src/` has no conformance dir, no
`auditDataTable`/`goldenToRoot`/`runConformance`). That neutral Plateau runner home is exactly what **#1576**
relocates (the explorer conformance engine → Plateau; Fork 4 says the renderer verifier converges on that
runner interface). **#1576 is `status: active` in a concurrent session but has not landed the home.** Moving
the verifier here now would build a **competing** ad-hoc Plateau home that #1576 must then reconcile — a
wrong-partition collision. So this was **a real block on #1576** (later #1597), not a design fork: re-pointed
`blockedBy: 1566 → 1576`. Cascade-frees the instant #1576 lands the Plateau conformance home. Sibling #1531
(pagination) shares this exact dependency.

## Re-point 2026-06-22 — `blockedBy: 1576 → 1597` (#1576 sliced)

#1576 was sliced into an umbrella epic; the **Plateau conformance home** is now established by its slice
**#1597** (runner/judge impl FUI→Plateau). Re-pointed `blockedBy: 1576 → 1597` — the precise slice that
lands the home this card waits on. Per we:reports/2026-06-22-backlog-split-analysis.md (Run 10).

## Unblocked 2026-06-23 — `blockedBy: 1597 → []` (#1597 resolved, Plateau home landed)

**#1597 is now `resolved`** — the Plateau conformance home this card waited on has landed (and #1576's
remaining children are all resolved). So this is **no longer blocked-in-fact**: cleared `blockedBy`. The
historical "blocked-in-fact on #1576/#1597" notes above are superseded. Now genuinely ready (Tier-A).

## Pre-flight (batch-2026-06-23-1355-1531) — re-pointed `blockedBy: 1597 → 1660` (#1597 is the wrong mechanism)

Claimed + ground the delete: the re-point `1576 → 1597` rested on a **false premise**. #1597 landed the
**behavioral-vector** conformance runner (`runConformanceVector`/`judgeConformanceTrace` over a
`ConformanceBinding`, Layer-2 trace/judge) — a **different mechanism** than the renderer **golden-audit**
this delete needs (`auditDataTable(root, golden)` audits a statically-rendered DOM against a frozen golden
projection). A grep confirms **no** `auditDataTable`/`goldenToRoot`/renderer golden-audit anywhere in
`plateau:src/`, so the Plateau home #1566 Fork 2a requires is **verified absent** — and was **never filed**.
The delete is **atomic** with standing that home up (the WE backend + verifier can't leave until the run has
a Plateau home + the WE data-only suite + golden schema exist). Filed that prerequisite as **#1660** (decided
build, not a fork — #1566 Fork 2a ruled it). Re-pointed `blockedBy: 1660`; **`blocked-in-fact`**, released.
Cascade-frees when #1660 lands. Sibling shares this exactly.
