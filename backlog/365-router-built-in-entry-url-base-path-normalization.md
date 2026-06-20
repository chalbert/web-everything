---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [router, spa, dx, exercise-app]
---

# Router: built-in entry-URL / base-path normalization

Give the Router block a built-in way to normalize the entry URL — a file path like `/demos/<id>we:/index.html` or a mounted base path — onto the route space, so consumers stop hand-rolling a `history.replaceState` shim before `route-view` connects. Surfaced by exercise app A (#317) adopting the active router: both the loan-origination app and the `declarative-spa-router` demo hand-write the same shim — friction that belongs in the block. Scope: a `base`/entry option on `route-view` (or `registerRouter`) mapping the load-time URL into the route space, plus a dev-server SPA-history-fallback note (a hard reload of `/application` currently 404s). Native-first (History API).
