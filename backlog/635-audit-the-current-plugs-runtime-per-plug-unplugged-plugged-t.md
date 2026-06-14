---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "reports/2026-06-14-plugs-runtime-audit.md (per-domain plugs audit; open questions → #649)"
tags: []
---

# Audit the current plugs runtime — per-plug unplugged/plugged/test/drift matrix

Inventory every plug in the runtime tree and produce a per-plug matrix: does it have a non-invasive unplugged form, a plugged form, dual-mode automated test coverage, and is it drifted between the WE and FUI copies? This discovery de-risks the #170 reversal (FUI becomes canonical @frontierui/plugs) and scopes the dual-mode test backfill. Output: a report plus open-questions registered in the backlog. Per the #606 ruling (plugs = implementation, owned by Frontier UI).

## Progress

- Audited all 10 plug domains in `plugs/` vs `../frontierui/plugs/` (unplugged form / plugged form / dual-mode tests / WE-vs-FUI drift). Report: [reports/2026-06-14-plugs-runtime-audit.md](/reports/2026-06-14-plugs-runtime-audit.md) with the per-domain matrix.
- **Key finding:** the #170 reversal is **not** a clean delete-WE-point-at-FUI — WE holds canonical fixes FUI is missing (`cloneHandlers` #454, `Injector` #400 graph + `declarativeInjector`, `CustomElementRegistry.ensureNativelyConstructible`), two domains are **WE-only** (webguards, webvalidation), and only `webbehaviors` has dual-mode test coverage.
- **Open questions registered:** the 6 unknowns blocking the reversal are tracked in scaffolded **[#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/)** (reconcile drift + dual-mode test backfill, `blockedBy #170`, `relatedReport` → the audit).
- Discovery-only (no runtime change). Gate: `check:standards` 0 errors. Commit → webeverything.
