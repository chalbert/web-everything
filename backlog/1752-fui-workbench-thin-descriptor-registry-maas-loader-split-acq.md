---
kind: story
size: 8
parent: "746"
status: open
dateOpened: "2026-06-24"
tags: []
---

# FUI workbench thin-descriptor registry + /_maas/ loader (split acquisition)

Build the #1731 ratification (Fork 2 = split acquisition): replace the hardcoded WorkbenchBlock load/create/cem/authorSource closures in fui:workbench/registry.ts with thin per-block descriptors + a loader. Native primary stage loads via direct import() of the authoritative FUI element; polyglot React/Vue live forms load from the cross-origin /_maas/ serve URL (#1499); source-only blocks carry no loadable shape (#1701 relaxed contract); add an opt-in as-served secondary native view. servePathIR stays executable-only. Pairs with #1618 (source/CEM data route + consumption). Parent #746; enabled by ratified #1731.
