# Credibility-weight tuning surface — prep research for #1592

**Date:** 2026-06-22 · **Item:** [#1592](../backlog/1592-technical-configurator-card-tunable-design-knowledge-tier-we.md)
(decision, parent #1585, residual of #1588 Fork-3) · **Status:** prepared (not yet ratified)

## Question

#1588 ruled the design-knowledge corpus is governed by **config-extends-platform-default**: WE ships a
frozen meta-schema + a default "flavor" of credibility weights; a *project* may retune the tier numbers and
add custom source-kinds/modifiers. #1591 graduated that into [`we:src/_data/credibilityWeighting.js`](../src/_data/credibilityWeighting.js).
#1592 asks: **how should a project actually perform that retune** — i.e. what *surface* (if any) lets a
project edit its override flavor?

The card originally said "add it as a Technical Configurator domain (seed + provider entry)." The batch
pre-flight already found that premise broken (the Configurator is a *selection* ranker, not a config
editor). This prep:
1. surveys prior art for "config-extends-default editing" UIs,
2. **verifies the actual consumer graph** of the override path (the load-bearing fact), and
3. reshapes the fork around what the grounding forces.

## Load-bearing finding (verified against the tree, not asserted)

The override path **has no consumer today.** Verified by grep over the whole repo (excluding `node_modules`):

- `computeCredibilityWeight()` — the function whose `opts` argument *is* the project-override mechanism —
  has **zero production call sites**. Its only caller is its own test
  ([`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs)).
- The sole "consumer" of weights, the #1586 ledger
  ([`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json)), **hardcodes weight
  literals** (`0.75`, `0.75`, `0.9`, `1.0`) and applies **no modifiers** — it does not call
  `computeCredibilityWeight` at all; the weights were computed once, by hand, and pasted in.
- The `opts` override surface (`sourceKinds` / `weightModifiers` / `floor` / `stalenessHorizonYears`) is
  passed in by **nobody** outside the function's own defaults.

So a "weight-tuning editor" built now would produce overrides for a function with no callers, fed into a
4-row ledger that the WE maintainer hand-edits in a text editor. This is the fact the surface-model fork
must be decided *on top of* — and it dominates it.

## Prior-art survey — "config-extends-default" editing UIs

Surveyed external patterns for editing a config that layers over a frozen default (full digest in the
[research topic](/research/credibility-weight-tuning-surface/)):

1. **VS Code settings** — the canonical "differs-from-default" UI: Default → User → Workspace layering, a
   `@modified` filter + a gutter marker showing what diverges, per-setting *Reset to default*, and —
   load-bearing — it persists **only the deltas** to a plain user settings file the project commits, never
   a copy of the spine. ([docs](https://code.visualstudio.com/docs/configure/settings))
2. **react-jsonschema-form (RJSF)** — seeds the form from the schema's `default` values; the frozen spine
   lives in `schema`, the user's overrides in the exportable `formData`. `additionalProperties` is the
   established **"add a custom entry beyond the fixed vocabulary"** mechanism — exactly "fixed named
   modifiers (override-only) + custom kinds (add-slot)." ([docs](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/objects/))
3. **JSON Forms** — a harder data/schema/uischema split; the edited config (data) is a standalone portable
   object decoupled from the frozen schema. The choice when the override must be portable across stacks.
4. **Promptfoo** — the closest analog: tunable **weights** on rubric criteria + extensible custom
   criteria, all in one **version-controlled config file** the project owns. ([docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/))
5. **Weighted-scoring / MCDA tools** — the generic "tunable weights" UX is a flat editable weight per named
   criterion with a live computed rollup (not a wizard).
6. **LaunchDarkly** — the *opposite* portability choice: per-key override-of-default, but stored in a
   hosted store read via API, not a committed file — the anti-pattern for "project owns the config."

**Design lessons that matter here:**
- **Persist deltas, not a full copy** (VS Code). The override artifact is the *diff* from the platform
  default; the computation merges override-over-default at consume time. This is *already exactly* what
  `computeCredibilityWeight(source, opts)` does — `opts` is the delta, the `*Default` exports are the spine.
- **Model the frozen spine and the open extension as two regions** (RJSF `additionalProperties`): fixed
  named modifiers = declared props (override-only); custom kinds = an add-slot. WE's data already mirrors
  this (`sourceKindDefault` / `weightModifierDefault` are extend-not-fork maps).
- **A dedicated single-purpose editor vs a config framework** is a real split: dedicated wins a tighter
  domain UX (live recompute, sum-to affordances) at the cost of rebuilding diff/reset/add plumbing; a
  framework (RJSF/JSON Forms) gives that plumbing free but a generic form UX. Promptfoo's answer — *no GUI
  at all, just a hand-edited committed config* — is the lowest-effort point on that axis, and is the
  honest baseline for a five-number override blob.

## Skeptic pass (run in prep, folded in)

A skeptic was tasked to refute both recommended defaults. It located the load-bearing fact above (0 call
sites; ledger hardcodes literals) and returned **REFUTED** on the original surface-model defaults: neither
"dedicated panel" nor "extend the Configurator" should be built *now*, because the override path the editor
would feed has no consumer. The constellation's own habit — verify a real second consumer before
generalizing (Verify-Bulk / build-cards-when-a-real-consumer-needs-them) — cuts directly against
pre-building a bespoke surface. The direction of the *eventual* answer survives: when a real consumer
appears, the portable project-owned override config (the existing `opts` shape) is trivially correct, and
a plateau-internal store is dead on minimize-lock-in.

This reshapes the prepared fork: the dominant call is now **timing** (build-now vs defer), with the
surface-model question demoted to a *conditional* sub-fork that only matters if timing flips to build.

## Recommended ruling (prepared, for the decision turn)

- **Fork 1 (timing) → defer & PARK** behind an un-park trigger: *a real consumer of the override path
  exists* — either (1) a non-WE project needs a retuned flavor, or (2) the #1586 ledger actually starts
  calling `computeCredibilityWeight` (with modifiers) instead of carrying hand-pasted literals. Until then
  the #1588 ruling already gives the retune mechanism for free (write an `opts` object, pass it to the pure
  function); no surface is owed.
- **Fork 2 (surface model, conditional on Fork 1 = build)** → **(a) a dedicated weight-tuning editor**, not
  (b) a new Configurator domain (the Configurator is a selection ranker — verified `Domain = {axes,
  strategies}` + `rankStrategies`; a tuning card has no rival strategies / required axes). If a framework
  is wanted instead of a bespoke panel, RJSF/JSON Forms over the meta-schema is the off-the-shelf option.
- **Persistence/output is pre-resolved, not a fork:** the override artifact *is* the existing `opts` shape
  (`{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }`) — a portable, project-owned, delta-only
  config. A plateau-internal store is excluded by minimize-lock-in.

## Refs

- [`we:src/_data/credibilityWeighting.js`](../src/_data/credibilityWeighting.js) — the meta-schema + default flavor + `computeCredibilityWeight(source, opts)`.
- [`we:src/_data/designKnowledgeWatch.json`](../src/_data/designKnowledgeWatch.json) — the 4-row ledger; hardcoded weight literals.
- [`we:scripts/__tests__/credibility-weighting.test.mjs`](../scripts/__tests__/credibility-weighting.test.mjs) — the only caller of `computeCredibilityWeight`.
- [`plateau:src/technical-configurator/types.ts`](../../plateau-app/src/technical-configurator/types.ts) — `Domain = {axes[], strategies[]}`, the selection model.
- [`plateau:src/technical-configurator/provider.ts`](../../plateau-app/src/technical-configurator/provider.ts) — `seedProvider` (seed + provider entry pattern).
- [`plateau:src/vision-review/vision-review.ts`](../../plateau-app/src/vision-review/vision-review.ts) / `plateau:src/review-harness/` — the "edit + preserve-both" panel pattern fork-2(a) would mirror.
