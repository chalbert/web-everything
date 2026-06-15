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

## Note — promote the #636 dual-mode gate to ERROR after the backfill

The #636 conformance rule (`validatePlugDualMode` in [scripts/check-standards-rules.mjs](/scripts/check-standards-rules.mjs)) already errors on a plug missing a **plugged-mode** test, and **warns** on a missing **unplugged-mode** (non-invasive) test for the 9 not-yet-backfilled domains (webbehaviors is clean). Once this item backfills the unplugged-mode tests, flip `PLUG_UNPLUGGED_TEST_ENFORCED` to `true` so "missing either mode's tests" fully fails the gate — the warns become errors and the #606 "no plug may require plugged mode" invariant is fully automated.
