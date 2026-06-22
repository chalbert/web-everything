---
kind: story
size: 5
parent: "1442"
status: resolved
blockedBy: ["1457"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/blocks/stepper/StepperElement.ts
tags: []
---

# Convert stepper to we-stepper element (persistent light-DOM B) over retained StepperBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give stepper its styled is-a form. Add a persistent light-DOM we-stepper element (B-family, like fui:blocks/wizard/WizardElement.ts:25) that hosts the existing fui:blocks/stepper/StepperBehavior.ts kernel, carries FUI styling/theming, and exposes a CEM surface (the #463/#855 framework-flavor generation target). Retain StepperBehavior as the headless can-do capability (attach to author markup). Children stay light-DOM (the [data-step] steps), never shadowed; in-leak isolation via #1349 webisolation. Codified in we:docs/agent/block-standard.md Packaging governance §7.

## Progress

Landed (impl → frontierui, contract → webeverything; locus field was missing, added):
- `fui:blocks/stepper/StepperElement.ts` — new persistent light-DOM `<we-stepper>` element (B-family, mirrors `fui:blocks/wizard/WizardElement.ts`). Hosts the existing `StepperBehavior` kernel on connect, carries FUI light-DOM styling under the `we-stepper` scope class (no shadow; #1349 S1), and exposes the CEM attribute surface (`progression` locked/free, `step`) + typed `next`/`prev`/`goTo` accessors. `[data-step]` panels + indicators stay light-DOM children. Idempotent overridable-tag `registerStepper(tag='we-stepper')` (#841).
- `fui:blocks/stepper/StepperBehavior.ts` — dropped the empty placeholder register fn (now the real one in the element file); the kernel stays the headless can-do capability (#1457).
- `we:src/_data/blocks/stepper.json` — `implementedBy` → `fui:blocks/stepper/StepperElement.ts`, `exports` → `[StepperElement, StepperBehavior, registerStepper]` (mirrors the wizard block convention).
- `fui:blocks/__tests__/unit/stepper/StepperElement.test.ts` — 7 cases (idempotent register, host-on-connect, next/delegated-control, locked-blocks-jump, free-allows-jump, live step attr, light-DOM/no-shadow). Stepper suite 13/13; both gates `check:standards` 0 errors.
