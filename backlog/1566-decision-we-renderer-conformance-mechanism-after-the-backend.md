---
kind: decision
status: resolved
locus: webeverything
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
preparedDate: "2026-06-22"
codifiedIn: "docs/agent/platform-decisions.md#devtools-placement"
relatedReport: reports/2026-06-22-data-table-conformance-after-backend-delete.md
tags: [conformance, renderers, data-table, pagination, plateau, "1467", "1565", "1576", "899", "463"]
---

# DECISION: WE renderer-conformance mechanism after the backend delete (data-table/pagination)

Decide how WE's data-table conformance survives once the runnable backend leaves WE→FUI (#1355, and its
pagination mirror #1531). **Ruled 2026-06-22 (ratified):** WE holds only the *declarative*
conformance contract — the **interface** + the **vector/golden corpus** (data) — while the verifier
**implementation** and the conformance **run** are a **Plateau** product, and the renderer under test is
**FUI** (one target among many, reached via a binding it owns). This **overturns #1467 + #1565 Fork 3's**
"verifier stays WE" carve-out and reshapes **#1576** (explorer engine relocation). Prepared 2026-06-22;
full grounding in [the report](../reports/2026-06-22-data-table-conformance-after-backend-delete.md) and
the [/research/ topic](/research/data-table-conformance-after-backend-delete/).

## Ruling (2026-06-22) — ratified

The placement line is drawn one notch sharper than #1467/#1565 Fork 3: **WE holds zero executable** —
not even the verifier. WE owns the conformance *contract* (the `ConformanceBinding`-style interface, the
vector/golden **schema**, and the frozen **corpus** as data); everything that *runs* — the verifier that
computes pass/fail and the run that drives an implementation — is **tooling → Plateau** (a neutral
product layer w.r.t. the implementations it judges; cf. #427 per-customer conformance dashboard, #1577
explorer product). The implementation under test (the renderer) is **FUI or any implementer**, reached
through a per-target **binding** that implementer owns. FUI is not special — it is one target.

This **overturns the #1467 / #1565-Fork-3 carve-out** ("a verifier implements no standard, it stays
WE") — judging is still executable code, and WE holds none. **Neutrality** — the original reason the
verifier could not live in FUI (the contestant) — is preserved by **Plateau** (a non-implementer), not
by WE. Codified (2026-06-22) in we:docs/agent/platform-decisions.md#devtools-placement +
#constellation-placement; #1467 and #1565 Fork 3 amended in place with lineage.

**Load-bearing constraint.** The conformance *rules* (which projection aspects must match, and how) must
be expressible **declaratively** in WE (the interface + the golden/vector schema), so Plateau's verifier
is a faithful **interpreter**, not the **author** of "what conformance means." If the rules can only
live in checker code, the definition leaks to Plateau and the ruling fails its own test.

