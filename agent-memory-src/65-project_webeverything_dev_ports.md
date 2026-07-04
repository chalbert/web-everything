---
name: project_webeverything_dev_ports
description: "webeverything `npm start` runs TWO servers — Eleventy docs on :8080, Vite demo on :3000; rendered pages like /backlog/ live on :8080"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbdb3f6b-decb-4704-8e5f-1190dc46dea2
---

webeverything's `npm start` is a `concurrently` pair (names DOCS, DEMO):
- **DOCS = Eleventy** `--serve --port=8080` — renders the `.njk` site, including `/backlog/` (the Prioritisation page). Verify rendered-page changes here.
- **DEMO = Vite** `--port=3000` — the demo / spec-explorer server, NOT the docs pages.

So curling `localhost:3000/backlog/` returns a stale/unrelated copy; the live `.njk` render is on `:8080`. (frontierui mirrors this: eleventy :8082, vite :3001.)

Eleventy's watcher can lag/stall — if `_site/backlog/index.html` mtime is older than the edited `.njk`, it hasn't rebuilt. Don't restart the user's server ([[feedback_dont_kill_dev_server]]); validate by building to a throwaway dir (`npx @11ty/eleventy --output=/tmp/... --quiet`) and grepping that.
