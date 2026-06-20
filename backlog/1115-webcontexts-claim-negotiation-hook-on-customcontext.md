---
kind: story
size: 3
parent: "1091"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webcontexts/CustomContext.ts"
tags: []
---

# webcontexts: claim() negotiation hook on CustomContext

Add a claim(query,context):boolean instance method to the CustomContext base (we:plugs/webcontexts/CustomContext.ts:63,235; default returns true) + define the query shape per spec we:src/_includes/project-webcontexts.njk:41-56; export the Query type via we:plugs/webcontexts/index.ts. Consumer-side primitive only (resolution order unchanged here). Demo: unit, a subclass overriding claim() declines non-matching queries.

## Progress

Added the `claim(query, context?): boolean` negotiation hook to the `CustomContext` base
(`we:plugs/webcontexts/CustomContext.ts`) + the `ContextQuery` type (`{ expression? }`), exported from
`we:plugs/webcontexts/index.ts`. The base **claims everything** (`return true`) — most-flexible-default,
so an un-overriding context resolves any query exactly as before (resolution order unchanged here;
consumer-side primitive only). A subclass narrows ownership by inspecting `query.expression`. Spec
`we:src/_includes/project-webcontexts.njk`. Unit test
`we:plugs/webcontexts/__tests__/CustomContext.claim.test.ts` (3 green): base claims all, a UserContext
declines non-`user.`/`currentUser.` queries, an AppStateContext fallback claims by key presence.
