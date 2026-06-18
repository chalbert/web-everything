---
type: issue
workItem: task
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-06'
tags:
  - build
  - eleventy
  - adapters
  - dev-server
relatedProject: webadapters
crossRef: { url: /adapters/declarative-component/, label: Adapters catalog }
---

# Adapter pages 404 on the live dev server until restart (require-cache in we:.eleventy.js)

New entries in `we:src/_data/adapters.json` do not appear on the running dev server (`:3000`) until it is restarted — the route 404s even though a clean `npx @11ty/eleventy` build and the canonical `:8080` server render it correctly. Surfaced while adding the `declarative-component` adapter.

**Root cause.** The `flatAdapters` collection in `we:.eleventy.js` reads the data with `require("we:./src/_data/adapters.json")` *inside* the `addCollection` callback. Node module-caches `require`, so the long-running watch process never re-reads the file on change. By contrast `blocks`, `projects`, `intents`, and `backlog` flow through 11ty's data cascade, which auto-reloads — which is why new pages there appear live without a restart.

**Fix.** Read the file fresh in the collection (`JSON.parse(readFileSync(...))`) or let it ride the data cascade like the other registries, so adapter additions hot-reload like everything else. Low-risk, build-only change.

**Resolved 2026-06-06.** `we:.eleventy.js` now reads `we:adapters.json` via `JSON.parse(fs.readFileSync(...))`
in the `flatAdapters` collection (no module-cached `require`), plus an explicit
`addWatchTarget("we:src/_data/adapters.json")` so the change triggers a rebuild. Verified on a standalone
`eleventy --watch`: injecting a new adapter regenerated its `/adapters/<id>/` page live, no restart
(the prior `require`-cached build never saw the new entry at all).
