---
kind: story
size: 3
status: open
priority: low
locus: plateau-app
blockedBy: ["1732"]
dateOpened: "2026-06-24"
tags: [webrouting, routing, configurator, plateau, deferred]
---

# plateau Configurator routing domain (deferred, #499-gated)

Deferred, #499-gated: a plateau Configurator routing domain — one plateau:src/technical-configurator/seed-routing.ts plus a provider entry — that walks a developer through routing outcomes and emits webrouting config over the #1687 schema. Build only if it adds outcome-framing value beyond exposing the schema's enums (the intents-UX-only converse-guard); a per-setting test decides which settings earn a guided outcome. Mirrors the live plateau:src/technical-configurator/seed-render-strategy.ts and plateau:src/technical-configurator/seed-file-upload.ts precedent. Parked until routing config proves it needs outcome-framing in a real app flow.