**Cascade (this is what each fork below now says):** Fork 1 — WE's own suite drops to *data validation*
(corpus completeness + golden schema-validity), since WE has no verifier to exercise. Fork 2 — the
conformance run lives in **Plateau** (verifier impl + run, against each target's binding); FUI's recompute
stays FUI as an internal unit test. Fork 3 — drop the auto-regen guard (unaffected). Fork 4 — WE's
surviving asset is the **interface + corpus + schema**; the target-agnostic runner *interface* is WE, its
*implementation* is Plateau. **#1576** flips with it: the explorer engine *impl* → Plateau; only the
interface + vectors → WE.

## Grounding digest

#1467 (now amended above) had WE keep the **verifier + vector corpus + types**, asserting the stored
golden "as data — no live render." Grounding the delete found the model **unrealized** and the shipped
code hiding **two tautologies** — the verified facts (unchanged by the ruling):

- **The verifier exists in WE as a golden-reader.** `we:blocks/renderers/data-table/renderDataTable.ts:425`
  — `auditDataTable(root, golden)` asserts the DOM projection equals the frozen `golden`, with **no** call
  into `applyPipeline`/`cellDisplayText`/`summaryText`. (Under the ruling this executable moves WE→Plateau.)
- **A renderer-free root source already ships.** `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:114`
  — `goldenToRoot(golden)` reconstructs a `<table>` *from* the golden. The WE suite already runs
  `goldenToRoot` + `auditDataTable(root, golden)` with no live render — but that loop is **tautological**:
  it builds a root from the golden, then asserts it matches the golden (rows in == rows out; grouping
  faked, `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:143-145`). (Executable helper
  → moves with the verifier to Plateau.)
- **The verifier diverged in the FUI port (#1382).** `fui:blocks/renderers/data-table/renderDataTable.ts:390`
  — `auditDataTable(root, rows, config)` **re-derives** expected output by re-running `applyPipeline` — a
  **weak self-consistency oracle** (a bug shared by render + audit passes): fine as a renderer-internal unit
  test, invalid as conformance. FUI has **no goldens** (`fui:blocks/renderers/data-table/__fixtures__/` holds
  only a verbatim copy of `we:blocks/renderers/data-table/data-table-cases.ts`).
- **The drift guard re-captures from the same renderer.** `we:blocks/__tests__/unit/renderers/data-table.test.ts:72`
  — `expect(dataTableGoldens).toEqual(buildGoldens())`, where `buildGoldens()` renders via the backend. It
  fires only when someone edits the renderer/cases — exactly when they are already reviewing the diff.
- **The repos have NO package edge.** Cross-repo consumption can only be a **synced verbatim copy**
  (canonical = WE), like `we:blocks/renderers/data-table/data-table-cases.ts` already is, until the #872
  published-package path lands.
- **The ratified runner template exists in-repo.** `we:blocks/renderers/module-service/conformance/runner.ts`
  (#463/#506) is a **target-agnostic** runner: a target is `(vector) => response`, the reference impl is
  *one* pluggable target, goldens are portable JSON. Under the ruling its **interface** is the WE end-state;
  its **implementation** is Plateau's.

## The axis

The genuine axis is **what a standard can honestly own once neither the implementation it certifies nor
the tooling that exercises it lives in the standard layer.** Taken to its logical end, zero-impl (#1282)
means WE holds **zero executable**: only declarative contracts/protocols/interfaces + conformance **data**.
A conformance oracle must encode the independently-correct answer (a frozen, human-reviewed golden) — that
answer is **data and belongs in WE**; but the code that *reads* an implementation's output and computes a
verdict is **tooling**, and the *run* that drives a real implementation needs the implementation. Neither
is WE's. They are **Plateau's** (the neutral product layer — it implements no WE standard, so it can judge
all of them; the same home as the #427 conformance dashboard and the #1577 explorer product). The
implementation under test reaches the verifier through a **binding** its owner supplies; FUI owns one
because FUI is the reference implementer, not because the explorer or the standard depends on FUI.

WE's honest residual after the backend delete is therefore: the conformance **interface**, the
**vector/golden corpus** (data), and the **schema** that keeps "what conformance means" declarative — and
its own suite can only **validate that data**, because it has no verifier left to run. FUI's `applyPipeline`
recompute is not a competitor: it answers a different question (does this renderer match its own pipeline)
and survives as an optional internal unit test where the renderer is.

## Recommended path at a glance

| Fork | Question | Recommended default | Main alternative (excluded) |
|------|----------|---------------------|------------------------------|
| 1 | What does WE's own suite assert post-delete? | **Data validation only — corpus completeness + golden/vector schema-validity** (WE has no verifier to exercise) | Keep a WE-side verifier to run a negative fixture (needs the verifier impl the ruling moved to Plateau) |
| 2 | The conformance run + the divergence | **Plateau owns the verifier impl + the run**, auditing each target's real output against WE's goldens via the target's binding; FUI's recompute demoted to an optional internal unit test | Run it in FUI / keep FUI's recompute AS the conformance gate (a weak oracle) |
| 3 | Where does the drift guard live? | **Drop the auto-regen guard; Plateau's frozen-golden vs real-render audit is the drift signal; `captureGolden` stays a manual regen tool writing back to WE's canonical corpus** | Keep `toEqual(buildGoldens())` |
| 4 | Shape of WE's surviving asset | **Interface + vector/golden corpus + schema (declarative only); runner *interface* → WE, runner *impl* → Plateau; converge on #463/#506 when a 2nd target appears** | Refactor to the full runner in WE now / keep an executable verifier in WE |

**Supported by default / forced (not forks):** WE's backend unit tests (applyPipeline / aggregate /
announce / sort-state / cell-formatters) move to FUI — **forced** by the delete (they test the backend =
impl); FUI already holds verbatim copies, so coverage loss is **net zero**. The cases/goldens reach
**Plateau** (the runner) and **FUI** (the target's recompute test) as synced verbatim copies (canonical =
WE), mirroring the existing `we:blocks/renderers/data-table/data-table-cases.ts` copy; the #872
published-package path supersedes the manual sync later. `goldenToRoot` (a renderer-free root *helper*,
executable) moves with the verifier to **Plateau** (negative fixture + manual tooling). **#1467 and
#1565 Fork 3 are amended, not upheld** (see Ruling).

## Fork 1 — What does WE's own data-table suite assert after the backend delete?

*Fork-existence:* the positive `goldenToRoot`→`auditDataTable(root, golden)` loop is tautological by
construction **and** now requires the WE verifier the ruling moved to Plateau — doubly excluded. The live
choice is what WE's *data-only* suite validates.

- **(a) Data validation — corpus completeness + schema-validity — the default.** WE's suite asserts (i)
  **completeness**: every `we:blocks/renderers/data-table/data-table-cases.ts` case has a committed golden;
  and (ii) **schema-validity**: each golden conforms to the declared golden/vector **schema** (the
  declarative contract). No executable verifier runs in WE — there is none. The verifier-discrimination
  (negative-fixture) test moves to **Plateau**, where it exercises Plateau's verifier impl.
- **(b) Structural-only, no schema.** Validate the goldens JSON parses + matches the cases, with no schema
  check. Weaker — a malformed-but-parseable golden rides until Plateau's run catches it.

**Default: (a).** It is the strongest assertion WE can make over *data alone* — the corpus is complete and
every golden is well-formed against the contract — at negligible cost, with no executable in WE.

Skeptic (prepare-phase, OLD default): REFUTED "keep the positive golden-reader loop" — verified
tautological against `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:143-165`.
↳ **Superseded 2026-06-22 by the verifier-impl→Plateau ruling:** the prior default's negative-fixture
assertion needs a WE-side verifier, which no longer exists in WE; WE's residual is data validation, and
the negative fixture moves to Plateau.

## Fork 2 — The conformance run and the verifier divergence

*Fork-existence:* two verifiers exist with different signatures; the conformance **run** must live
somewhere now that WE has no renderer **and** (per the ruling) no verifier. The real either/or is **where
the run lives** and **which oracle is the gate** (FUI's `applyPipeline` recompute is a weak
self-consistency oracle, so using it AS conformance is a flawed branch).

- **(a) Plateau owns the verifier impl + the run; FUI's recompute demoted — the default.** Plateau's
  verifier renders/drives each **target through the target's binding** (`(case) => root`), and audits the
  **real** output against a **synced copy** of WE's frozen goldens via the WE-defined golden-reader
  interface. FUI supplies a binding for its renderer (one target among many); FUI's
  `auditDataTable(root, rows, config)` recompute is **kept as an optional internal renderer-consistency
  unit test**, explicitly *not* the conformance gate. Sub-fork — **distribution:** Plateau gets WE's
  interface + goldens as a **synced verbatim copy** (canonical = WE), like
  `we:blocks/renderers/data-table/data-table-cases.ts` already is; #872 supersedes the manual sync later.
  *(Not blocked on #872 — that would block the bounded #1355 delete.)*
- **(b) Run it in FUI on real roots (verifier in FUI).** Rejected by the ruling — puts the verifier impl
  in the contestant; loses cross-impl neutrality (FUI's verifier can only grade FUI).
- **(c) Keep FUI's recompute AS the conformance gate.** Rejected — a weak self-consistency oracle, and it
  leaves the frozen golden unused.

**Default: (a).** Realizes a single neutral conformance run (Plateau, against any target's binding) over
WE's frozen goldens, while keeping FUI's recompute as a non-conformance unit test.

*Residual:* how FUI gates **its own** renderer in CI (its internal recompute test vs consuming Plateau's
published verifier) is a downstream detail, not part of this bounded delete.

Skeptic (prepare-phase): SURVIVES-WITH-AMENDMENT — the golden-reader on a **frozen, human-reviewed**
golden over a **real** root is a stronger oracle than the recompute; the recompute is **demoted**, not
retired. ↳ **Amended 2026-06-22 by the ruling:** the run + verifier impl move from FUI to **Plateau**;
the demote-not-retire conclusion stands.

## Fork 3 — Where does the golden-drift guard live post-delete?

*Fork-existence:* the guard `expect(dataTableGoldens).toEqual(buildGoldens())` calls `buildGoldens()`,
which **renders via the backend** — WE cannot host it post-delete (forced). The choice is host-it vs drop.

- **(a) Drop the auto-regen guard — the default.** With goldens **frozen + human-reviewed**, **Plateau's**
  real-render conformance audit (Fork 2a) goes red the moment a target's output diverges from the reviewed
  golden — a **loud** drift signal that forces a deliberate re-capture + diff review. `captureGolden` /
  `buildGoldens` stays a **manual** regeneration tool (it needs a renderer, so it lives with the run in
  Plateau/FUI) that writes back to WE's **canonical** corpus. This is the WPT model (expected files
  updated deliberately).
- **(b) Keep the guard, hosted with the run.** Re-captures from the same renderer the goldens came from,
  so it only ever fires during a renderer/cases edit — when the human is already reviewing the diff — and
  pins nothing downstream. Pure ceremony.

**Default: (a).** The frozen-golden + real-render audit *is* the drift detector; an auto-regen guard on
top is tautological. *(Independently sound regardless of the verifier-placement ruling.)*

Skeptic (prepare-phase): REFUTED "keep the guard" — verified `buildGoldens()` renders
(`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:69-70,103-105`); fires only on a
renderer/cases edit; no second target consumes the golden. Folded: drop the auto-regen guard, keep
`captureGolden` as a manual tool. (Unchanged by the ruling.)

## Fork 4 — Shape of WE's surviving conformance asset

*Fork-existence:* the module-service runner (#463/#506) is a strictly more general shape than the current
single-function verifier; "adopt it now vs later" is a real scope either/or — and the ruling splits its
**interface** (WE) from its **implementation** (Plateau).

- **(a) Minimal declarative asset now, converge later — the default.** WE keeps the conformance
  **interface** + the **corpus + schema** (data). Note the
  `we:blocks/renderers/module-service/conformance/runner.ts`-style target-agnostic
  `runConformance(target, vectors)` **interface** (target = a pluggable `(case) => root` binding) as the
  WE end-state to formalize **when a second target appears** (third-party renderer / cross-impl / a
  Plateau cross-impl product); the runner **implementation** already lands in Plateau (Fork 2a).
- **(b) Refactor to the full target-agnostic runner in WE now.** Rejected — it both expands #1355 beyond a
  bounded delete and keeps an executable runner in WE, against the ruling.

**Default: (a).** Keeps #1355 a bounded delete and WE declarative; the runner-interface generalization is
the named end-state, its impl is Plateau's.

Skeptic (prepare-phase): SURVIVES — the runner shape is the right end-state; the cross-repo `(case) => root`
target is buildable later via the same verbatim-sync path the cases already use. ↳ **Refined 2026-06-22 by
the ruling:** the runner *interface* is the WE end-state; the runner *impl* is Plateau's.

## Blocks

- #1355 (data-table backend delete + iframe swap) — `blockedBy` this.
- #1531 (pagination backend delete + iframe swap) — mirrors this golden shape
  (`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts` header: "#1356 mirrors this golden
  shape"); `blockedBy` this. The ruling here applies verbatim to pagination.
- #1576 (relocate explorer conformance engine FUI→WE) — **reshaped** by this ruling: the engine *impl* →
  Plateau, only the interface + vectors → WE. Re-point #1576 on ratification.
- #1467 / #1565 Fork 3 (we:docs/agent/platform-decisions.md#devtools-placement) — **amended** by this
  ruling (verifier impl WE→Plateau); record the reversal with lineage on ratification.

Surfaced 2026-06-22 (batch-2026-06-22-1545-1549) grounding #1355: the demo-build + FUI renderer move + the
collection-operations precondition are all already done, so the *only* residual is this bounded delete —
which can't land without choosing the mechanism above.
