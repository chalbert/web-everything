---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
blockedBy: []
tags: [packaging, custom-elements, block-model, conversion, checkbox, form-controls, frontierui]
---

# Convert checkbox to we-checkbox plus we-checkbox-group (persistent light-DOM B)

Register the checkbox block as we-checkbox plus a we-checkbox-group persistent light-DOM group element, the mechanism ruled by #1456 (Fork 1 to B). Mirror the persistent reference at fui:blocks/wizard/WizardElement.ts. Single-input + grouped form participation per #1456.
