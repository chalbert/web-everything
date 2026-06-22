---
kind: story
size: 3
locus: plateau-app
status: resolved
blockedBy: ["1365"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: plateau-app/src/technical-configurator/seed-isolation-strategy.ts
tags: []
---

# plateau Configurator: isolation-strategy (S1/S2) decision card

Add the Technical Configurator domain (plateau-app) for the webisolation isolation-strategy dimension: a per-deployment card letting a consumer choose S1 (unique-class light DOM, native-a11y-free) vs S2 (shadow-per-component, external-CSS immune via ElementInternals), defaulting to S1. Consumes the #1365 platform-config schema; add via seed + provider entry. Spun out of the #1349 graduation.

## Progress

Landed (locus plateau-app — locus field was missing, added):
- `plateau:src/technical-configurator/seed-isolation-strategy.ts` — new domain `isolation-strategy`, hand-authored from the #1365 WE schema (`we:src/_data/isolationStrategies/{s1-unique-class,s2-shadow-per-component}.json`). Three outcome axes — `external-css` (open→immune), `native-dom` (re-forwarded→intact), `runtime` (shadow-runtime→zero-runtime) — with S1 + S2 strategies each declaring a value per axis; default S1 surfaced in the tagline/summary (the WE schema carries `default:true` on S1).
- `plateau:src/technical-configurator/provider.ts` — registered `isolationStrategyDomain` in the seed provider's `DOMAINS` (the provider entry).
- Gate: `npm test` (plateau-app) green — 33 files / 259 tests (40 configurator).
