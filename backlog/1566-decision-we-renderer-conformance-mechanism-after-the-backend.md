---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-data-table-conformance-after-backend-delete.md
tags: [conformance, renderers, data-table, pagination, "1467", "899", "463"]
---

# DECISION: WE renderer-conformance mechanism after the backend delete (data-table/pagination)

Decide how WE's data-table conformance suite asserts goldens once the runnable backend leaves WE→FUI
(#1355), and how the diverged verifier reconciles — so the bounded delete (#1355, and its pagination
mirror #1531) can land. Prepared 2026-06-22; full grounding in
[the report](../reports/2026-06-22-data-table-conformance-after-backend-delete.md) and the
[/research/ topic](/research/data-table-conformance-after-backend-delete/).

## Grounding digest

#1467 ratified: when a runnable renderer moves WE→FUI, WE keeps the **verifier + vector corpus + types**
and the suite "asserts the stored golden output as data — no live render." Grounding the delete found the
model **unrealized** and the shipped code hiding **two tautologies**:

- **The verifier exists in WE as a golden-reader.** `we:blocks/renderers/data-table/renderDataTable.ts:425`
  — `auditDataTable(root, golden)` asserts the DOM projection equals the frozen `golden`, with **no** call
  into `applyPipeline`/`cellDisplayText`/`summaryText`. This is the #1467 "reads output as data" shape.
- **A renderer-free root source already ships.** `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:114`
  — `goldenToRoot(golden)` reconstructs a `<table>` *from* the golden. The WE suite already runs
  `goldenToRoot` + `auditDataTable(root, golden)` with no live render — but that loop is **tautological**:
  it builds a root from the golden, then asserts it matches the golden (rows in == rows out; the grouping
  is admittedly faked, `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:143-145`).
- **The verifier diverged in the FUI port (#1382).** `fui:blocks/renderers/data-table/renderDataTable.ts:390`
  — `auditDataTable(root, rows, config)` **re-derives** expected output by re-running `applyPipeline`. Per
  the test-oracle literature that is a **weak self-consistency oracle** (a bug shared by render + audit
  passes) — invalid AS conformance, fine as a renderer-internal unit test. FUI has **no goldens at all**
  (`fui:blocks/renderers/data-table/__fixtures__/` holds only a verbatim copy of `we:data-table-cases.ts`).
- **The drift guard re-captures from the same renderer.** `we:blocks/__tests__/unit/renderers/data-table.test.ts:72`
  — `expect(dataTableGoldens).toEqual(buildGoldens())`, where `buildGoldens()` renders via the backend. It
  fires only when someone edits the renderer/cases — exactly when they are already reviewing the diff.
- **The repos have NO package edge.** "FUI consumes WE's verifier" can only be a **synced verbatim copy**
  (canonical = WE), like `we:data-table-cases.ts` already is, until the #872 published-package path lands.
- **The ratified template exists in-repo.** `we:blocks/renderers/module-service/conformance/runner.ts`
  (#463/#506) is a **target-agnostic** runner: a target is `(vector) => response`, the reference impl is
  *one* pluggable target, goldens are portable JSON. This is the shape the data-table verifier converges to.

## The axis

The genuine axis is **what a standard can honestly assert once the implementation it certifies leaves the
repo** — and it splits along the test-oracle line. A conformance oracle must encode the
independently-correct answer (a frozen, human-reviewed golden); a *derived* oracle that re-runs the impl's
own logic only checks self-agreement. After the delete, WE has **no renderer**, so any WE-side audit on a
`goldenToRoot`-reconstructed root is a round-trip that certifies nothing about an implementation — WE's
honest residual is to test **the verifier itself** (does it reject a bad root) and **the corpus** (is it
complete), not to fake a conformance run. The real conformance run — render a case, audit the **real** root
against the frozen golden — belongs in **FUI, where the renderer is**, using WE's golden-reader. FUI's
`applyPipeline` recompute is not a competitor to that; it answers a different question (does this renderer
match its own pipeline) and survives as an optional internal unit test. #1467 is **not** reopened: W3C
web-platform-tests affirms the implementation-agnostic-suite model, and the verifier stays WE-owned.

The four prior options A/B/C/D collapse under this lens: **A** (stored-root fixture) is unnecessary —
`goldenToRoot` already provides a renderer-free root, and a *second* frozen HTML artifact would only add a
parallel tautology; **C** (reconcile on one verifier) is right in direction but is realized by FUI adopting
WE's golden-reader on real roots, not by retiring FUI's recompute wholesale; **D** (move the verifier to
FUI) re-opens ratified #1467 with no new evidence and is dissolved; **B** (structural-only) is the honest
floor for WE's own suite and is folded into Fork 1's default.

## Recommended path at a glance

| Fork | Question | Recommended default | Main alternative (excluded) |
|------|----------|---------------------|------------------------------|
| 1 | What does WE's own suite assert post-delete? | **Verifier-discrimination (a negative fixture) + corpus-completeness; drop the tautological positive loop** | Keep the `goldenToRoot`→audit positive loop (round-trips the golden — certifies no renderer) |
| 2 | The conformance run + the divergence | **Golden-reader is canonical, run in FUI on real roots; FUI's recompute demoted to an optional internal unit test (support both)** | Retire FUI's recompute entirely / keep recompute AS the conformance gate (a weak oracle) |
| 3 | Where does the drift guard live? | **Drop the auto-regen guard; frozen-golden vs real-render audit in FUI is the drift signal; `captureGolden` stays a manual regen tool** | Keep `toEqual(buildGoldens())`, hosted in FUI (re-captures from the same renderer) |
| 4 | Shape of WE's surviving asset | **Minimal verifier + corpus now; converge on the #463/#506 target-agnostic runner when a 2nd target appears** | Refactor to the full runner now (expands #1355 beyond a bounded delete) |

**Supported by default / forced (not forks):** `goldenToRoot` is the renderer-free root source (already
ships) — kept for the negative fixture + manual tooling. WE's backend unit tests (applyPipeline / aggregate
/ announce / sort-state / cell-formatters) move to FUI — **forced** by the delete (they test the backend =
impl); FUI already holds verbatim copies, so coverage loss is **net zero**. The cases/goldens reach FUI as
synced verbatim copies (canonical = WE), mirroring the existing `we:data-table-cases.ts` copy. #1467 stands.

## Fork 1 — What does WE's own data-table suite assert after the backend delete?

*Fork-existence:* the positive `goldenToRoot`→`auditDataTable(root, golden)` loop is tautological by
construction (it builds a root from the golden, then asserts it matches the golden), so "keep it as a
conformance assertion" is a **flawed branch** — after the delete WE has no renderer for it to certify. The
live choice is between the two honest residuals.

- **(a) Verifier-discrimination + corpus-completeness — the default.** WE's suite asserts (i) a **negative
  fixture**: `auditDataTable` rejects a deliberately-corrupted root (`result.ok === false`) — the mutation-
  testing "kill a mutant" check that proves the verifier discriminates; and (ii) **corpus-completeness**:
  every `we:data-table-cases.ts` case has a committed golden. The tautological positive loop is removed (or
  demoted to a clearly-labeled schema-coherence check between `goldenToRoot` and `auditDataTable`, not
  "conformance"). WE tests the *verifier + corpus*, which is what it still owns.
- **(b) Structural-only.** Validate the goldens JSON is well-formed + matches the cases; no audit call at
  all. Honest but weaker — WE then ships a verifier nothing in WE ever exercises, so a verifier regression
  rides until FUI's run catches it (and per #1467 WE *owns* the verifier).

**Default: (a).** It is (b) plus the one assertion that actually exercises the WE-owned verifier — the
negative fixture — at negligible cost.

Skeptic: REFUTED the original "keep the positive golden-reader loop" — verified tautological against
`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:143-165` (rows emitted == rows asserted;
grouping faked). Folded: default flipped to drop the positive loop, keep the negative fixture +
completeness. The negative fixture is the surviving non-tautological assertion.

## Fork 2 — The conformance run and the verifier divergence

*Fork-existence:* two verifiers exist with different signatures and the #1467 "WE keeps THE verifier FUI
consumes" model is unrealized — a real either/or on **which is the conformance gate** (the `applyPipeline`
recompute is a weak self-consistency oracle, so using it AS conformance is a flawed branch).

- **(a) Golden-reader canonical, run in FUI on real roots; FUI's recompute demoted — the default.** FUI
  renders each case and audits the **real** rendered root against a **synced copy** of WE's frozen goldens
  via WE's `auditDataTable(root, golden)` — the conformance run, living where the renderer is. FUI's
  `auditDataTable(root, rows, config)` is **kept as an optional internal renderer-consistency unit test**,
  explicitly *not* the conformance gate (it answers "does this renderer match its own pipeline" — a
  different, legitimate question; support both). Sub-fork — **distribution:** FUI gets the verifier +
  goldens as a **synced verbatim copy** (canonical = WE), like `we:data-table-cases.ts` already is; the
  #872 published-package path supersedes the manual sync later. *(Not blocked on #872 — that would block
  the bounded #1355 delete.)*
- **(b) Retire FUI's recompute entirely (one verifier).** Cleaner "single verifier" story, but discards a
  continuous, frozen-artifact-free check that catches post-pipeline DOM-builder drift — coverage loss for
  no conformance gain.
- **(c) Keep FUI's recompute AS the conformance gate.** Rejected — it is a weak self-consistency oracle
  (test-oracle literature; a bug shared by render + audit passes) and leaves WE's golden-reader unused.

**Default: (a).** Realizes #1467's "one verifier WE owns" for the *conformance* gate while keeping the
recompute as a non-conformance unit test — the support-both resolution once the two questions are
separated.

Skeptic: SURVIVES-WITH-AMENDMENT. The skeptic refuted "retire FUI's recompute," arguing it is the only
oracle that catches renderer-vs-pipeline drift. Tested: that holds only against a *same-renderer-captured*
golden; against a **frozen, human-reviewed** golden audited on a **real** root, the golden-reader is the
stronger oracle (it also catches pipeline regressions the recompute shares-and-misses). Amendment folded:
the default no longer *retires* the recompute — it **demotes** it to an optional internal unit test, and is
explicit that the golden must be frozen + reviewed (Fork 3 ensures this).

## Fork 3 — Where does the golden-drift guard live post-delete?

*Fork-existence:* the guard `expect(dataTableGoldens).toEqual(buildGoldens())` calls `buildGoldens()`, which
**renders via the backend** — WE cannot host it post-delete (forced). So the choice is FUI-host vs drop.

- **(a) Drop the auto-regen guard — the default.** With goldens **frozen + human-reviewed**, FUI's
  real-render conformance audit (Fork 2a) goes red the moment the renderer's output diverges from the
  reviewed golden — a **loud** drift signal that forces a deliberate re-capture + diff review.
  `captureGolden`/`buildGoldens` stays a **manual** regeneration tool, not a CI assertion. This is the WPT
  model (expected files updated deliberately).
- **(b) Keep the guard, hosted in FUI.** Re-captures from FUI's renderer == committed goldens. But it
  re-captures from the **same** renderer the goldens came from, so it only ever fires during a renderer/cases
  edit — exactly when the human is already reviewing the diff — and pins nothing downstream (data-table has
  one target today). Pure ceremony.

**Default: (a).** The frozen-golden + real-render audit *is* the drift detector; an auto-regen guard on top
is tautological.

Skeptic: REFUTED "keep the guard." Verified: `buildGoldens()` renders
(`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:69-70,103-105`); the guard fires only on
a renderer/cases edit; no second target consumes the golden. Folded: default flipped to drop the auto-regen
guard, keeping `captureGolden` as a manual tool.

## Fork 4 — Shape of WE's surviving conformance asset

*Fork-existence:* the module-service runner (#463/#506) is a strictly more general shape than the
current single-function verifier; "adopt it now vs later" is a real scope either/or (refactoring now would
expand the bounded #1355 delete).

- **(a) Minimal now, converge later — the default.** Keep `auditDataTable(root, golden)` + corpus as-is
  (pruned per Forks 1–3). Note the `we:blocks/renderers/module-service/conformance/runner.ts`-style
  target-agnostic `runConformance(target, vectors)` shape (renderer = a pluggable `(case) => root` target)
  as the end-state to adopt **when a second target appears** (third-party renderer / cross-impl).
- **(b) Refactor to the full target-agnostic runner now.** Architecturally cleanest, but expands #1355 well
  beyond a bounded delete and adds a generalization with only one target to justify it today.

**Default: (a).** Keeps #1355 a bounded delete; the runner generalization is real but premature with a
single target.

Skeptic: SURVIVES. The skeptic argued the runner shape is the *right* end-state (correct) but conceded the
cross-repo `(case) => root` target is buildable later via the same verbatim-sync path the cases already
use; nothing forces the full refactor into #1355's scope. The runner convergence is recorded as the
deferred end-state, not a blocker.

## Blocks

- #1355 (data-table backend delete + iframe swap) — `blockedBy` this.
- #1531 (pagination backend delete + iframe swap) — mirrors this golden shape
  (`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts` header: "#1356 mirrors this golden
  shape"); `blockedBy` this. The ruling here applies verbatim to pagination.

Surfaced 2026-06-22 (batch-2026-06-22-1545-1549) grounding #1355: the demo-build + FUI renderer move + the
collection-operations precondition are all already done, so the *only* residual is this bounded delete —
which can't land without choosing the mechanism above.
