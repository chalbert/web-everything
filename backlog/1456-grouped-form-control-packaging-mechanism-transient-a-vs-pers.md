---
kind: decision
parent: "1442"
status: open
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, form-controls, decision, frontierui]
---

# Grouped form-control packaging mechanism: transient (A) vs persistent light-DOM (B)

A single form control converts to A (transient self-erase to a native input), but a GROUP (checkbox-group, radio-group) must persist to own cross-child selection state, which leans B (persistent light-DOM). Genuine per-block A-vs-B fork de-buried from #1442's body. Resolving this also settles the form-participation detail for single text-field/number-input (likely A). Locus FUI; consumer refinement of #1381/#1321. Real tree: fui:blocks/checkbox/ (createCheckbox/createCheckboxGroup), fui:blocks/radio/ (createRadioGroup).
