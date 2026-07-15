---
kind: task
status: open
dateOpened: "2026-07-15"
tags: []
---

# plateau-app build is broken: conformance page references a missing entry module

Pre-existing on plateau-app main (surfaced while landing #2510): the production build fails — vite:build-html cannot resolve the entry module referenced by plateau-app:conformance.html (the referenced plateau-app:src/conformance-engine/conformanceEmbed.ts and its whole directory do not exist on main). This fails the vite build entirely, so the plateau-app e2e CI job (which builds first) is red on main for every PR. Fix: either restore/create the missing entry module or remove the dangling script reference in plateau-app:conformance.html. Unrelated to the nav slice; found because #2510's PR e2e went red on this build step while unit tests passed.
