---
kind: decision
parent: "746"
status: open
dateOpened: "2026-06-24"
tags: [workbench, maas, frontierui, decision]
---

# Workbench resolves block shape from the FUI /_maas/ serve URL, not hardcoded WorkbenchBlock literals

Reframe: the workbench should be thin UI over rendering, with the FUI /_maas/ serve endpoint (#1029, conforming to servePathIR) providing whatever shape the UI needs for a component — source forms, CEM, a loadable element module, or a specific case example — resolved by URL, instead of each block hardcoding load/create/cem/authorSource closures inline in fui:workbench/registry.ts. Open axes to prepare: (1) does the serve URL provide a LOADABLE module across the #700 / cross-origin seam, or only data shapes (source/cem) at build time; (2) how the URL declares which shape(s) a consumer requests (servePathIR already models this); (3) dependency on #1730 (MaaS runtime relocation to FUI) and #1029. Recommended end-state (user-stated, not yet prepared): URL-resolved blocks; #1701(a)'s relaxed contract is a prerequisite. The #1618 source-only registration should align here before hardcoding 9 literals. Parent #746.
