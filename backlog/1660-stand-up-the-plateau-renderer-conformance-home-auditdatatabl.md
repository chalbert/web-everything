---
kind: story
size: 8
parent: "1576"
status: resolved
blockedBy: []
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/conformance-engine/renderer-audit/"
tags: [conformance, renderers, data-table, pagination, plateau, "1566", "1576", "899"]
---

# Stand up the Plateau renderer-conformance home (auditDataTable/goldenToRoot + golden-schema, per #1566 Fork 2a)

Build the neutral Plateau home that audits a renderer's **real** output against WE's frozen goldens — the prerequisite both renderer-backend deletes (#1355 data-table, #1531 pagination) wait on. #1566 ruled (Fork 2a, ratified): Plateau owns the verifier impl + the conformance **run**; WE keeps only the declarative contract (interface + golden corpus + schema as data). This home does **not** exist yet — #1597 landed the *behavioral-vector* engine (`runConformanceVector`/`judgeConformanceTrace`), a **different** mechanism that judges timed observable traces, not a static rendered table/pagination DOM against a golden projection. Porting `auditDataTable`/`goldenToRoot` there is not a drop-in; this card builds the renderer golden-audit home (separate module now; converge on #463/#506 when a 2nd target appears, per #1566 Fork 4 — not now).

## Scope (decided design — #1566 Fork 2a; this is a build, not a fork)

- **Port the verifier + root helpers → Plateau** — move `auditDataTable(root, golden)` + the `GoldenHeaderProjection`/`GoldenGroupProjection`/`DataTableGoldenProjection` types + `goldenToRoot`/`buildGoldens`/`serializeGolden` out of `we:blocks/renderers/data-table/renderDataTable.ts` + `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts` into a `plateau:src/conformance-engine/` renderer-audit module (sibling to, not folded into, `plateau:src/conformance-engine/conformanceVectors.ts`). Mirror for pagination's `auditPagination`.
- **Run over WE goldens via a target binding** — the run drives each target through a `(case) => root` binding and audits the **real** output against a **synced verbatim copy** of WE's frozen goldens (canonical = WE, like `we:blocks/renderers/data-table/data-table-cases.ts` already is; #872 published-package supersedes the manual sync later — *not* blocked on #872). FUI supplies a binding for its renderer (one target among many).
- **Declare the WE golden/vector SCHEMA** — the declarative contract WE's own data-only suite validates each golden against (#1566 Fork 1a: corpus completeness + golden schema-validity). No such schema exists yet (goldens ship as bare `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts`/`.json`); declare it as data WE keeps. (Split out as a WE-side sub-slice if it grows.)
- **Negative-fixture / verifier-discrimination test → Plateau** — exercises the ported verifier impl (the test that proves the oracle rejects a wrong root), per Fork 1a's note that this moves to Plateau.

## Why this is the real blocker (filed 2026-06-23, batch pre-flight)

#1355/#1531 were `blockedBy: 1597` on the premise that #1597's slice = "the Plateau conformance home this card waits on." Grounding refuted it: #1597 is the **behavioral-vector** runner (Layer-2, trace/judge over a `ConformanceBinding`), and a grep confirms **no** `auditDataTable`/`goldenToRoot`/renderer golden-audit in `plateau:src/`. The renderer golden-audit home #1566 Fork 2a requires is **verified absent and unfiled** — this card fills it. The two deletes are `blockedBy` this; they cascade-free the instant it lands.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Stood up the home in `plateau:src/conformance-engine/renderer-audit/` (a sibling of
`plateau:src/conformance-engine/conformanceVectors.ts`, per #1566 Fork 4 — not folded in), and declared the
WE golden schema. All four scope bullets delivered (files under `plateau:src/conformance-engine/renderer-audit/`):

- **Verifier + root helpers ported → Plateau** — `auditDataTable` + `auditPagination` (the pure
  golden-readers, verbatim), `goldenRoot` (`dataTableGoldenRoot`/`paginationGoldenRoot` — the golden→root
  re-materializers, the reference targets), and `types` (the golden + projection + `AuditResult` types).
  **Port, not move:** WE's originals stay in place — the two deletes #1355 (data-table) / #1531 (pagination)
  are the cascade slices that *remove* the WE backend, and they `blockedBy` this; this card only had to make
  the Plateau home exist.
- **Run over WE goldens via a target binding** — `run`'s `runRendererAudit` drives a `RendererTarget`'s
  `(golden) => root` binding over the corpus and audits each **real** root vs the golden; the `goldens`
  module loads a **synced verbatim copy** of WE's frozen data-table/pagination goldens JSON (canonical = WE;
  #872 supersedes the manual sync later).
- **WE golden SCHEMA declared** — `we:blocks/renderers/golden-schema.ts` (`assertDataTableGoldens`/
  `assertPaginationGoldens`: schema-validity + corpus-completeness + unique-ids), validated against both
  committed corpora by `we:blocks/renderers/__tests__/golden-schema.test.ts` (6 tests). The data-only suite
  #1566 Fork 1a names.
- **Negative-fixture / verifier-discrimination test → Plateau** — the `renderer-audit` test (7 tests): the
  reference target audits GREEN over the full synced corpus (data-table + pagination), and the verifier
  REJECTS a tampered row-order / wrong-root / tampered active-marker (proves the oracle discriminates).

**Cascade:** #1355 and #1531 are `blockedBy: 1660` — they now unblock (their Plateau home exists). Each
deletes its WE renderer backend and re-points its conformance to this Plateau run.

**Gate note (not this changeset):** the WE gate's two reds are the same concurrent-session externals as
this batch's other WE items (`we:reports/2026-06-23-1704-split-analysis.md`, stale `we:AGENTS.md`); the
plateau suite's one red is the pre-existing `plateau:src/render-conformance.test.ts` baseline staleness for
`plateau:src/conformance-engine/conformanceVectors.ts` (committed by #1597, not this changeset — my
renderer-audit files are not flagged as surfaces). All stepped over per the batch external-red diagnosis;
all my own tests (plateau 7 + WE 6) pass.
