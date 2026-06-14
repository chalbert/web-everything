---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Graduate webadapters/webintents/webblocks/webvalidation projects from concept status

Current-state drift surfaced by the #607 audit (D3). Four projects.json entries are still status:'concept' despite substantial resolved work: webadapters (39 resolved, adapters.json/10 adapters), webintents (23 resolved, 50-entry intents.json + /intents/), webblocks (43 resolved, 63-entry blocks.json + /blocks/), webvalidation (12 resolved, plugs/webvalidation runtime). The status no longer reflects reality and skews readiness/health signals. Advance each to what its shipped surface warrants (poc/draft per the project lifecycle). Note: webplugs stays 'concept' intentionally (ownership pending #606); webdocs is partial (#398 product epic unbuilt); webcases is too thin (3 items, no surface). Data fix only.

## Progress

Resolved 2026-06-14. Updated the four `src/_data/projects.json` `status` fields off `concept`, each set to what its shipped surface warrants on the project lifecycle (concept → poc → draft):

- **webblocks → draft** — 43 resolved, 63-entry `blocks.json` + live `/blocks/` index.
- **webintents → draft** — 23 resolved, 50-entry `intents.json` + live `/intents/` index.
- **webadapters → draft** — 39 resolved, `adapters.json`/10 adapters + live `/adapters/` index.
- **webvalidation → poc** — 12 resolved with a shipped `plugs/webvalidation` runtime, but a smaller item count and no large public catalog page, so one stage below the catalog-heavy three.

The three catalog-heavy standards (the most-shipped surfaces in the constellation) match the lone prior `draft` (webanalytics); webvalidation joins the `poc` tier. `check:standards` green; project status is not enum-gated, so no validator change needed. webplugs/webdocs/webcases left as-is per the noted exclusions.
