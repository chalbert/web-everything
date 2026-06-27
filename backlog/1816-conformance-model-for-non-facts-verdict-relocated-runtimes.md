---
kind: decision
parent: "1294"
status: resolved
priority: low
relatedProject: webvalidation
relatedReport: reports/2026-06-27-split-analysis-1294-webcompliance.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1847
codifiedIn: "docs/agent/platform-decisions.md#non-verdict-conformance-matcher"
preparedDate: "2026-06-27"
tags: [conformance, constellation-placement, relocation]
---

# Conformance model for non-facts-verdict relocated runtimes

> **RATIFIED 2026-06-27 — (a) a small closed matcher set, widened to four members.** The four #1294 non-engine runtimes classify onto the two suite shapes WE already ships; conformance for their non-verdict output is settled by a **closed matcher vocabulary** `{exact · deep-equal · resolved-options/parts-structure · predicate}` carried as a per-`expect`-key tag in the WE schema and interpreted by the Plateau judge. (b) and (c) rejected. See **Ruling** below.

No conformance model is designed yet for the #1294 non-engine relocations; the one fork below is grounded in a prior-art survey published as `/research/non-verdict-conformance-model/` (session report `we:reports/2026-06-27-non-verdict-conformance-model.md`) and carries a recommended default in **bold**. The decisive finding: WE **already ships two suite shapes**, and the vector judge already proves non-verdict scalars — so the four non-engine runtimes (webtheme token-projection #404, intl formatting, analytics aggregation, reliability provider-strategy) need **no new model and no per-shape binding judges**. They classify onto the two existing shapes; the only genuine open question is the **comparison matcher** for structured and locale-sensitive output.

## Ruling

**(a) wins, with the matcher set closed at *four*, not three.** The two-go red-team (a refute-only skeptic against the real tree) confirmed the core thesis — two existing shapes + a matcher tag on the one neutral judge; (c) per-shape binding judges stays rejected (a predicate matcher is still a comparison *tag*, not a new driver, so the composability probe holds) — but it landed four amendments now folded in:

1. **The matcher set is not closeable at three.** Analytics methods all return `void` (`we:analytics/contract.ts:62-72`) — its conformance invariants are *predicates over a recorded-call log* (routing, swap-reroute, arg-order, **absence**/no-op, count), and `Intl.Collator` has **no `formatToParts`** (`we:intl/contract.ts:45-46`) — its output is a `compare()` **sign + sort ordering**. Neither is exact, deep-equal, nor parts-structure. The set gains a fourth member, **`predicate`** (contains / subset / count / absence / sign-order), interpreted by the judge as a boolean over the observed surface.
2. **webtheme conformance subject is the resolved token map, not CSS text.** `compileToCss` emits a `{ css: string, diagnostics }` *string* (`we:webtheme/compile.ts:65-91`); the comparable structured artifact is the intermediate `resolveTokens` output (`we:webtheme/tokens.ts:147-173`). The webtheme binding observes **`resolveTokens`** (deep-equal the map), explicitly **not** `compileToCss` (string-fragile).
3. **Collator rides `predicate` (sign/order), not parts-structure** — `resolved-options/parts-structure` covers `Number`/`DateTime`/`RelativeTime` only.
4. **The judge has no matcher seam today.** `plateau:src/conformance-engine/conformanceVectors.ts:142-147` hardcodes `last[key] !== expected`; there is no `matcher` field on `expect`. The impl scope is therefore *add a per-key `matcher` field to the WE `ConformanceExpectation` schema + per-key matcher dispatch in the Plateau judge* — not "the existing judge already interprets it."

The four-member set is closed and exhaustive over what these four runtimes emit: scalars (`exact`), structured returns/token-maps/`RecoveryResult` (`deep-equal`), locale-format structure (`parts-structure`), behavioral logs (`predicate`).

## Digest

The #1294 cascade proves conformance via the #899/#1789 interaction-script vector model — drive a binding, observe a typed surface, judge against `expect`. The non-engine relocations produce non-verdict output (a token map, a formatted string, recorded calls, a `RecoveryResult`), so #1816 asks what shape they relocate under. Survey result: candidates (A) extend-the-vector-model and (B) golden-output-corpus are *both already real and complementary* in the tree, and the model was never verdict-locked — so the framing collapses to **support-both, classified by output nature**, with one real fork on comparison semantics.

The concern decomposes into two orthogonal axes the survey surfaced, each pinned to the real tree:

