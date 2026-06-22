---
kind: decision
status: resolved
blockedBy: []
parent: "1585"
relatedProject: webaudit
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-credibility-weight-tuning-surface.md
tags: []
---

# Technical Configurator card: tunable design-knowledge tier-weights (plateau-app)

**PREPARED 2026-06-22** (research: [/research/credibility-weight-tuning-surface/](/research/credibility-weight-tuning-surface/) · report [`we:reports/2026-06-22-credibility-weight-tuning-surface.md`](../reports/2026-06-22-credibility-weight-tuning-surface.md)). The #1588 Fork-3 residual the ruling names as its own card: a *surface* by which a project retunes the design-knowledge tier weights + adds custom source-kinds/modifiers over the WE meta-schema default flavor (config-extends-platform-default in UI form). **The prep reshaped the decision:** the dominant question is no longer *which surface* but *whether to build one at all yet* — because the override path the editor would feed **has no consumer today** (verified). Under the [#1620](/backlog/1620-backlog-hold-model-add-a-load-bearing-priority-field-decide-/) hold model the recommended ruling is **keep OPEN at `priority: low`** (settled & valid, agent-buildable anytime, just low-value until a consumer appears) — **not** a `maturityGated` park, because the artifact is fully specifiable now (the `opts` shape is frozen by #1591, the surface model is pre-decided by Fork 2), so building doesn't yield a *worse* artifact; it's just not worth doing yet. The surface-model question (dedicated editor vs Configurator domain) is the **recorded direction** for whoever picks the low-priority build up.

## Grounding digest

