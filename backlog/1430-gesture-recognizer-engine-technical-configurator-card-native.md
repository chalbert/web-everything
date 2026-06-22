---
kind: story
size: 3
parent: "1396"
locus: plateau-app
status: resolved
blockedBy: ["1429"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: plateau-app/src/technical-configurator/seed-gesture-engine.ts
tags: []
---

# gesture recognizer engine — Technical Configurator card (native vs Hammer vs use-gesture)

Add a plateau-app Technical Configurator domain for the gesture recognizer engine choice (native-math default · Hammer.js · @use-gesture), mirroring hover-intent's Configurator card. The recognizer math is a technical strategy, not part of the UX-only gesture intent (intents-UX-only rule). A full Gesture Recognizer Protocol stays a deferred, separately-prioritized candidate (no interop need today — minimize-lock-in).

## Progress

Landed (locus plateau-app — locus field was missing, added):
- `plateau:src/technical-configurator/seed-gesture-engine.ts` — new domain `gesture-engine` mirroring the hover-intent card: three outcome axes (`dependency` library→zero-dep, `recognizer-breadth` core→comprehensive, `framework-fit` agnostic/react-first) and three strategies — native-math (the #1429 ratified zero-dep default), Hammer.js, @use-gesture — each declaring a value per axis. Default native, surfaced in the tagline.
- `plateau:src/technical-configurator/provider.ts` — registered `gestureEngineDomain` in the seed provider.
- The engine seam itself (`fui:plugs/webbehaviors/gestureRecognizer.ts setGestureRecognizerEngine`) already exists (#1429); this is the override-surfacing Configurator card only. A full Gesture Recognizer Protocol stays deferred.
- Gate: `npm test` (plateau-app) green — 33 files / 259 tests.
