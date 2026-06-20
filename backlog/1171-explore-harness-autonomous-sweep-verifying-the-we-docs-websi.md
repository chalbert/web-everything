---
kind: story
size: 3
parent: "1167"
locus: frontierui
status: resolved
blockedBy: ["1168", "1169"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/docsSiteHarness.ts"
tags: []
---

# Explore harness — autonomous sweep verifying the WE docs website works-as-supposed

Consumer 2 of the autonomous UI tester (epic #1167, locus frontierui). Sweep the assembled WE docs site in EXPLORE mode (nav works, catalogs render, demos run, no broken/dead-end states) over the engine (#1168) + Layer-1 oracle bus (#1169). Because the dogfood goal (#777) renders the WE site's chrome FROM FUI components, this is the same engine pointed at components-in-assembly and doubles as the rendered-works proof epic #777 wants. Findings become backlog items; never blocks.

## Resolved (batch-2026-06-19) — site-sweep harness, live-smoked on the WE docs site `:8080`

The same engine + runner from #1170, pointed at components-IN-ASSEMBLY:

- **`fui:tools/explorer/docsSiteHarness.ts`** — `sweepSite(page, seedUrl, opts)` runs the explore+audit runner (#1170) in a SITE-sweep EXPLORE profile (`maxStates 60`/`maxDepth 15`, non-gating) over a caller-owned Playwright page, so it sweeps the already-running docs server (`:8080`) without spinning/killing one. Crawls real page-states across nav (link candidates navigate to new pages → new states), auditing each with the Layer-1 oracle bus; findings are advisory (never blocks). Layer-2 (a small site-expectation set — "this catalog lists ≥1 entry", "this demo goes green") stays deferred to the conformance slice (#899).

Test: `fui:tools/explorer/__tests__/docs-sweep.smoke.spec.ts` — a BOUNDED live Playwright smoke against the real WE docs site on `:8080` (reused, not spun) that crawls page-states, audits, and returns a well-formed graph + advisory findings; **passed in 9.4s**. Doubles as the #777 rendered-works proof (the WE chrome renders from FUI components). Full explorer unit suite green (22, no regression); `tsc --noEmit` clean; FUI `check:standards` green.
