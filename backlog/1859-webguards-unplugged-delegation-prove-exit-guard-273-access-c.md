---
kind: story
size: 3
parent: "1836"
status: resolved
blockedBy: ["1856"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/guardsUnplugged.ts
tags: []
---

# webguards unplugged delegation — prove exit-guard (#273) + access-control (#178) per-scope delegation through the unplugged path

Re-audit #1840: webguards resolves a provider through a standalone registry unplugged, but the two delegating members (exit-guard #273, access-control #178) resolve their provider per-scope through the injector chain that fui:plugs/bootstrap.ts:248-251 builds; the unplugged tests prove the registry, not the per-scope delegation. Prove both members work through the unplugged per-scope seam. Blocked by #1856 (the unplugged per-scope injector seam). Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

## Shipped (batch-2026-06-27-1842-1720)

Cascade off #1856's unplugged-injector pattern. **Seam:** `fui:plugs/guardsUnplugged.ts` —
`setupGuardsUnplugged(root)` attaches an `InjectorRoot` and `.set()`s `customGuards` (createDefaultGuardRegistry,
#289) on the injector (+ `window`) — the unplugged equivalent of `fui:plugs/bootstrap.ts:248-251`. **Test:**
`fui:plugs/webguards/__tests__/unit/webguards.unplugged.e2e.test.ts` — **11 tests** proving **per-scope
delegation** (the thing #1840 found unproven): a nested-scope **deny** provider overrides the document-level
permissive native default via `InjectorRoot.getProviderOf(child, 'customGuards')` (nearest-scope-wins), for
**both** members — exit-guard (#273) and access-control (#178, via `evaluateAccess`/`evaluateRegion`) — plus
wiring guards. (Honest scope note: the members are pure functions today with no DOM element, so the test
exercises the real per-scope *resolution* seam and feeds the resolved provider to the member functions — the
exact path a member element would take.) 11/11 pass; tsc-clean. Sonnet-delegated; reviewed on the main loop.
