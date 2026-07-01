---
kind: story
size: 5
parent: "1522"
locus: plateau-app
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: "plateau-app:tools/explorer/routeDiscovery.ts — third discovery source crawlRouterPaths clicks href-less ROUTER_CANDIDATE_SELECTOR (role=link/menuitem/tab/treeitem) affordances and records History-API path changes; DiscoveryResult.fromRouterNav; CLI --discover reports the per-source split"
tags: []
---

# Explorer: href-less route discovery (nav-event / history crawl)

Reopened gap: #1550 discovers only sitemap + a[href], and the CLI punts JS-routed apps to a hand-authored recipe. Generalize discovery to router-driven navigation (nav events / history) so href-less routes are reached without a bespoke harness.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — reopened gap: #1550 discovers only sitemap + a[href] and the CLI punts JS-routed apps to a hand-authored recipe. Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
