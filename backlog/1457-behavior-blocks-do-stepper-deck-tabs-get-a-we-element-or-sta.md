---
kind: decision
parent: "1442"
status: open
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, behaviors, decision, frontierui]
---

# Behavior blocks: do stepper/deck/tabs get a we- element, or stay CustomAttribute behaviors?

stepper/deck/tabs ship today as CustomAttribute behaviors (fui:blocks/stepper/StepperBehavior.ts:111, fui:blocks/deck/DeckBehavior.ts:182, fui:blocks/tabs/TabGroupBehavior.ts) — the very shape #1381 endorses as an end-state (behaviors riding native elements). 'Convert to a we- custom element' may be a no-op or a regression for them. Decide whether these blocks gain a we- element wrapper or stay attribute behaviors, before any conversion. De-buried from #1442's body.
