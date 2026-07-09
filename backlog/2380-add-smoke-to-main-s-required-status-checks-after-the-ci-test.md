---
kind: task
status: open
dateOpened: "2026-07-09"
relatedTo: ["2152", "2220", "2070"]
tags: [ci, branch-protection, pr-flow]
---

# Add smoke to main's required status checks after the CI test/smoke split lands

The CI split (PR #332) fanned the single test job into test + smoke, moving the deploy-smoke (build:docs, #2220) and the Playwright interaction lane (#2070) into a new smoke job. Main's branch protection (set by #2152) still requires only the test context, so until smoke is added those two checks stop gating merges — a broken docs build or interaction regression could merge green (the #2184 failure mode #2220 closed). One-time repo-admin action once #332 merges: gh api PUT .../branches/main/protection with required_status_checks.contexts = [test, smoke].
