---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, button, frontierui]
---

# Convert button to we-button custom element (transient/A)

Apply #1381's ratified mechanism A to the button: replace the createButton/mountButton factory (fui:blocks/button/Button.ts:50-58) with registerButton(tag='we-button') built on the shipping TransientElement pattern (fui:blocks/transient/TransientElement.ts:28). we-button upgrades, transfers attributes to a real native `<button>`, and erases itself; declarative behaviors ride CustomAttributes on the surviving native button. The #1381-named reference application, still unbuilt. Demoable via the embed/contract mountInDocument path.
