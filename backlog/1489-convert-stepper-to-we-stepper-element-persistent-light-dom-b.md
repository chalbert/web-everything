---
kind: story
size: 5
parent: "1442"
status: open
blockedBy: ["1457"]
dateOpened: "2026-06-21"
tags: []
---

# Convert stepper to we-stepper element (persistent light-DOM B) over retained StepperBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give stepper its styled is-a form. Add a persistent light-DOM we-stepper element (B-family, like fui:blocks/wizard/WizardElement.ts:25) that hosts the existing fui:blocks/stepper/StepperBehavior.ts kernel, carries FUI styling/theming, and exposes a CEM surface (the #463/#855 framework-flavor generation target). Retain StepperBehavior as the headless can-do capability (attach to author markup). Children stay light-DOM (the [data-step] steps), never shadowed; in-leak isolation via #1349 webisolation. Codified in we:docs/agent/block-standard.md Packaging governance §7.
