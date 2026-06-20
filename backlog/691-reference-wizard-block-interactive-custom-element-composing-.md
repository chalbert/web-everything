---
kind: story
size: 3
parent: "651"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "blocks/wizard/WizardElement.ts (wizard-flow custom element) + blocks.json#wizard"
tags: []
---

# Reference wizard Block — interactive custom element composing Flow Progress over CustomWorkflowEngine (webworkflows)

Slice A of #651. Build the new wizard Block (NEW blocks/wizard/) as a custom element wiring customWorkflowEngine.resolve().start(graph) → a Flow-Progress UX: compose StepperBehavior (we:blocks/stepper/StepperBehavior.ts) for current position + aria-current=step + Step N of M; map the engine's onTransition to per-step status (wait/process/finish/error); back/undo via the instance back(); default to the wizard register; reuse navigation's structure:linear/guard/history. composesIntents over flow-progress (we:src/_data/intents.json#flow-progress, #634). Ship with a unit/render test.

Demoable: the element drives a graph with per-step status, aria-current, back/undo, proven by its test, droppable on any page. #650 (engine) resolved → unblocked. Watch-item: if it re-estimates >3, sub-slice A1 element+stepper / A2 status+back/undo. Runtime browser proof is sibling slice B.

## Progress

Resolved 2026-06-15. WE locus (commit → webeverything). Built whole (did not need the A1/A2 sub-slice — it was a genuine size·3).

- **`we:blocks/wizard/WizardElement.ts`** (new) — a `<wizard-flow>` custom element. On `.graph` set, resolves `customWorkflowEngine.resolve(opts.engine)` and `start(graph)`, derives the step order from `Object.keys(graph.steps)`, generates the indicator list + panels + Next/Back controls + a polite live region, and composes **StepperBehavior** in `free` progression (the engine is the source of truth for position; the stepper only *presents* — `aria-current="step"`, the Step N of M announcement, one-panel-at-a-time). Next → `instance.send(opts.nextEvent ?? 'NEXT')`; Back → `instance.back()`; `instance.onTransition` drives `stepper.goTo(...)` + a per-step status repaint. Status is the index-based flow-progress `stepStatus` projection (`finish` before current, `process` at current, `wait` after) with `error` read from `context.errors[stepId]`, surfaced as `data-step-status` on each indicator. Droppable: optional `<template data-step-id>` children fill panels; `options.labels` set indicator text. Exposes `registerWizard()`.
- **`we:blocks/__tests__/unit/wizard/wizard-element.test.ts`** (new) — 5 render tests over a real 3-step linear graph + the native engine: initial position (`aria-current`, panel hidden state, "Step 1 of 3"), Next-driven status mapping (`['finish','process','wait']` → completion disables Next), back/undo via `instance.back()` (Back disabled at step 0), per-step `error` from threaded context, and author labels + `<template>` content.
- **`fui:src/_data/blocks.json`** — new `wizard` entry (`status: active`, `implementedBy: @frontierui/blocks/wizard/WizardElement.ts`, `implementsIntent: flow-progress`, `composesIntents: [flow-progress]`, `dependsOn: [stepper, workflow-engine]`, `register: wizard` / `movement: back-allowed`). **`we:src/_includes/block-descriptions/wizard.njk`** — the required description page. **AGENTS.md** — `gen:inventory` regenerated (68 → 69 blocks).

Sibling slice B (runtime browser proof) stays separate, as scoped.

Verification: `npx vitest run blocks/__tests__/unit/wizard` = 5 passed (25 across wizard + stepper + workflow-engine, all green). `npm run check:standards` = 0 errors (28 pre-existing warnings) after the inventory regen. `npx @11ty/eleventy --dryrun` build smoke = clean (the new `/blocks/wizard/` page + description render with no template error).
