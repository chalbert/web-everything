# Conformance model for non-facts→verdict relocated runtimes

**Point:** The #1294 relocation cascade proves conformance with the #899/#1789 facts→verdict vector model (drive a binding, observe a *verdict*). Four relocated non-engine runtimes — webtheme token-projection, intl formatting, analytics aggregation, reliability provider-strategy — produce output that is not a verdict, so #1816 asks what conformance model they relocate under. The decisive finding: **WE already ships two suite shapes** (the interaction-script `ConformanceVectorSuite` and the Doc-Spec golden-output suite #1163), and `expect`/the judge already handle non-verdict scalars. The non-engine runtimes need **no third model and no per-shape binding judges** — they classify onto the two existing shapes — with **one comparison-matcher addition**: deep-equality for structured golden output, and a **normalized/property matcher for locale-sensitive (intl) output**, which equality of any flavor would falsely reject.

---

## Question

How does a relocated non-facts→verdict runtime (formatting · aggregation · token-projection · provider-strategy) prove conformance through the plateau-hosted runner, given the #899 vector model's judge observes a *verdict*? Candidate shapes from the #1816 sketch: (A) extend the interaction-script vector model with a wider observation vocabulary; (B) a golden-output snapshot corpus per non-engine subsystem (the Doc Spec #1163 precedent); (C) per-shape binding variants (formatter / aggregator / token-projector each with its own judge).

## Recommendation

**Classify each non-engine runtime onto one of the two suite shapes WE already ships — i.e. (A) for stateful provider-seam behavior and (B) for pure transforms — and reject (C).** Concretely:

- **Pure deterministic transforms** — webtheme token-projection (`(DTCG tokens) → resolved token map`, #404) and any `input → structured output` runtime → the **Doc-Spec golden-output suite shape (B)**, judged by **deep-equality** on the resolved structure (the token *map*, not serialized CSS text). The only new mechanism is generalizing the Doc-Spec golden suite from `webdocs`-specific to a generic `(input) → output` golden suite and adding deep-equality to the golden judge.
- **Provider-seam behavior** — reliability strategy (`(signals) → RecoveryResult`) and analytics aggregation (`(events) → recorded calls`) → the **interaction-script vector (A)**: a binding that `dispatch`es calls and `observe`s the typed return, judged by deep-equality for structured returns.
- **Locale-sensitive output** — intl formatting → the interaction-script vector (A) **but with a normalized/property matcher, never string equality**: assert the returned instance's `resolvedOptions()` and the `formatToParts` part **structure** (types/order), treating separator/whitespace classes as equivalence classes. Exact-string golden output is ICU/CLDR-version-dependent and would falsely fail conformant impls (the skeptic's refutation, below).
- **Reject (C)** per-shape binding *bases*. The two existing suite shapes plus two `expect`-matcher variants (deep-equal · normalized/property) cover all four subsystems; a formatter-judge / aggregator-judge / token-projector-judge base would proliferate near-identical drivers for no merit gain.

