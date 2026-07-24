---
bornAs: x1y2w7s
kind: story
size: 5
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2633"]
scope: ["we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-24"
dateResolved: "2026-07-24"
tags: []
---

# Split lens from validation method: a11y, visual-vs-target, perf method registry

In `we:scripts/lib/review-core.mjs`, separate the *lens* (a perspective — correctness, security, a11y, perf, visual-vs-target) from the *method* (the tool that grounds it — axe scan, screenshot-diff against a target, Lighthouse, static reviewer). A juror = lens + method + model; keeping them orthogonal makes config composable. Stand up a method registry and a resolver: care-level + the diff's touch-set → the lens set → the methods each lens attaches (e.g. a UI-file diff auto-pulls a11y + visual; a script diff does not). Depends on the contract slice for the care→method mapping. Aggregation is unchanged (still `DIVERSITY_SELECTION`).

## Progress

- Split lens (perspective) from method (grounding tool) in `we:scripts/lib/review-core.mjs`:
  - `REVIEW_METHODS` + `METHOD_REGISTRY` — the four grounding methods (static-review, axe-scan, screenshot-diff, lighthouse) and which lenses each grounds; `LENS_DEFAULT_METHOD` is the single-sourced inversion.
  - `PERSPECTIVE_LENSES` (a11y / visual-vs-target / perf) — the review-diff-specific lenses a UI diff earns, distinct from the four subject-agnostic `PANEL_LENSES` in `we:scripts/lib/jury-core.mjs`.
  - `classifyTouchSet` (+ `isUiPath` / `isPagePath`) — the diff's changed-file set → the perspective lenses it earns (UI → a11y + visual; page → + perf; script-only → none).
  - `resolveJuryPlan({ careLevel, changedFiles })` — the resolver: reuses jury-core `panelRigorForCareLevel` for the care-band static lenses + rigor dial, appends the touch-set perspective lenses, and attaches each lens's method(s) (the #2633 contract's per-band `validationMethods` override, else the registry default). Aggregation stays `DIVERSITY_SELECTION`.
- Reuses S1 (`we:scripts/lib/jury-core.mjs`) and builds on the #2633 care→jury contract (`POLICY_CARE_JURY`); no duplication. Unblocks the resolver spine (#2655) and adapter contract (S4).
- Tests added to `we:scripts/lib/__tests__/review-core.test.mjs`; `check:standards` green, conformance suite green.
