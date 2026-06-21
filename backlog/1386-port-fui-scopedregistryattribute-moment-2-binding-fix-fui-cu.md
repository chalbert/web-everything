---
kind: story
size: 3
parent: "1304"
locus: frontierui
status: open
blockedBy: ["1385"]
dateOpened: "2026-06-21"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui ScopedRegistryAttribute MOMENT-2 binding + fix FUI CustomAttribute so bound=true

D2 of #1304 (blocked-by D1 #1385): port we:ScopedRegistryAttribute.ts (the registry= CustomAttribute behavior) into FUI and fix the divergent fui:plugs/webbehaviors/CustomAttribute.ts integration so the MOMENT-2 attach path yields bound=true; restore the ScopedRegistryAttribute describe block in the ported test. The one uncertain piece, quarantined here. Add the index export.
