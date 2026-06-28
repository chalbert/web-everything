---
kind: story
size: 5
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a live non-deterministic interactive search/filter surface exists on a dogfooded site to host the @ctx rows binding (today seedDeclarativeInjector has only a FUI test fixture, no production consumer)"
blockedBy: ["1827"]
dateOpened: "2026-06-28"
tags: []
---

# Wire runtime injector-context hydration (#1827 seed) to a real dogfooded interactive surface

Production-consumer slice of #1827. The seed mechanism (seedDeclarativeInjector — fui:plugs/webinjectors/declarativeInjector.ts) is built and proven against a FUI fixture; this wires it to a REAL non-deterministic interactive surface (live search/filter/state on a dogfooded site) whose context is client-only, so its `rows` web-expression binding (the `@ctx` context-query form) resolves from runtime state at upgrade. Includes the `@name` → `customContexts:name` key-derivation sugar at the consumer layer (the seed takes the verbatim injector key today). Gated on a real interactive surface existing per 'Prep: Verify Mechanism Has A Consumer'; do not build speculatively.
