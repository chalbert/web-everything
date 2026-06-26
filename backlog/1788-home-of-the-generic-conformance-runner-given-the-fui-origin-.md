---
kind: decision
status: open
relatedProject: webvalidation
blocks: ["1790"]
relatedReport: reports/2026-06-26-split-analysis-1783.md
dateOpened: "2026-06-26"
preparedDate: "2026-06-26"
dateStarted: "2026-06-26"
tags: [conformance, constellation-placement, runner-home, plateau, frontierui]
---

# Home of the generic conformance runner given the FUI-origin mode-C-bundle requirement (#899 backends→FUI vs #1597 runner→plateau)

#1784 needs the WE docs site to mode-C-load a FUI-origin conformance-runner bundle, but the generic runner (zero plateau-specific deps) is homed in plateau (#1597 'neutral runner'). FUI cannot import plateau (backward edge), and a plateau-origin bundle fails mode-C's #765 trust gate — so the runner's home must be resolved: re-home plateau to FUI as a reference-impl-tier engine (per #899 'backends to FUI'), widen the #765 trust allowlist, or a controlled thin-FUI-runner variant. Gates #1783 Slice B.

## The reframe (grounding)

#1597 moved the executable runner **engine** (`plateau:src/conformance-engine/conformanceVectors.ts` — `runConformanceVector` + `judgeConformanceTrace` + `ConformanceVectorOracle` + `plateau:src/conformance-engine/virtualClock.ts`) from FUI → plateau on two grounds (`we:backlog/1576-…md:27-31`): (1) it is **executable**, and WE holds zero executable (#1282); (2) **neutrality** — "FUI is one *target*", so a neutral runner shouldn't live in an implementer's repo; plateau (a non-implementer) satisfies neutrality. The engine is **generic** — it imports only the WE-owned `@webeverything/conformance-vectors/{schema,binding}` contracts + a 4-field `Finding` type; **zero** plateau-specific code (verified, #1783 split investigation).

The new force #1784 introduces: the WE docs site must **mode-C-load** the runner as a **FUI-origin** bundle. FUI cannot import plateau (backward edge; WE→FUI→plateau, #1595), and a plateau-origin bundle is refused by mode-C's #765 trust gate (`fui:embed/in-document.ts:44-45` — `trustedOrigins ?? [location.origin]`). So #1597's "engine → plateau" placement now conflicts with the surface requirement.

**Key distinction the reframe rests on:** #1597 conflated the runner **engine** (the generic step-sequencer + judge) with the **neutral exerciser** (the hosted, 3rd-party-facing conformance product, #427/#1577). #899's own decomposition keeps these apart — "runnable backends → FUI; hosted exerciser → plateau." Neutrality is a property the *exerciser* needs (a 3rd party trusts a non-implementer to grade them); the WE-docs use is **FUI proving its own relocated impl** (a self-dogfood), where neutrality is not at stake.

## Fork 1 — home of the generic conformance-runner engine

*Fork-existence:* a genuine either/or — the engine is one artifact with one home, and the FUI-origin-bundle requirement cannot coexist with #1597's plateau home (FUI↛plateau import + #765 refuses a plateau origin). The three branches are mutually exclusive resolutions; none is free.

| Option | Mechanism | Main tradeoff |
|---|---|---|
| **(a)** Re-home the engine → FUI as reference-impl-tier *(default)* | The generic `runConformanceVector`/`judgeConformanceTrace`/`VirtualClock` move plateau → FUI (a reference-impl open module consuming only WE contracts); plateau's **hosted exerciser** keeps its neutral-product role and consumes the FUI engine over the forward edge (plateau→FUI, allowed). FUI publishes the mode-C runner bundle directly. | Reconciles #899 ("backends→FUI") with #1576 (exerciser stays plateau); the FUI-origin bundle is trivial. But **reverses #1597's "engine→plateau"** and must answer #1576's neutrality concern (resolved: neutrality lives with the exerciser, not the engine; an open reference runner in FUI is the wpt-harness pattern). |
| **(b)** Keep engine in plateau; widen mode-C's #765 trust to admit the plateau origin | The docs page calls `setTrustedOrigins([...location, fui, plateau])` so a plateau-origin runner bundle loads. No code moves. | No re-home, honors #1597. But **reopens the #765 security boundary** ("WE↔FUI only — the only fully-trusted host") to admit plateau code into the docs-page process — a real trust-surface expansion for a dogfood demo. |
| **(c)** FUI ships its own thin runner; plateau keeps the neutral one | Two engines: a FUI reference runner (self-dogfood) + plateau's neutral exerciser runner. | No edge break, no rule reversal — but **duplicates a ~255-LOC generic engine** across repos (drift risk, the #1245 failure mode this whole effort exists to end). |

