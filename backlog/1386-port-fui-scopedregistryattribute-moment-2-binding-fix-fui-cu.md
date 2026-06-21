---
kind: story
size: 3
parent: "1304"
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:plugs/webregistries/ScopedRegistryAttribute.ts"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui ScopedRegistryAttribute MOMENT-2 binding + fix FUI CustomAttribute so bound=true

D2 of #1304 (blocked-by D1 #1385): port we:ScopedRegistryAttribute.ts (the registry= CustomAttribute behavior) into FUI and fix the divergent fui:plugs/webbehaviors/CustomAttribute.ts integration so the MOMENT-2 attach path yields bound=true; restore the ScopedRegistryAttribute describe block in the ported test. The one uncertain piece, quarantined here. Add the index export.

## Progress

- Ported we:plugs/webregistries/ScopedRegistryAttribute.ts →
  fui:plugs/webregistries/ScopedRegistryAttribute.ts **verbatim** (byte-identical) — it imports only
  `../webbehaviors/CustomAttribute` + `./declarativeRegistry`, both present in FUI post-#1385, so it
  ports unchanged.
- Restored the `ScopedRegistryAttribute (MOMENT-2 binding behavior)` describe block + its import in
  fui:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts (the two bound=true / bound=false
  cases #1385 dropped). Added the `ScopedRegistryAttribute` export to fui:plugs/webregistries/index.ts.
- **The quarantined CustomAttribute fix was NOT needed.** The MOMENT-2 attach path already yields
  `bound=true`: fui:plugs/webbehaviors/CustomAttribute.ts `attach()` sets the owner (`#target`) before
  calling `attachedCallback?.()`, and the `ownerElement` getter is already aligned (the #1121/#1333
  rename + the #1354 registry reconciliation closed the divergence in earlier slices). Both ported tests
  pass with no behavior change to CustomAttribute.
- Green: full FUI webregistries suite 51/51 (was 49 + the 2 restored); FUI gate `npm run check:standards`
  0 errors. Cleared the stale `blockedBy: ["1385"]` (resolved).
