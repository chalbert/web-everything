---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["170"]
dateOpened: "2026-06-14"
relatedReport: reports/2026-06-14-plugs-runtime-audit.md
tags: [plugs, drift, testing, constellation]
---

# Reconcile plugs WE/FUI drift + dual-mode test backfill ahead of the #170 reversal

The #635 audit ([report](../reports/2026-06-14-plugs-runtime-audit.md)) found the #170 reversal (FUI → canonical `@frontierui/plugs`) is **not** a clean delete-WE-point-at-FUI: WE holds several **canonical fixes FUI is missing** — `webcomponents/cloneHandlers` (#454 select/datalist clone), `webinjectors/Injector` (#400 consumption-edge graph + WE-only `declarativeInjector`), `webregistries/CustomElementRegistry` (`ensureNativelyConstructible`) — plus two **WE-only domains** (webguards, webvalidation) with no FUI home, and only `webbehaviors` has dual-mode (unplugged+plugged) test coverage. This item does the reconciliation the reversal needs: port the WE-ahead fixes into FUI, decide the WE-only domains' home, and backfill dual-mode tests for the 3 highest-impact domains. Resolves the 6 open questions the audit registered. Gated on #170.
