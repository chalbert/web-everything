---
kind: story
size: 3
parent: "2241"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Add a required CI test workflow to frontierui

frontierui has NO .github/workflows at all — its PRs merge on GitHub mergeability alone, no tests run. Add a CI workflow with a job named 'test' (so branch protection can require exactly that check, matching WE) that runs on pull_request to main: npm ci, build:tools, test:unit, check:standards, and test:e2e (playwright). Mirror the shape of we:.github/workflows/ci.yml (node 22, npm cache). This is the gate the ported drain/merge transport keys on (a PR is landable only when the 'test' check is SUCCESS), so it blocks the FUI transport port.
