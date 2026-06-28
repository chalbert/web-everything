---
kind: task
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753"]
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — embed plateau-app config panels via direct mount import

In the shell chrome, import and call the existing in-process panel mounts mountTechnicalConfigurator (plateau:src/technical-configurator/configurator.ts:639), mountIntentConfigurator (plateau:src/intent-configurator/configurator.ts:421), mountProfiles (plateau:src/profiles/profiles-page.ts:165) — the direct package-import seam ratified by #1654 (no iframe/web-component boundary). Home plateau:src/dev-browser/shell/.
