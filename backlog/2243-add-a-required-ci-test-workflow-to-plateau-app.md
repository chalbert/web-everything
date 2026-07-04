---
kind: story
size: 3
parent: "2241"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Add a required CI test workflow to plateau-app

plateau-app has NO .github/workflows. Add a CI workflow with a job named 'test' running on pull_request to main: npm ci, vitest (test), check:render-conformance, and test:e2e (playwright). Mirror the shape of we:.github/workflows/ci.yml. This 'test' check is what the ported PR-merge transport requires before landing, so it blocks the plateau transport port.