**Default: (a) — re-home the engine → FUI as a reference-impl-tier module.** It is the only branch that both satisfies the surface requirement *and* removes a duplication/drift risk, and it is the one #899 already pointed at ("runnable backends → FUI"). #1597's neutrality objection dissolves under the reframe: a *neutral exerciser* (who runs the vectors for a 3rd party) must be a non-implementer (plateau, unchanged); the *engine* it runs is impl-agnostic reference code that is open and consumable by anyone — exactly the web-platform conformance-harness pattern (wpt ships its test-harness openly; the neutrality is in *who hosts the run*, not *where the harness source lives*). plateau's hosted exerciser consumes the FUI engine over the normal forward edge — which **already exists** (`plateau:src/main.ts:10` and many siblings import `@frontierui`), so (a) adds no new cross-repo dependency direction.

**The neutrality defense (load-bearing — what stops FUI grading FUI leniently):** the grader cannot self-favor because **conformance neutrality is enforced by the WE-owned vector corpus + assertion semantics** (`we:conformance-vectors/schema.ts`, the #899 verifier-tier), not by the engine's repo. `judgeConformanceTrace` is a pure function of `(vector, trace)` whose *meaning* of pass (`finalState`/`neverObserved`/`aria`) is fixed by the WE schema; a FUI-resident engine that loosened it would simply fail WE's own vectors. So an open reference grader in FUI is safe — the same reason wpt's open harness is trusted.

**Why the engine stays whole (not split judge→WE/plateau):** the skeptic floated homing `judgeConformanceTrace` separately as the #899 "verifier". Rejected: the judge is **executable**, so it cannot live in WE (#1282/#1576-(2) ruled exactly this); and splitting judge→plateau while runner→FUI would **re-create the FUI→plateau backward edge** the FUI-origin bundle must avoid. The WE "verifier" #899 means is the *assertion-semantics schema* (already WE), not the executable applicator. So runner + judge + clock travel together → FUI.

**Sub-task folded into (a):** the engine imports a 4-field `Finding` type from `plateau:tools/explorer/oracles/observation` (a plateau-local sibling, via #1577). Re-homing requires that import to resolve without a FUI→plateau edge — so **move `Finding` to a WE contract** (`@webeverything/conformance-vectors`), which also removes the engine↔explorer coupling for good. This is part of #1790's build.

**Skeptic:** SURVIVES-WITH-AMENDMENT. (a)'s destination held; three corrections folded in: (1) the neutrality defense is now explicit (WE owns the assertion semantics → a FUI engine can't self-favor without failing WE's vectors) rather than asserted via the wpt analogy; (2) the engine stays whole — the skeptic's judge→WE split is blocked by #1282 (judge is executable) and judge→plateau would re-create the backward edge; (3) the `Finding` type must move to a WE contract (folded into #1790). Attack-4 (new plateau→FUI edge) was refuted — that edge already exists.

## Supported by default

- **plateau keeps the neutral hosted exerciser** (#427/#1577) — the 3rd-party-facing conformance product; it consumes the re-homed FUI engine over the forward edge (plateau→FUI). Re-homing the engine does **not** move the exerciser.

## Lineage

Surfaced slicing #1783 (`we:reports/2026-06-26-split-analysis-1783.md`); gates #1790 (Slice B). Grounds: #1784 (FUI-origin mode-C bundle), #899 (backends→FUI / exerciser→plateau decomposition), #1576-(2)/#1597 (runner→plateau, neutral), #765 (mode-C WE↔FUI trust gate, `fui:embed/in-document.ts:44-45`), #1595 (clock injected — no backward edge), #1282 (WE zero-executable).
