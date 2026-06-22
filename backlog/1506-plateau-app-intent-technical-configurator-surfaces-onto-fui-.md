---
kind: story
size: 5
parent: "1254"
locus: plateau-app
status: open
dateOpened: "2026-06-22"
tags: []
---

# plateau-app Intent + Technical Configurator surfaces onto FUI form controls

Migrate the Intent Configurator (plateau:src/intent-configurator/configurator.ts) and Technical Configurator (plateau:src/technical-configurator/configurator.ts) off hand-rolled DOM onto FUI form controls (radio/checkbox/text-field/number/droplist) + NL input + verdict panel. Ratchet release of #1254 now that the FUI form-controls gap #1286 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.
