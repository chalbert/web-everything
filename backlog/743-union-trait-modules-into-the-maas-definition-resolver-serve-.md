---
type: issue
workItem: story
size: 3
parent: "715"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Union trait modules into the MaaS definition resolver (serve trait chunk bytes)

Item #719 landed the neutral trait served-path (`traitServePath.ts`) + distribution plan that maps a #716 manifest onto the existing #461 origin route, but the MaaS `DefinitionResolver` only resolves component `<name>` artifacts, so a fetch to `/_maas/<trait>.js` still 404s. Extend the resolver (`tools/maas/vite-plugin.ts` indexDefinitions / `definitionRegistry.ts`) to union trait module definitions so trait chunk bytes are actually served. Build seam only — no design fork.
