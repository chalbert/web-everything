---
kind: story
size: 3
parent: "2241"
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Add a required CI test workflow to plateau-app

plateau-app has NO .github/workflows. Add a CI workflow with a job named 'test' running on pull_request to main: npm ci, vitest (test), check:render-conformance, and test:e2e (playwright). Mirror the shape of we:.github/workflows/ci.yml. This 'test' check is what the ported PR-merge transport requires before landing, so it blocks the plateau transport port.

## Pre-flight note (2026-07-07, deferred)

Skimmed while batching #2264's cluster — **NOT a pure mirror of `we:.github/workflows/ci.yml`, and it has an external-config prerequisite**: `plateau-app` consumes **both** siblings — `plateau:vitest.config.ts` aliases `@frontierui/*` → the frontierui sibling **and** `@webeverything/*`/`@we/*` → the webeverything sibling. So the CI `test` job needs a **3-repo sibling checkout** (plateau-app + webeverything + frontierui under `$GITHUB_WORKSPACE`), which means **GitHub read-token secrets for two private siblings** provisioned in the plateau-app repo (WE's own `we:.github/workflows/ci.yml` only needs `FUI_READ_TOKEN` for one). `test:e2e` (playwright) additionally needs a browser install and a served/built app. **Blocked until those secrets exist** — confirm/ask the user to add them before building; then extend that same workflow shape to the 3-repo layout. FUI's own CI (#2242, landed) is the closest precedent but is 2-repo.
