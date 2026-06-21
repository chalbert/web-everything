---
kind: task
parent: "1304"
locus: frontierui
status: open
blockedBy: ["1385"]
dateOpened: "2026-06-21"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui:plugs/webregistries plugged-mode global patching (applyPatches/removePatches/isPatched/attachShadow)

P of #1304 (blocked-by D1 #1385): replace the TODO console.warn stubs in fui:plugs/webregistries/index.ts with WE's written plugged-mode patching — save/swap CustomElementRegistry + customElements, attachShadow scoped-init via applyScopedRegistryToHost (imported from declarativeRegistry), removePatches restore, isPatched. Pure copy of shipped WE code + port we:globalPatching.test.ts. Independent of D2.
