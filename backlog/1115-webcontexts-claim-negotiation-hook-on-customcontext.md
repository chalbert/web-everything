---
type: idea
workItem: story
size: 3
parent: "1091"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webcontexts: claim() negotiation hook on CustomContext

Add a claim(query,context):boolean instance method to the CustomContext base (we:plugs/webcontexts/CustomContext.ts:63,235; default returns true) + define the query shape per spec we:src/_includes/project-webcontexts.njk:41-56; export the Query type via we:plugs/webcontexts/index.ts. Consumer-side primitive only (resolution order unchanged here). Demo: unit, a subclass overriding claim() declines non-matching queries.