- **Suite shape** — *interaction-script vs golden-output*. Both exist: the interaction-script `ConformanceVectorSuite` (`we:conformance-vectors/schema.ts:53-82`) whose `expect` is open-ended (`we:conformance-vectors/schema.ts:38-47`) and already observes a number (`violationCount`) in `we:conformance-vectors/webcompliance.vectors.ts`; and the Doc-Spec golden-output suite (#1163, `we:conformance-vectors/webdocs.vectors.ts:1-118`) for pure `(input)→structured output` transforms, deep-equality-judged, exported as a separate shape (`we:conformance-vectors/index.ts:20-22`). This axis is **not a fork** — each runtime maps cleanly to one shape (transforms→golden, provider behavior→interaction-script).
- **Comparison matcher** — *how `expect` is judged*. The judge today is strict `===` per key (`plateau:src/conformance-engine/conformanceVectors.ts:142-147`). Fine for scalars; wrong for structured returns (object `===` never holds) and *false-positive-prone* for locale-sensitive output (intl strings vary by ICU/CLDR version). **This is the one real fork.**

### Recommended path at a glance

| Fork | Ratified ruling | Rejected | Confidence |
|---|---|---|---|
| Fork 1 — comparison matcher for non-verdict output | **(a) a closed matcher set** `{exact · deep-equal · resolved-options/parts-structure · predicate}` carried as a per-`expect`-key tag in the WE schema, judged in Plateau | (b) strict-equality-only · (c) per-shape binding judges | High |

## Fork 1 — the comparison matcher for non-verdict output

**Fork-existence:** genuine choice (case b) — the matcher approaches cannot coexist as *the* canonical mechanism: a single `expect` tag set in the WE schema and a per-shape binding-judge base are mutually-exclusive homes for "how do we compare non-verdict output," and the composability probe fails (a per-shape judge cannot be a facade over a matcher tag — it owns its own driver). One must be canonical.

**Crux:** the interaction-script judge compares each `expect` key by strict `===` (`plateau:src/conformance-engine/conformanceVectors.ts:142-147`). webcompliance scalars pass through this fine, but the four non-engine outputs do not: webtheme's resolved token map and reliability's `RecoveryResult` are objects (never `===`), and intl's formatted strings depend on the host engine's ICU/CLDR version (`we:intl/provider.ts:35-60` returns native `Intl.*`), so *any* equality falsely fails a conformant impl.

- **(a) A closed matcher set on the existing two shapes. RATIFIED.** Add a per-key `matcher` field to the WE `ConformanceExpectation` schema — `exact` (today's `===`), `deep-equal` (structural, for token maps / `RecoveryResult`), `resolved-options/parts-structure` (assert `resolvedOptions()` + `formatToParts` part types/order for `Number`/`DateTime`/`RelativeTime`, treating whitespace/separator classes as equivalence classes), `predicate` (boolean over the observed surface: contains / subset / count / absence / collator sign-order) — interpreted by the **Plateau judge**. Each non-engine runtime classifies onto a shape (transform→Doc-Spec golden (B); provider behavior→interaction-script (A)) and picks a matcher: webtheme `deep-equal` on the **`resolveTokens` map** (not the `compileToCss` string); reliability `deep-equal` on `RecoveryResult`; intl `Number`/`DateTime`/`RelativeTime` `parts-structure`, intl `Collator` `predicate` (sign/order); analytics `predicate` over the recorded-call log.
- (b) Strict equality only, author goldens to match. *Rejected* — false-negatives for intl (ICU/CLDR drift, the U+202F shift around ICU 72; Test262's Intl suite avoids exact-output asserts for exactly this), and object outputs never `===`. Correctness failure.
- (c) Per-shape binding-judge bases (formatter-judge / aggregator-judge / token-projector-judge), each owning its own driver + comparison. *Rejected* — needless proliferation of near-identical drivers; the two existing suite shapes plus the four matchers cover all four subsystems, so the extra bases buy no merit (a matcher is a comparison tag, not a new driver).

**Skeptic (two passes):** SURVIVES-WITH-AMENDMENT both times. The prep pass refuted exact-equality for intl → folded in `parts-structure`. The ratification red-team (refute-only, against the real tree) confirmed the thesis and (c)'s rejection but landed four amendments — the matcher set was not closeable at three (analytics `void` methods + `Intl.Collator`'s missing `formatToParts` need a `predicate` matcher), webtheme's subject is the resolved map not CSS text, and the judge has no matcher seam today — all folded into **Ruling** above. The amendments sharpen (a); they do not resurrect (c) (a matcher is a schema tag, not a binding base).

## Supported by default (not decisions)

- **Suite-shape axis** — interaction-script and Doc-Spec golden both stay; each runtime maps to one by output nature. Not a fork (the survey's composability finding: A and B coexist as shipped shapes).
- **Generalizing the Doc-Spec golden suite** from `webdocs`-specific to a generic `(input)→output` golden suite is a mechanical follow-on of choosing (a), not a separate call.

## Context

**Constellation placement (#1467 / #1566, `we:docs/agent/platform-decisions.md#we-fui-embed-boundary`):** the conformance **contract + vector/golden corpus + schema** (incl. the new `matcher` vocabulary) stay **`we:`**; the **runner / judge implementation + the matchers + the run** are **`plateau:src/conformance-engine/`**; the per-target **binding** (a `fui:webtheme/` compile binding, a `fui:intl/` provider binding, etc.) is the subject, shipped by **FUI**. No new WE→FUI code edge — topology identical to the webpolicy/webcompliance cascade; #1282 (WE holds zero executable) holds.

**Per-subsystem relocation still happens per cascade.** This decision only settles the *conformance shape* each non-engine subsystem's `/slice 1294` cascade targets at its binding+corpus slice (the webcompliance C3 analogue) — it unblocks those cascades, it is not itself a relocation.

---

Surfaced by `/slice 1294` (`we:reports/2026-06-27-split-analysis-1294-webcompliance.md`) as the gate for the non-engine subsystems — flagged in the prior 1294b analysis but never filed as a card. Grounds: #1784 (facts→verdict KIT, resolved — this is its non-engine complement), #899 (declarative-vector model), #1789/#1790 (synchronous binding + plateau runner), #1163 (the Doc-Spec golden-output precedent), #404 (webtheme token projection), #1282 (zero-executable rule driving the relocation).
