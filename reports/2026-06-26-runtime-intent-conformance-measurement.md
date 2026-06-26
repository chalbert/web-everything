# Runtime intent-conformance measurement — declared-intent exposure + per-dimension reality oracle

**Date:** 2026-06-26 · **For:** decision [#1791](/backlog/1791-declared-intent-exposure-reality-measurement-contract-for-th/) (gates story #1698, epic #1522 explorer-CLI-autonomy) · **Prep pass** (no ruling — feeds `/next decision`).

## The question

#1698 (the explorer's intent-conformance oracle) wants to read a running page's *declared* density / motion / a11y-level and flag where the rendered page diverges from its own declaration. Its pre-flight found that #1689 delivered a *DeclaredRule* registry (rule→conformance-vector linkage), **not** an intent exposure — so two contracts are undecided: **(1) Exposure** (how a page declares the intents) and **(2) Reality measurement** (how the oracle measures rendered reality per dimension). #1791 must settle both so #1698 builds a pure oracle over `Observation + declaredIntents` instead of inventing the format mid-build.

## What the survey changed

The single load-bearing finding: **the exposure contract already exists and is already consumed.** A running page declares its profile via root `data-intent-*` attributes, and a pure DOM reader already reads them:

- `INTENT_PROFILE_ATTRS = { density: 'data-intent-density', mode: 'data-intent-mode', motion: 'data-intent-motion' }` — `plateau:src/dev-browser/intent-inspector/inspect.ts:11-24`.
- `readIntentProfile(scope)` returns `{ density, mode, motion }` (each `null` when absent) — `plateau:src/dev-browser/intent-inspector/inspect.ts:26-33`. Pure read, no mutation.
- The FUI workbench *emits* these from a design-system preset: `stage.setAttribute('data-intent-'+intent, value)` over `preset.intentDefaults` — `fui:workbench/mount.ts:330-333`.
- The vocabulary is owned by WE intents: `we:density.json` (`comfortable` 44px+ / `compact` 32px / `wafer` 24px touch targets) — `we:src/_data/intents/density.json:1-17`; `we:motion.json` (`natural` / `immediate` <16ms / `reduced` "respects prefers-reduced-motion") — `we:src/_data/intents/motion.json:1-17`.

So the item's three exposure candidates — "a #1689 DeclaredRule entry, a per-page manifest, or native root data-attrs/CSS vars" — collapse: **the root data-attrs already are the live contract.** DeclaredRule is the *wrong layer* (it links declared *rules* to test *vectors* — `plateau:src/dev-browser/declared-rules/types.ts:35-56` — it does not carry a density/motion *profile*). A per-page manifest is a redundant parallel path (bias-to-reuse / no second consumer). That demotes "Exposure" from a fork to **support-by-default: reuse `data-intent-*`** — exactly the #64-style "research dissolves a fork" the prep rubric expects.

Two residuals survive as genuine forks (below): **a11y-level** has *no* exposure today (no a11y-level intent exists in `we:src/_data/intents/` — a11y is split across `accessible-name` etc., and the explorer already delegates a11y to an absolute axe lane), and the **reality-measurement** contract (where measured fields live + how density divergence is measured) is genuinely open.

## Prior art — measurement methods

- **Touch-target sizing (density reality).** WCAG 2.5.8 Target Size (Minimum) = **24×24 CSS px** (AA); 2.5.5 (Enhanced) = **44×44** (AAA). The `we:density.json` bands map onto exactly this scale (comfortable 44 / compact 32 / wafer 24). So density reality = measure rendered interactive-element hit-boxes (`getBoundingClientRect`) against the declared band's floor. This is *geometric* — it catches a page that declares `compact` but a CSS override renders 18px targets, which a token re-read cannot.
- **Reduced-motion (motion reality).** `prefers-reduced-motion` is the platform signal; the native View Transitions API does **not** auto-respect it (`we:conformance-vectors/slide-transition-reduced-motion.vectors.ts`), and the FUI upgrader already infers a `motion` intent from a `prefers-reduced-motion` guard (`fui:blocks/renderers/upgrader/analyzers/legacyWebComponent.ts`). Motion reality = re-render under emulated `prefers-reduced-motion: reduce` and flag still-active non-semantic animations (`Element.getAnimations()` / non-zero `transition`/`animation` on decorative elements).
- **a11y reality.** Already collected: `Observation.a11yViolations` from the #770 axe lane (WCAG 2.0/2.1 A/AA) — `plateau:tools/explorer/oracles/observation.ts:39-46`. No new declaration needed; axe measures *absolute* conformance.

## The oracle pipeline the contract must fit

- `Observation` (the per-state record an oracle reads) — `plateau:tools/explorer/oracles/observation.ts:29-75`. Already carries `a11yViolations`, `layoutOverflow`, `overflowCulprit`, focus/crash/gesture signals. Populated by `PlaywrightObservationCollector`, which already runs in-page probes (layout-overflow, focus-trap) — the same shape a density/motion probe slots into.
- `Oracle.check(obs): Finding[]` — pure predicate — `plateau:tools/explorer/oracles/observation.ts:88-92`. `Finding { oracle, severity, stateId, detail }` — `plateau:tools/explorer/oracles/observation.ts:79-86`. #1698 explicitly *"rides the explorer's existing collector + judge + finding pipeline"* — so the reality fields want to land **on `Observation`**, not in a parallel structure that needs a second collector pass.

## Constellation placement

Per [[project_conformance_verifier_vs_subject]] (#1467): WE owns the **contract** (the intent vocabulary + bands — `we:density.json` / `we:motion.json`); the **verifier/measurer** (the oracle + collector probes) is a plateau-app explorer tool (`plateau:tools/explorer/oracles`). No new WE↔FUI edge — the explorer reads rendered DOM + WE-owned band values, it does not import FUI code.

## Latent inconsistency flagged (not a #1791 fork)

The standard `we:motion.json` vocabulary is `natural | immediate | reduced`; the runtime `plateau:src/design-system-creator/manifest.ts` / `IntentProfile` examples use `full | reduced | none` (`plateau:src/design-system-creator/manifest.ts:27-31`). The reduced-motion oracle only keys on `reduced` (shared by both), so #1698 is unblocked, but the divergence is real — filed as a residual note on #1791, not a measurement fork.
