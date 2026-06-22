---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, disclosure-nav, frontierui]
---

# Convert disclosure-nav to we-disclosure-nav custom element (persistent light-DOM B)

Register the disclosure-nav block as a we-disclosure-nav custom element via the persistent light-DOM (B) mechanism, mirroring the shipping reference at fui:blocks/wizard/WizardElement.ts. Styled-noun nav widget with disclosure open/collapse state -> persistent B per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Wave-3 slice (we:reports/2026-06-22-1442-slice-wave-3.md), flat application of an already-shipping pattern, no buried fork.
