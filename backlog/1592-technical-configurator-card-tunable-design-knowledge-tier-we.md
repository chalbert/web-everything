---
kind: decision
status: open
blockedBy: []
parent: "1585"
relatedProject: webaudit
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-credibility-weight-tuning-surface.md
tags: []
---

# Technical Configurator card: tunable design-knowledge tier-weights (plateau-app)

**PREPARED 2026-06-22** (research: [/research/credibility-weight-tuning-surface/](/research/credibility-weight-tuning-surface/) · report [`we:reports/2026-06-22-credibility-weight-tuning-surface.md`](../reports/2026-06-22-credibility-weight-tuning-surface.md)). The #1588 Fork-3 residual the ruling names as its own card: a *surface* by which a project retunes the design-knowledge tier weights + adds custom source-kinds/modifiers over the WE meta-schema default flavor (config-extends-platform-default in UI form). **The prep reshaped the decision:** the dominant question is no longer *which surface* but *whether to build one at all yet* — because the override path the editor would feed **has no consumer today** (verified). The recommended ruling is **defer & PARK** behind a real-consumer trigger; the surface-model question (dedicated editor vs Configurator domain) is demoted to a conditional sub-fork that only matters if the timing call flips to build.

## Grounding digest

- **#1588 ruled config-extends-platform-default**; #1591 graduated it into [`we:src/_data/credibilityWeighting.js`](../src/_data/credibilityWeighting.js): a frozen meta-schema (`sourceKindDefault`, `weightModifierDefault`, `weightFloorDefault`, `stalenessHorizonYearsDefault`) + the pure `computeCredibilityWeight(source, opts)`, where **`opts` *is* the project-override mechanism** (`{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }`).
- **The override path has zero consumers** (verified by repo-wide grep): `computeCredibilityWeight` has **no production call sites** — its only caller is its own test ([`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs)). The sole weights "consumer", the #1586 ledger [`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json), **hardcodes literals** (`0.75 / 0.75 / 0.9 / 1.0`) with no modifiers and never calls the function. No `opts` override is passed anywhere.
- **The Configurator is a selection ranker, not a config editor** — [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts) `Domain = { axes[], strategies[] }`; `rankStrategies` scores each strategy's per-axis value against required values. A tuning card has **no rival strategies and no required axes** — so a Configurator domain is a category mismatch.
- **Prior art for config-extends-default editing** (full survey in the research topic): VS Code settings (layer over default, persist only deltas, reset-to-default); RJSF (schema = frozen spine, `formData` = portable override, `additionalProperties` = add-custom-entry); Promptfoo (tunable rubric weights + custom criteria in one committed config — the closest analog); LaunchDarkly (hosted store = the lock-in anti-pattern). Lesson: the override is a **delta over the default**, which is exactly what `opts` already is.

## Axis-framing

The card sits at the intersection of two ratified postures: **config-extends-platform-default** ([`we:docs/agent/platform-decisions.md`](../docs/agent/platform-decisions.md)) says a project must be able to retune the flavor, and **minimize-lock-in / devtools = zero lock-in** says any tool we build must emit a portable, project-owned artifact, not an internal store. The #1591 graduation *already satisfies the first*: `computeCredibilityWeight(source, opts)` accepts a delta object, so "a project retunes weights" is a solved mechanism — write an `opts` blob, pass it in. What #1592 adds is only a **UI** over that mechanism. The decisive grounding is that the mechanism has **no caller**: the corpus that would consume weights ([`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json)) hardcodes its four numbers and is hand-edited by the WE maintainer. So the real axis is **timing** — build a speculative editor for an unused function now, or defer until a consumer forces the surface — with the *surface-model* axis (dedicated editor vs Configurator domain, grounded at [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts)) only live if timing flips to build.

## Recommended path at a glance

Ratify both rows, or override the one you'd change. **Fork 2 is conditional** — it only bites if you flip Fork 1 to *build*.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · timing — build now vs defer** | **defer & PARK** behind a real-consumer trigger (no consumer of the `opts` path exists; the retune mechanism already ships) | build a surface now *(rejected — premature: feeds a function with 0 callers)* | **High** — verified zero-consumer fact |
| **2 · surface model (IF Fork 1 = build)** | **dedicated weight-tuning editor** (config-extends-default UI emitting the portable `opts` shape) | extend the Technical Configurator with a non-selection "tuning" domain kind *(rejected — Configurator is a selection ranker)* | **Med-high** — conditional; only live if timing flips |

## Supported by default (not forks)

- **The persistence / output contract is pre-resolved**, not a fork: an override artifact *is* the existing `opts` shape (`{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }`) — a portable, project-owned, delta-only config consumed by `computeCredibilityWeight`. A plateau-internal preserve-both store (like vision-review's) is excluded by **minimize-lock-in**: a tool-internal store that never emits a project artifact can't actually feed the project's corpus. No new WE surface; the panel previews via recompute against the pure function. (The composability probe confirms this: there is nothing to build here that isn't the existing `opts` argument.)
- **The meta-schema stays frozen** (#1588/#1591) — not re-decided here. Only the numbers + additions flex.

## Fork 1 — build a tuning surface now, or defer until a consumer exists?

**Why it's a fork (forced invariant):** the *build-now* branch is **flawed** against the constellation's verified-second-consumer habit (build cards when a real consumer needs them — verify a real consumer before generalizing). A surface built now produces overrides for a function with **zero call sites** ([`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs) is the only caller) feeding a 4-row ledger that hardcodes its weights and is hand-edited. The two branches yield observably different states (a bespoke unused panel + an invented consumption convention vs. nothing, with the retune mechanism already free via `opts`), so it is a real either/or and one branch is broken.

- **(a — recommended) Defer & PARK** behind an un-park trigger: *a real consumer of the override path exists* — either **(1)** a non-WE project needs a retuned credibility flavor, or **(2)** the #1586 ledger [`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json) actually starts calling `computeCredibilityWeight` (with modifiers) instead of carrying hand-pasted literals. Until then #1588's ruling already gives the retune mechanism for free (write an `opts` object, pass it to the pure function); no surface is owed. On ratify, set `status: parked` + `parkedReason` + the trigger above (lineage: #1588 Fork-3 → #1591).
- **(b) Build a surface now** (then Fork 2 picks which). **Rejected** — premature generalization: a UI for an uncalled function and a hand-edited 4-row corpus; pre-commits a consumption contract for an audience of zero.

**Skeptic:** REFUTED → default flipped. The skeptic located the zero-consumer fact and refuted the original "build a surface now" framing outright; the verified grep (0 call sites; ledger hardcodes literals) confirms it. The *direction* of the eventual answer survives (when un-parked, a portable `opts`-shaped config is trivially correct), which is captured in Fork 2 + Supported-by-default rather than built now.

## Fork 2 — IF a surface is built, dedicated editor or a Configurator domain?

**Why it's a fork (forced invariant):** the *Configurator-domain* branch is **flawed** — [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts) models a `Domain` as `{ axes[], strategies[] }` and `rankStrategies` scores **rival strategies** against **required axis values**; a weight-tuning card has neither, so folding it into the [`plateau:src/technical-configurator/provider.ts`](../../plateau-app/src/technical-configurator/provider.ts) `seed-*` + provider pattern is a category mismatch (it would require inventing a second, non-selection `Domain` kind for one card). The two branches are a genuine either/or for *where the surface lives*. **Conditional:** only live if Fork 1 flips to build.

- **(a — recommended) A dedicated weight-tuning editor** — a small plateau panel mirroring the [`plateau:src/vision-review/vision-review.ts`](../../plateau-app/src/vision-review/vision-review.ts) / `plateau:src/review-harness/` "edit + preserve-both" pattern, loading `credibilityWeighting`'s default flavor and letting a project override tier numbers + add kinds/modifiers, emitting the portable `opts` shape. Smallest, fits the data, doesn't dilute the Configurator. (If a framework is preferred over a bespoke panel, RJSF / JSON Forms over the meta-schema is the off-the-shelf option — same dedicated-surface branch.)
- **(b) Extend the Technical Configurator** with a new non-selection "tuning" domain kind. **Rejected** — dilutes a selection ranker's model for one card; the reuse argument is hypothetical (no other numeric-config card exists), and a future one would re-open this anyway.

**Skeptic:** SURVIVES — the skeptic agreed (b) is correctly rejected (the selection-tool constraint is architectural, not aesthetic: `rankStrategies` has no meaning without rival strategies). It noted (a) is moot *unless* Fork 1 flips — which is why this fork is marked conditional, not built now.
