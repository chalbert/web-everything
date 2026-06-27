---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1856"]
dateOpened: "2026-06-27"
tags: []
---

# webguards unplugged delegation — prove exit-guard (#273) + access-control (#178) per-scope delegation through the unplugged path

Re-audit #1840: webguards resolves a provider through a standalone registry unplugged, but the two delegating members (exit-guard #273, access-control #178) resolve their provider per-scope through the injector chain that fui:plugs/bootstrap.ts:248-251 builds; the unplugged tests prove the registry, not the per-scope delegation. Prove both members work through the unplugged per-scope seam. Blocked by #1856 (the unplugged per-scope injector seam). Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.
