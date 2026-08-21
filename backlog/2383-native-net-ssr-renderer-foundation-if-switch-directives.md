---
kind: story
size: 5
parent: "2360"
status: open
dateOpened: "2026-07-10"
tags: []
scope:
  - frontierui:plugs/webdirectives/ssr/net/
  - frontierui:.github/workflows/ci.yml
---

# Native .NET SSR renderer foundation + if/switch directives

Stand up the greenfield .NET build subtree (frontierui:plugs/webdirectives/ssr/net/) for the native SSR renderer, and prove it end-to-end on the if + switch directives: source parse, top-level template-is dispatch, normative space-padded marker wrapping, RenderMarkerOptions, and the shared ResolvePath / mustache Interpolate helpers, plus the .NET-side conformance harness that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into dotnet test and repo CI. Fork-free (#2030 black box) — it mirrors the Node reference oracle. The foundational slice B/C ride on.

## Build detail

- Parser: the digest originally named "a real HTML parser/DOM, e.g. AngleSharp, mirroring the Node happy-dom
  strategy". The parser choice is a conforming black box per #2030, **not** a fork — see the prep assessment
  below for what actually shipped.
- `if` and `switch` share interpolate `innerHtml`; resume tokens ride the generic `RenderMarkerOptions`.
- Demo bar: passes the `if`, `switch` and `state-tokens` vectors byte-for-byte.
- Reference oracle: `frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts`.

## Prep assessment (2026-08-21) — the renderer is ALREADY BUILT; what is owed is close-out plus one harness fix

Checked against the `frontierui` checkout before writing criteria. The whole subtree this item describes is on
`frontierui` `main`:

- Commit **`f918b99`** (2026-07-28), *"FUI #2383: native .NET SSR renderer foundation + if/switch (#2069)"*,
  merged via `frontierui` PR **#42** from `lane/2383-net-ssr-foundation`. `git branch --contains f918b99`
  reports `main`.
- The subtree exists at `frontierui:plugs/webdirectives/ssr/net/` with exactly the pieces the digest names:
  `NetServerRenderer` (top-level `template[is]` parse + dispatch + normative space-padded markers),
  `Renderers` (the ported `ResolvePath` / mustache `Interpolate` / marker options), `HtmlParse`, `Json`,
  `ConformanceHarness`, an xUnit `ConformanceTests`, a `WebDirectivesSsr.Conformance.csproj`, and a
  `build.sh`.
- CI is wired: `frontierui:.github/workflows/ci.yml` carries a `setup-dotnet@v4` step and a
  *".NET SSR conformance harness"* step running the net `build.sh`, inside the required `test` job — beside
  the JVM twin's equivalent step.
- The harness restricts itself to `Implemented = { "if", "switch" }` and **skips** (never fails) vectors
  outside that set, which is the foundation-slice contract this item asks for.
- The JVM twin **#2368** is already `status: resolved`; this item is not.

**So the renderer itself is built; what is owed is close-out PLUS one small real fix.** The parser and
test-runner choices sit inside the #2030 black box and are **not** forks to reopen — the subtree's README
documents them. But the 2026-08-21 independent review mutation-probed the shipped harness and found a live
gap, reproduced and confirmed here:

**The .NET harness's only test cannot detect a whole directive silently dropping out of grading.**
`ConformanceTests.EmitsByteExactWireFormatForImplementedDirectives`
(`frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs`) asserts exactly two things —
`report.Failed.Count == 0` and `report.Passed.Count > 0`. Remove `"switch"` from `ConformanceHarness`'s
`Implemented` set and the switch + `state-tokens/switch-value` vectors move from **Passed** to **Skipped**:
`Failed` stays 0, `Passed` stays 3 (still `> 0`), and the test stays **green**. A regression that stops
grading half the slice's directives reddens nothing.

**And the harness prints nothing**, so there is no per-vector output to read. `report.Passed` / `report.Skipped`
are populated and then discarded. Its **JVM twin does not have this gap**:
`frontierui:plugs/webdirectives/ssr/jvm/src/test/java/com/frontierui/webdirectives/ssr/ConformanceHarness.java:73-82`
prints `PASS <id>` / `SKIP <id>` / `FAIL <id>` per vector plus a summary on every run. The .NET side should
match its twin.

The one thing worth checking rather than assuming: *Build detail*'s *"a real HTML parser/DOM, e.g. AngleSharp"*
versus the README's note that the renderer, its HTML source parser and its JSON reader carry **zero runtime
NuGet dependency** (only the xUnit runner is a package). Those are different choices, both legal under #2030.
Confirm which shipped and, if it is the hand-rolled one, correct this digest's parenthetical — do not read the
divergence as unbuilt work.

## Done when

1. **Executable — the conformance harness is green against the WE-owned vectors.** From the `frontierui`
   checkout root, with the sibling WE checkout present:

   ```
   bash plugs/webdirectives/ssr/net/build.sh
   ```

   Exit 0. It resolves the vectors file (explicit arg → `$WEBDIRECTIVES_SSR_VECTORS` → the sibling
   `../webeverything` checkout) and byte-compares per the #2354 contract.
2. **Executable — the test asserts the expected passed-ID SET, so a dropped directive reddens it.**
   `ConformanceTests` is strengthened to assert that `report.Passed` equals exactly the five ids the slice
   owns — `webdirectives-ssr/if/true-branch-emitted`, `webdirectives-ssr/if/false-branch-empty-markers`,
   `webdirectives-ssr/switch/active-case-only`, `webdirectives-ssr/state-tokens/if-condition-resume-token`,
   `webdirectives-ssr/state-tokens/switch-value-resume-token` — and that the other five (`for-each` ×3,
   `resource-loader`, `defer`) are in `report.Skipped`. **Mutation proof required:** temporarily remove
   `"switch"` from `ConformanceHarness`'s `Implemented` set and `dotnet test` must go **red**. On `main`
   today it stays green — that is the defect this criterion closes. Revert the mutation before landing.
   (`Passed.Count > 0` is kept as the vectors-didn't-load guard; it is necessary but, alone, insufficient.)
3. **Observable — the harness reports per vector, like its twin.** A `build.sh` run prints `PASS <id>` /
   `SKIP <id>` / `FAIL <id>` and a summary line, matching
   `frontierui:plugs/webdirectives/ssr/jvm/src/test/java/com/frontierui/webdirectives/ssr/ConformanceHarness.java:73-82`.
   Without this there is no output for a reader to check the counts against, and a silent narrowing of scope
   is invisible even to a human watching CI.
4. **Observable — CI runs it on the required check.** `frontierui:.github/workflows/ci.yml` contains a
   `setup-dotnet` step and a step invoking the net `build.sh`, both inside the `test` job that gates merge —
   so a wire-format drift reds the required check rather than passing unnoticed.
5. **Observable — the fork-free claim holds.** The `.csproj` declares no runtime package reference beyond the
   test runner (xUnit + the test SDK), matching the #2030 black-box framing and the JVM twin's posture.
6. **Assertable — the item matches what shipped.** The parser bullet under *Build detail* names the parser
   that actually landed. Read the *"Design notes (parser + test-runner choices, #2030)"* section of
   `frontierui:plugs/webdirectives/ssr/net/README.md` and reconcile.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Mutating frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs's `Implemented` HashSet to drop "switch" moves the switch/state-tokens-switch vectors from Passed into Skipped; Failed stays 0 and Passed stays 3 (>0), so the sole test frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs::EmitsByteExactWireFormatForImplementedDirectives stays green — no named test reddens on a regression that silently stops grading a whole directive.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — report.Passed / report.Skipped in frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs are populated but never printed or asserted by id; a green `bash build.sh` run surfaces nothing to "read the counts" from, unlike the JVM twin's frontierui:plugs/webdirectives/ssr/jvm/src/.../ConformanceHarness.java `main()`, which prints PASS/SKIP per vector id plus a summary line on every run.
- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — The prep assessment verifies the already-built premise concretely (`git branch --contains f918b99` reports main, file listing matches the digest) before writing verify-only criteria, rather than assuming; I confirmed the same commit/branch state independently in /workspace/frontierui.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The only real consumer of frontierui:plugs/webdirectives/ssr/net/build.sh is the CI subprocess call, and criterion 3 checks that directly against frontierui:.github/workflows/ci.yml (setup-dotnet + the .NET SSR conformance harness step inside the required `test` job) — confirmed present.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs is itself the round-trip seam test between the WE-owned vectors (we:conformance-vectors/webdirectives-ssr.vectors.json) and the FUI-owned renderer, matching the #2354 contract and mirroring the accepted JVM twin's shape.
- **population** (addressed; strategy: name the population each threshold guards) — `Implemented = { "if", "switch" }` in frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs explicitly names the graded population (5 of the 10 vectors in we:conformance-vectors/webdirectives-ssr.vectors.json); I confirmed against the actual vectors file that exactly if×2/switch×1/state-tokens×2 = 5 pass and for-each×3/resource-loader/defer = 5 skip, matching the card's named list verbatim.

**Corrections applied by this review:**

- Done-when criterion 2's instruction to "read the counts" of passed/skipped vectors from the harness report cannot actually be exercised against the shipped .NET path: frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs computes report.Passed/report.Skipped but frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs never prints or asserts them by id (only a coarse Passed.Count > 0 check), unlike the JVM twin's ConformanceHarness.java main() which prints every vector's PASS/SKIP id plus a summary line.

The prep assessment's factual claims all check out against the live frontierui checkout — the subtree, CI wiring, fork-free posture, and parser reconciliation are exactly as described — but the .NET conformance test's success-path guard is decorative for the specific "skipped rather than silently absent" concern Done-when #2 itself names, so that criterion cannot actually be exercised as worded.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** Both NOT-addressed findings are correct, were reproduced against the
`frontierui` tree, and materially change this card: it is **not** pure verification.

- **decorative-guard** — confirmed by reading
  `frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs`: its only assertions are
  `report.Failed.Count == 0` and `report.Passed.Count > 0`. Dropping `"switch"` from `Implemented` moves two
  vectors Passed → Skipped with `Failed` still 0 and `Passed` still 3, so the test stays green. Done-when #2
  is rewritten to assert the expected passed-ID **set** and to require the mutation probe to redden.
- **legibility** — confirmed: `report.Passed` / `report.Skipped` are populated and never printed, so my
  original criterion ("read the counts") named output that does not exist. The JVM twin at
  `frontierui:plugs/webdirectives/ssr/jvm/src/test/java/com/frontierui/webdirectives/ssr/ConformanceHarness.java:73-82`
  prints `PASS` / `SKIP` / `FAIL` per vector plus a summary. New Done-when #3 requires the .NET harness to
  match its twin.

The `premise`, `consumer` and `interface` assessments were marked addressed and needed no change; the
already-built finding (commit `f918b99`, `frontierui` PR #42, on `main`) was independently re-confirmed by the
juror.
