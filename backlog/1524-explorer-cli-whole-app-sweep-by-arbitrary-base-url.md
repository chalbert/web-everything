---
kind: story
size: 5
parent: "1522"
locus: frontierui
status: open
dateOpened: "2026-06-22"
tags: []
---

# Explorer CLI: whole-app sweep by arbitrary base URL

Generalize the nav-aware sweepSite beyond the WE/FUI docs site to crawl an arbitrary app by base URL (incl. configurable probe bases / :4000), discovering and visiting all reachable routes — not just one seed's in-place states.

## Where / prototype

`fui:tools/explorer/cli.ts` hardcodes probe bases to `:3001/:8082/:8080` (an absolute URL works verbatim, but there's no auto-discovery for another app), and `fui:tools/explorer/docsSiteHarness.ts` `sweepSite` is tuned to the docs-site nav shape. The plateau prototype enumerated the route set explicitly; productize a base-URL sweep that discovers routes (sitemap / nav crawl) and visits each. Pairs with #1523 — most routes worth sweeping on a real app are behind auth.
