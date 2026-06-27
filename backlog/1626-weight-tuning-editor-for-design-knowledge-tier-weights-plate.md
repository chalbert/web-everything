---
kind: story
size: 3
parent: "1585"
status: resolved
priority: low
locus: plateau-app
relatedProject: webaudit
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: plateau-app/src/weight-tuning/weight-tuning.ts
tags: []
---

# Weight-tuning editor for design-knowledge tier-weights (plateau panel)

`priority: low` build green-lit by decision #1592. A small plateau-app panel (mirroring vision-review's edit pattern) that loads the WE default credibility flavor (we:src/_data/credibilityWeighting.js) and lets a project retune tier numbers + add custom source-kinds/modifiers, emitting the PORTABLE opts shape ({sourceKinds, weightModifiers, floor, stalenessHorizonYears}) consumed by computeCredibilityWeight(source, opts). NOT a Technical Configurator domain (that is a selection ranker, category mismatch — #1592 Fork 2). Low-value-now: the opts override path has zero consumers today, so this stays demoted/visible until a real consumer appears (a non-WE project needs a retuned flavor, or the #1586 ledger starts calling the function with modifiers). Lineage: #1588 Fork-3 → #1591 → #1592.

## Progress (batch-2026-06-26-1806-1825)

Built the panel under `plateau:src/weight-tuning/`, mirroring the vision-review edit pattern (draft + controls
+ localStorage persistence + revert + copy), as a **settings editor** rather than the queue-based review
harness:

- `plateau:src/weight-tuning/data.ts` — pure model. `defaultOpts()` deep-clones the WE flavor from
  `we:src/_data/credibilityWeighting.js` (the `*Default` exports); `toPortableOpts()` emits exactly the
  `{ sourceKinds, weightModifiers, floor, stalenessHorizonYears }` opts `computeCredibilityWeight` consumes
  (NaN/empty fields fall back to the WE default); `addSourceKind`/`addModifier`; `previewWeight()` runs the
  real WE function and returns `{error}` instead of throwing.
- `plateau:src/weight-tuning/credibilityWeighting.d.ts` — ambient types for the WE CommonJS meta-schema module.
- `plateau:src/weight-tuning/weight-tuning.ts` — `mountWeightTuning(root)`: tier/modifier/floor/horizon
  editors, add-custom-kind/modifier, revert-to-WE-default, copy-opts-JSON, and a live computed-weight preview.
  Plus `plateau:src/weight-tuning/weight-tuning.css` and a `plateau:src/weight-tuning/README.md`.
- Wired into the SPA: `plateau:src/main.ts` (import + PRODUCT_ROUTES + breadcrumb + route-stamp mount +
  `tryMountWeightTuning`) and `plateau:index.html` (Tools nav link + `/weight-tuning` route template).

Verification: `plateau:src/weight-tuning/data.test.ts` (9) — defaults load from WE, deep-clone isolation,
portable-opts round-trips through `computeCredibilityWeight`, retunes move the weight, custom kinds/modifiers,
NaN fallback. Full plateau suite 602/602 green; the live Vite dev server transforms the panel module (200), so
the WE-module import chain resolves in the real runtime. Browser-interaction screenshot skipped (the route is
auth-gated) — data + wiring + module-resolution verified.

Stays `priority: low` / zero-consumers per #1592 — visible until a real consumer (a non-WE retuned flavor, or
the #1586 ledger calling the function with modifiers) appears.
