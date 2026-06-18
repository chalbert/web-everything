---
type: issue
workItem: story
size: 5
parent: "170"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Merge Frontier UI's attribute-lifecycle + runtime advances up into Web Everything

> **Note (#606, 2026-06-14):** resolved — the convergence work stands (it produced one reconciled
> superset). #606 reversed the canonical *home*: that superset now relocates to **`frontierui/plugs`
> (`@frontierui/plugs`)**, not WE. No re-open; informational for the #170/#449 migration.

Adopt FU's we:CustomAttributeRegistry.ts (visibility-gating + lazy fetch-on-view, #221/#280/#222/#226; FU+541/WE+11 asymmetric merge) preserving WE's 11 unique lines, and fold the FU-ahead/bidirectional reconciles across webbehaviors/index, webexpressions/* (incl. cloneHandlers), webcontexts/*, core/CustomRegistry (GetterValue / entries()), Node.injectors.patch + HTMLInjector. Makes WE the plugs runtime superset. First half of #170's consolidation (the load-bearing merge).
