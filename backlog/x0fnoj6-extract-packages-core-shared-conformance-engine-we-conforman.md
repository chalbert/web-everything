---
kind: story
size: 5
parent: "xyablkl"
status: open
blockedBy: ["x8yhhn0"]
dateOpened: "2026-07-09"
tags: []
---

# Extract packages/core — shared conformance-engine + WE-conformance probe

Move the shared kernel into plateau:packages/core: the conformance-engine (plateau:src/conformance-engine/) plus the WE-conformance probe markers — window.__WE_DEVTOOLS_GLOBAL_HOOK__ (from fui:plugs/webregistries/declarativeRegistry.ts) and the declarative script[type=registry] form, per #1673/#1722. Every other package (dev-browser, saas, tooling) depends on core, so it is the first extraction after the skeleton lands. Expose it as @plateau/core and re-point existing imports; the pure probe-parsing is headless-testable, so cover it with vitest as it moves.
