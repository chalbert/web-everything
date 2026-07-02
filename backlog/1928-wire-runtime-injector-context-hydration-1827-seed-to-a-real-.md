---
kind: story
size: 5
status: active
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
relatedReport: reports/2026-07-02-parked-low-priority-review.md
tags: []
---

# Wire runtime injector-context hydration (#1827 seed) to a real dogfooded interactive surface

Production-consumer slice of #1827. The seed mechanism (seedDeclarativeInjector — fui:plugs/webinjectors/declarativeInjector.ts) is built and proven against a FUI fixture; this wires it to a REAL non-deterministic interactive surface (live search/filter/state on a dogfooded site) whose context is client-only, so its `rows` web-expression binding (the `@ctx` context-query form) resolves from runtime state at upgrade. Includes the `@name` → `customContexts:name` key-derivation sugar at the consumer layer (the seed takes the verbatim injector key today). Un-parked 2026-07-02: the trigger surface now exists — the dogfooded backlog board ships an interactive filter surface (we:src/backlog.njk `<we-filter-chip>` groups + keyword filter) and a genuinely client-only rows surface, the Active-work LIVE board (we:src/assets/js/backlog-active.js, #1854), which renders workflow-run rows purely from polled runtime state — exactly #1818's non-deterministic cell. Target one of those two as the concrete wiring surface (the LIVE board rows are the cleanest `@ctx` fit).
