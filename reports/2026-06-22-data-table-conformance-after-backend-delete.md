# Data-table conformance after the backend delete — what WE asserts without a renderer

**Date:** 2026-06-22 · **Grounds:** decision [#1566](../backlog/1566-decision-we-renderer-conformance-mechanism-after-the-backend.md) · **Unblocks:** #1355 (data-table backend delete + iframe swap), #1531 (pagination, mirror shape) · **Prior rulings:** #1467 (WE keeps verifier+vectors+types, renderer→FUI), #463/#506 (MaaS target-agnostic conformance runner), #899 (vector corpus).

## The question

#1467 ratified that when a runnable renderer moves WE→FUI, WE keeps the **verifier + vector corpus + types** and the suite "asserts the stored golden output as data — no live WE render." But grounding the data-table delete (#1355) surfaced that the *mechanism* is unspecified and the current code does not actually realize the model. Two concrete problems block the bounded delete:

1. WE's `auditDataTable(root, golden)` needs a **rendered root** — produced today by the very `renderDataTable` backend the delete removes.
2. The verifier **diverged** during the FUI port (#1382): FUI rewrote it to `auditDataTable(root, rows, config)`, which **re-derives** expected output by re-running `applyPipeline` — a different verifier from WE's golden-reader, defeating "#1467 WE keeps THE verifier FUI consumes."

## What the code actually does (grounding)

- **`we:blocks/renderers/data-table/renderDataTable.ts:425`** — `auditDataTable(root, golden)`: a pure golden-reader. Asserts the DOM projection equals the frozen `golden`, with **no** call into `applyPipeline`/`cellDisplayText`/`summaryText`.
- **`fui:blocks/renderers/data-table/renderDataTable.ts:390`** — `auditDataTable(root, rows, config)`: calls `applyPipeline(rows, config)` and asserts the DOM reflects *that re-derived* result.
- **`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:114`** — `goldenToRoot(golden)` reconstructs a `<table>` FROM the golden (the renderer-free root source); `captureGolden`/`buildGoldens` (line 69-105) **render via the backend** to (re)generate goldens; `serializeGolden` reads a root → golden.
- **`we:blocks/__tests__/unit/renderers/data-table.test.ts`** — three sections: (1) the golden-reader loop (`goldenToRoot` + `auditDataTable(root, golden)`); (2) the drift guard `expect(dataTableGoldens).toEqual(buildGoldens())` (line 72) **+ backend unit tests** (applyPipeline / aggregate / announce / sort-state / cell-formatters); (3) the interactive sort-toggle axis.
- **`fui:blocks/renderers/data-table/__tests__/data-table.test.ts`** — near-verbatim copy using the rows+config recompute; **has no goldens at all** (`fui:blocks/renderers/data-table/__fixtures__/` holds only `we:data-table-cases.ts`, a byte-identical copy of WE's).
- **The two repos have NO package dependency** — shared files are manual verbatim copies. So "FUI consumes WE's verifier" cannot be a runtime import today; it is a synced copy with WE as canonical source.

## Prior art

**Internal — the ratified template (#463/#506).** `we:blocks/renderers/module-service/conformance/runner.ts` is the in-repo precedent: a **target-agnostic** conformance runner where a target is `(vector) => Promise<response>`, the reference impl is **one pluggable target** (`we:blocks/renderers/module-service/conformance/referenceTarget.ts`), and golden vectors are self-describing portable JSON read unchanged by any target (incl. generated .NET/Java/Go). "The fidelity check lives HERE, once, for every language — not as per-language ad-hoc tests (the protobuf/gRPC lesson: 0 vs 1,847 failures depending on whether a shared suite gates it)." This is exactly the shape the data-table verifier should converge to.

**External.**
1. **W3C web-platform-tests** (web-platform-tests.org) — a single implementation-agnostic suite written against the *spec*; each engine is a pluggable subject run against the same assertions. The suite ships no engine of its own → WE keeps spec-derived assertions + corpus, treats the moved-out renderer as one external subject.
2. **The test-oracle problem** (Barr et al., *The Oracle Problem in Software Testing*, IEEE TSE 2015; Wikipedia "Test oracle") — a *consistency/derived* oracle that compares output to the system's own re-run result only checks self-agreement; a bug shared by both sides passes. → FUI's `applyPipeline` recompute is a **weak self-consistency oracle**, invalid AS conformance (it green-lights a renderer wrong in the same way the pipeline is).
3. **Characterization/golden testing** (Michael Feathers) — "it happens with surprising regularity that you inadvertently write a tautological assertion"; a snapshot regenerated from the thing under test asserts nothing. → A golden **captured from the renderer** (`captureGolden`) and then auto-re-checked against that same renderer (the drift guard) is tautological; the golden is authoritative only when **frozen + human-reviewed in the diff**, not auto-regenerated.
4. **Mutation testing / "who tests the tests"** — an assertion is only proven meaningful when it *kills* an input it should reject. → The verifier must be guarded by a **negative fixture** (a corrupted root it must reject), or it can silently pass everything.

## The skeptic pass (run in prep) reshaped the forks

A hostile skeptic, prompted only to refute, read the real code and landed three refutations that I verified against the tree and folded:

- The `goldenToRoot → auditDataTable(root, golden)` **positive loop is tautological by construction** — `goldenToRoot` emits exactly the fields `auditDataTable` reads back (rows in == rows out; the grouping is admittedly faked, `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts:143-145`). After the delete it tests nothing about a renderer. → Drop the positive loop; keep only a **negative fixture** (verifier-rejects-bad-DOM) + corpus-completeness.
- Retiring FUI's recompute would lose a real signal **iff** goldens are captured-from-same-renderer. But against a **frozen, human-reviewed** golden audited on a **real rendered root**, the golden-reader is the *stronger* oracle (it also catches pipeline regressions the recompute shares-and-misses). Resolution: the golden-reader is the canonical **conformance** verifier (run in FUI on real roots); FUI's recompute is **demoted to an optional internal renderer-consistency unit test**, not retired and not the conformance gate (they answer different questions — support both).
- The `toEqual(buildGoldens())` drift guard **re-captures from the same renderer** the goldens came from, so it fires only during a renderer/cases edit — exactly when the human is already reviewing the diff — and pins nothing downstream (data-table has only one target today). → Drop the auto-regen guard; the **frozen-golden vs real-render audit in FUI is the loud drift signal**; `captureGolden` stays a manual, reviewed regeneration tool.

#1467 should **not** be reopened — WPT affirms the impl-agnostic-suite model; the verifier stays WE-owned. What the skeptic reopened was the *prep's framing*, not the ruling.

## Recommended end-state

- **WE** keeps: `we:data-table-cases.ts` (vectors) + frozen `we:data-table-goldens.json` (human-reviewed expected projections) + `auditDataTable(root, golden)` (the conformance verifier) + types. Its **own** suite asserts only corpus-completeness + a **negative fixture** proving the verifier rejects a corrupted root. The tautological positive loop and the auto-regen drift guard are **removed**. Backend unit tests (applyPipeline/aggregate/announce/sort-state/formatters) **move to FUI** (already present verbatim → net-zero coverage loss).
- **FUI** renders each case and audits the **real root** against a **synced copy** of WE's frozen goldens via WE's `auditDataTable(root, golden)` — the conformance run, living where the renderer is. FUI's `auditDataTable(root, rows, config)` is **demoted** to an optional internal unit test, explicitly not the conformance gate. The synced golden copy mirrors the existing `we:data-table-cases.ts` copy (canonical = WE); the published-package path (#872) supersedes the manual sync later.
- **Generalization (deferred):** converge WE's verifier on the module-service `runConformance(target, vectors)` shape (renderer = a pluggable `(case) => root` target) **when a second target appears** (third-party / cross-impl). Not required to land the bounded #1355 delete; #1467 not reopened.

This keeps #1355 a bounded delete, realizes #1467's "one verifier WE owns," and removes the two tautologies the current suite hides.
