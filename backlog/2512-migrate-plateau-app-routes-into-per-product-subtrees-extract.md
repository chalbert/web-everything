---
bornAs: xs1i22b
kind: story
size: 8
status: open
blockedBy: ["2510"]
dateOpened: "2026-07-15"
tags: []
---

# Migrate plateau-app routes into per-product subtrees (extraction-ready)

Follow-up to #2510 (thin product shell). Rename plateau-app's flat tool routes into per-product subtrees — /intent-configurator becomes /studio/intent-configurator, /explorer-runs becomes /explorer/runs, etc. — so each product owns a route subtree that can later move as a route-move not a rewrite (the extraction-ready property ratified in #2476, feeding #2446). Higher blast radius than the nav slice: ~22 source files reference the flat paths, plus the auth-shell e2e spec and every internal cross-link (route:link, navigate(), breadcrumb labels, PRODUCT_ROUTES, the route templates in plateau-app:index.html). Do it carefully with redirects from the old flat paths (avoid breaking bookmarks) and update the e2e/unit specs. Sidebar route:links + the openActiveSection sync in plateau-app:src/main.ts already exist from #2510; this changes the paths they point at.
