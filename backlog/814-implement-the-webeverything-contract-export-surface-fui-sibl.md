---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-16"
tags: []
---

# Implement the @webeverything/* contract export surface + FUI sibling-alias resolution (per #804 ruling 1a+2a+3a)

Implement the #804 ruling so FUI can import WE-resident contracts. WE side: add a package.json + curated exports map to capability-manifest/ (whole plane) and validation-generation/ (provider, registry, fieldError, cel + service wire-contract types only — crossField, adapters/*, and the service handler excluded by omission so Node exports semantics enforce the #730 split), each scoped @webeverything/* with name == specifier (#239); split service.ts so only the wire-contract types remain WE-exported (handler ports to FUI under #725). FUI side: add tsconfig paths + vite alias mapping the full @webeverything/capability-manifest and @webeverything/validation-generation specifiers to ../webeverything/<dir> (mirrors plateau-app's proven sibling-alias pattern; no registry publish). Unblocks #725.
