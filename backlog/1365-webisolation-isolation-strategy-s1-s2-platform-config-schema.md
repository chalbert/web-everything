---
kind: story
size: 2
status: open
blockedBy: ["1364"]
dateOpened: "2026-06-21"
tags: []
---

# webisolation: isolation-strategy (S1/S2) platform-config schema

Ship the platform-config schema for the isolation-strategy dimension (S1 unique-class light DOM vs S2 shadow-per-component) alongside the webisolation standard. A per-deployment behavioral value with flavor default S1 (native-first floor; S2 is the author's opt-in for external-CSS immunity). The schema ships with the standard; the plateau-app Configurator UI card that consumes it is #1366. Ratified soft/revisitable in #1349.