Layer placement is fixed by the ratified split (#1467 / #1566, [conformance-verifier-vs-subject](../docs/agent/platform-decisions.md#we-fui-embed-boundary)): the **contract + vector/golden corpus + schema → WE**; the **runner/judge implementation + the run → Plateau**; the **per-target binding → FUI** (the subject). The matcher additions land in the Plateau judge (impl); the corpus + the matcher *vocabulary* (e.g. a `matcher: 'deep-equal' | 'resolved-options' | 'parts-structure'` tag on a vector/golden) land in the WE schema.

## Key Findings

1. **`expect` is already open-ended and already proves non-verdict scalars.** `ConformanceExpectation` is `{ finalState?, neverObserved?, aria?, [assertion: string]: unknown }` (`we:conformance-vectors/schema.ts:38-47`). The judge compares every non-special key against the final snapshot via strict `===` (`plateau:src/conformance-engine/conformanceVectors.ts:142-147`, `last[key] !== expected`). webcompliance already observes a **number** (`violationCount`) and **booleans** (`blocked`, `passed`) through this exact path (`we:conformance-vectors/webcompliance.vectors.ts`). "Observe a verdict" was always shorthand for "observe a typed surface" — the model is not verdict-locked.

2. **A second suite shape already exists for pure transforms** — the Doc-Spec golden-output suite (#1163, `we:conformance-vectors/webdocs.vectors.ts`): `{ manifest, cases, expect: DocsSite }`, a conforming generator passes iff `generateDocsSite(...)` **deep-equals** `expect`. It is deliberately a different shape from the interaction-script suite, exported separately and excluded from `conformanceSuites` (`we:conformance-vectors/index.ts:20-22`). So (B) is not a new invention — it is reusing a proven, shipped precedent. webtheme token-projection is the same kind of artifact (deterministic `input → structured output`).

3. **The single genuine fork is the comparison semantics, not the model.** The interaction-script judge uses strict `===` (referential for objects), which is fine for scalars but wrong for structured returns (a token map / `RecoveryResult` would never `===`). And for intl it is *worse than wrong*: formatted output depends on the host engine's **ICU/CLDR version** (e.g. the U+202F narrow-no-break-space that replaced the ASCII space before AM/PM around ICU 72), so any equality — strict or deep — produces false negatives that track the engine, not the implementation under test. Test262's Intl suite avoids exact-output assertions for exactly this reason. The honest model therefore admits a small, closed set of `expect` **matchers** (exact · deep-equal · resolved-options/parts-structure), not a per-subsystem judge.

4. **No new WE→FUI code edge.** The corpus + schema stay WE; the matchers extend the Plateau judge; FUI ships the per-target bindings (a webtheme-compile binding, an intl-provider binding, etc.). This is identical to the webpolicy/webcompliance cascade topology and respects #1282 (WE holds zero executable).

5. **Per-subsystem relocation lineage.** Each non-engine subsystem still relocates via its own `/slice 1294` cascade (contract-extract → relocate-to-FUI → binding+corpus → plateau iframe page → delete WE runtime), exactly as webcompliance (C1–C5). This decision only settles the *conformance shape* each cascade's binding+corpus slice targets — it unblocks those cascades, it is not itself a relocation.

## Skeptic pass

A refute-only sub-agent attacked the recommended default. Verdict: **SURVIVES-WITH-AMENDMENT.** It conceded webtheme/analytics/reliability fit (B)/(A) with deep-equality (and the angle-2 nuance: compare the resolved token *map*, not CSS text — already folded in), but **refuted exact-equality for intl**: formatted strings are ICU/CLDR-version-dependent, so a golden/deep-equal `expect` falsely fails conformant impls; intl must assert `resolvedOptions()` + `formatToParts` structure (a normalized/property matcher). This is folded into the recommendation as the third matcher variant — it sharpens the fork (the real call is *comparison semantics*, not *model shape*) rather than overturning it. It does **not** resurrect (C): a matcher is an `expect`-comparison tag in the schema, not a per-shape binding base.

## Files

| Path | Lines | What it grounds |
|---|---|---|
| `we:conformance-vectors/schema.ts` | 38-47, 53-82 | `expect` open-ended; `ConformanceVector` / `ConformanceVectorSuite` shape |
| `plateau:src/conformance-engine/conformanceVectors.ts` | 119-150 | the judge — strict `===` per `expect` key; the matcher seam |
| `we:conformance-vectors/webdocs.vectors.ts` | 1-118 | the Doc-Spec golden-output suite (#1163) — deep-equal precedent |
| `we:conformance-vectors/index.ts` | 20-22 | Doc-Spec exported as a separate shape, not in `conformanceSuites` |
| `we:conformance-vectors/webcompliance.vectors.ts` | 31-129 | non-verdict scalars (`violationCount` number) already proven |
| `we:webtheme/compile.ts` · `we:webtheme/tokens.ts` | 65-91 · 133-198 | token-projection: `(DTCG) → resolved map` / CSS; the (B) subject |
| `we:intl/provider.ts` | 35-60 | intl returns native `Intl.*` instances → locale-sensitive output |
| `we:analytics/provider.ts` | 30-41 | analytics aggregation (no-op tracker default) |
| `we:reliability/provider.ts` | 52-80 | `assertRecoveryResult` → typed `RecoveryResult` (provider-strategy) |
| `we:docs/agent/platform-decisions.md` | 232-311 | #1566 conformance contract/impl/binding split (WE/Plateau/FUI) |
| `we:reports/2026-06-27-split-analysis-1294-webcompliance.md` | — | the split that filed this decision (the non-engine gate) |
