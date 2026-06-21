---
kind: story
size: 3
status: open
blockedBy: ["1365"]
dateOpened: "2026-06-21"
tags: []
---

# plateau Configurator: isolation-strategy (S1/S2) decision card

Add the Technical Configurator domain (plateau-app) for the webisolation isolation-strategy dimension: a per-deployment card letting a consumer choose S1 (unique-class light DOM, native-a11y-free) vs S2 (shadow-per-component, external-CSS immune via ElementInternals), defaulting to S1. Consumes the #1365 platform-config schema; add via seed + provider entry. Spun out of the #1349 graduation.
