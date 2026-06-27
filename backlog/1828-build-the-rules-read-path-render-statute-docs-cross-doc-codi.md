---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:src/rules.njk — /rules/ read-path (rules-loader.cjs render + validate-rules-anchors.cjs codifiedIn anchor gate); Fork 2 governance narratives at /governance/<id>/"
tags: []
---

# Build the /rules/ read path — render statute docs + cross-doc codifiedIn anchor gate

Implements the ratified #1792 read-path. An Eleventy collection template renders the four codifiedIn-cited governance docs (we:docs/agent/platform-decisions.md, we:docs/agent/block-standard.md, we:docs/agent/backlog-workflow.md, we:docs/agent/vision-tiers.md) to a /rules/ route with heading AND inline anchors intact, plus a plain rendered index. A gate scans every codifiedIn: anchor across we:backlog/ against rendered output so all cites resolve (no 404) and drift is caught on every decision-resolve. Fork 2: governance narratives (we:DEV_GUIDE.md, we:SELF-DRIVEN-PROJECT-DRAFT.md, we:CLA.md) route per-file — narratives to /governance/, statute to /rules/. Adds a site-nav entry and a Vite dev-proxy allowlist entry.