- **#1588 ruled config-extends-platform-default**; #1591 graduated it into [`we:src/_data/credibilityWeighting.js`](../src/_data/credibilityWeighting.js): a frozen meta-schema (`sourceKindDefault`, `weightModifierDefault`, `weightFloorDefault`, `stalenessHorizonYearsDefault`) + the pure `computeCredibilityWeight(source, opts)`, where **`opts` *is* the project-override mechanism** (`{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }`).
- **The override path has zero consumers** (verified by repo-wide grep): `computeCredibilityWeight` has **no production call sites** — its only caller is its own test ([`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs)). The sole weights "consumer", the #1586 ledger [`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json), **hardcodes literals** (`0.75 / 0.75 / 0.9 / 1.0`) with no modifiers and never calls the function. No `opts` override is passed anywhere.
- **The Configurator is a selection ranker, not a config editor** — [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts) `Domain = { axes[], strategies[] }`; `rankStrategies` scores each strategy's per-axis value against required values. A tuning card has **no rival strategies and no required axes** — so a Configurator domain is a category mismatch.
- **Prior art for config-extends-default editing** (full survey in the research topic): VS Code settings (layer over default, persist only deltas, reset-to-default); RJSF (schema = frozen spine, `formData` = portable override, `additionalProperties` = add-custom-entry); Promptfoo (tunable rubric weights + custom criteria in one committed config — the closest analog); LaunchDarkly (hosted store = the lock-in anti-pattern). Lesson: the override is a **delta over the default**, which is exactly what `opts` already is.

## Axis-framing

The card sits at the intersection of two ratified postures: **config-extends-platform-default** ([`we:docs/agent/platform-decisions.md`](../docs/agent/platform-decisions.md)) says a project must be able to retune the flavor, and **minimize-lock-in / devtools = zero lock-in** says any tool we build must emit a portable, project-owned artifact, not an internal store. The #1591 graduation *already satisfies the first*: `computeCredibilityWeight(source, opts)` accepts a delta object, so "a project retunes weights" is a solved mechanism — write an `opts` blob, pass it in. What #1592 adds is only a **UI** over that mechanism. The decisive grounding is that the mechanism has **no caller**: the corpus that would consume weights ([`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json)) hardcodes its four numbers and is hand-edited by the WE maintainer. So the real axis is **timing** — build a speculative editor for an unused function now, or defer until a consumer forces the surface — with the *surface-model* axis (dedicated editor vs Configurator domain, grounded at [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts)) only live if timing flips to build.

## Recommended path at a glance

Ratify both rows, or override the one you'd change. Fork 2 records the surface direction carried on the `priority: low` build.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · hold — low-priority vs park vs build now** | **keep OPEN at `priority: low`** (settled & valid, buildable anytime; just low-value until a consumer of the `opts` path exists) — *not* `maturityGated`, since the artifact is fully specifiable now | (i) `maturityGated` park *(rejected — building now does **not** yield a worse artifact: `opts` shape frozen #1591, surface pre-decided)*; (ii) build now *(rejected — premature: 0 callers)* | **High** — verified zero-consumer + frozen-shape facts |
| **2 · surface model** | **dedicated weight-tuning editor** (config-extends-default UI emitting the portable `opts` shape) — the recorded direction for the `priority: low` build | extend the Technical Configurator with a non-selection "tuning" domain kind *(rejected — Configurator is a selection ranker)* | **Med-high** |

## Supported by default (not forks)

- **The persistence / output contract is pre-resolved**, not a fork: an override artifact *is* the existing `opts` shape (`{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }`) — a portable, project-owned, delta-only config consumed by `computeCredibilityWeight`. A plateau-internal preserve-both store (like vision-review's) is excluded by **minimize-lock-in**: a tool-internal store that never emits a project artifact can't actually feed the project's corpus. No new WE surface; the panel previews via recompute against the pure function. (The composability probe confirms this: there is nothing to build here that isn't the existing `opts` argument.)
- **The meta-schema stays frozen** (#1588/#1591) — not re-decided here. Only the numbers + additions flex.

## Fork 1 — under the #1620 hold model: `priority: low`, `maturityGated` park, or build now?

**Why it's a fork (forced invariant):** the *build-now* branch is **flawed** against the constellation's verified-second-consumer habit (build cards when a real consumer needs them). A surface built now produces overrides for a function with **zero call sites** ([`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs) is the only caller) feeding a 4-row ledger that hardcodes its weights and is hand-edited. But the *hold* the deferral takes is itself a fork the [#1620](/backlog/1620-backlog-hold-model-add-a-load-bearing-priority-field-decide-/) model forces apart: `priority: low` (settled, buildable, low-value-now → demote-not-hide) vs a `maturityGated` park (building now yields a **worse artifact**). The branches yield observably different pool states (visible filler vs removed-until-trigger vs a bespoke unused panel), so it is a real either/or.

- **(a — recommended) Keep OPEN at `priority: low`** ([#1620](/backlog/1620-backlog-hold-model-add-a-load-bearing-priority-field-decide-/) hold model). The retune surface is *settled & valid* (Fork 2 fixes its shape) and *agent-buildable anytime* — it is simply **low-value-now** because the `opts` path has no consumer. `priority: low` is the model's exact match: dropped from the auto-selected ready set but **visible/pickable** in the filler group, so a real need re-surfaces it without a hidden park. The retune *mechanism* already ships free via #1588/#1591 (`computeCredibilityWeight(source, opts)`), so nothing is owed today. On ratify: resolve this decision and carry the build as a successor item tagged `priority: low` (lineage: #1588 Fork-3 → #1591).
- **(b) `maturityGated` park** behind a typed `maturityTrigger` (`externalConsumers≥1`). **Rejected** — `maturityGated` is reserved for *building-now-yields-a-worse-artifact* (guess the shape, tune against nothing). That test **fails here**: the `opts` shape is frozen (#1591) and the surface model is pre-decided (Fork 2), so the artifact is fully specifiable today. No consumer makes it *low-value*, not *unbuildable-correctly* — a `priority` signal, not a maturity one. Parking it would be soft-`deferred` 2.0, which #1620/#1392 retired.
- **(c) Build a surface now** (then Fork 2 picks which). **Rejected** — premature generalization: a UI for an uncalled function and a hand-edited 4-row corpus; pre-commits a consumption contract for an audience of zero. Differs from (a) only in *when* — (a) keeps the same build visible-but-demoted instead of doing it speculatively.

**Skeptic:** REFUTED → default flipped (then refined). The skeptic located the zero-consumer fact and refuted the original "build a surface now" framing; the verified grep (0 call sites; ledger hardcodes literals) confirms it. The #1620 hold model then refines *how* to hold it: the frozen-shape fact rules out a `maturityGated` park (no worse-artifact risk), landing on `priority: low`. The *direction* of the eventual build survives (a portable `opts`-shaped config is trivially correct), captured in Fork 2 + Supported-by-default.

## Fork 2 — surface model: dedicated editor or a Configurator domain?

**Why it's a fork (forced invariant):** the *Configurator-domain* branch is **flawed** — [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts) models a `Domain` as `{ axes[], strategies[] }` and `rankStrategies` scores **rival strategies** against **required axis values**; a weight-tuning card has neither, so folding it into the [`plateau:src/technical-configurator/provider.ts`](../../plateau-app/src/technical-configurator/provider.ts) `seed-*` + provider pattern is a category mismatch (it would require inventing a second, non-selection `Domain` kind for one card). The two branches are a genuine either/or for *where the surface lives*. This is the **recorded direction** for the `priority: low` build — settled now so the eventual pickup is mechanical, not a re-open.

- **(a — recommended) A dedicated weight-tuning editor** — a small plateau panel mirroring the [`plateau:src/vision-review/vision-review.ts`](../../plateau-app/src/vision-review/vision-review.ts) / `plateau:src/review-harness/` "edit + preserve-both" pattern, loading `credibilityWeighting`'s default flavor and letting a project override tier numbers + add kinds/modifiers, emitting the portable `opts` shape. Smallest, fits the data, doesn't dilute the Configurator. (If a framework is preferred over a bespoke panel, RJSF / JSON Forms over the meta-schema is the off-the-shelf option — same dedicated-surface branch.)
- **(b) Extend the Technical Configurator** with a new non-selection "tuning" domain kind. **Rejected** — dilutes a selection ranker's model for one card; the reuse argument is hypothetical (no other numeric-config card exists), and a future one would re-open this anyway.

**Skeptic:** SURVIVES — the skeptic agreed (b) is correctly rejected (the selection-tool constraint is architectural, not aesthetic: `rankStrategies` has no meaning without rival strategies). It noted (a) isn't built now — it's the recorded direction carried on the `priority: low` build.
