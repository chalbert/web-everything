---
kind: task
status: open
relatedTo: ["2138", "2080"]
dateOpened: "2026-07-02"
tags: [pr-flow, ci, session-tooling]
---

# Run the CI gate on pull_request, not just push:main

The CI workflow (#2080) runs check:standards + the unit/interaction suites only on push to main. A PR-based landing flow (the #2138 merge-queue direction, the self-approved-PR substrate) needs that same gate to run as a PR status check so main can require it before merge. Add a pull_request trigger (against main) to the existing job in we:.github/workflows/ci.yml — no new pipeline, just the event — so every lane PR is gated on GitHub, not only after it lands. Safe today: a pull_request trigger does not block the current direct-push landing.
