---
kind: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/stepper-demo.html"
tags: []
---

# Author + host FUI demos for the workflow + stepping blocks (wizard, workflow-engine, stepper)

Author runtime demos for wizard, workflow-engine and stepper (the multi-step flow family) in fui:demos/ and wire demoFile on fui:src/_data/blocks.json. Slice of #972; locus frontierui.

## Progress — stepper shipped; wizard + workflow-engine carved to #990 (batch-2026-06-18)

Authored `fui:demos/stepper-demo.html` (reuses `fui:demos/playground.css`): a `new StepperBehavior(host,
{ stepSelector, indicatorSelector, progression: 'locked', liveRegion, stepLabel })` over a 3-step form —
one panel at a time, indicators carry `aria-current="step"`, the live region announces "Step N of M".
Wired `demoFile` on `stepper` + cleared it from `DEMO_PENDING`. **Playwright-verified on :3001**: Next
advances panel 1→2 + aria-current 0→1, Back returns to 0, live region reads "Step 2 of 3: Profile", 0
console errors.

**wizard + workflow-engine → #990 (blocked on a real defect found here).** Both are un-importable in the
browser: `fui:blocks/workflow-engine/NativeWorkflowEngine.ts` re-exports `customWorkflowEngine` from
`fui:blocks/workflow-engine/registry.ts`, which itself imports `NativeWorkflowEngine` *and* does `new NativeWorkflowEngine()` at module
top level — a load-time import cycle. Benign under vitest, but in a Vite/browser ESM graph it throws
`Cannot access 'NativeWorkflowEngine' before initialization`. A naive cycle-break (removing the re-export)
fails 7 unit tests that import the registry symbols through that entry, so it needs a careful fix
(lazy-seed the default, or relocate the singleton) — carved to #990 with the wizard/workflow-engine demos
that depend on it.
