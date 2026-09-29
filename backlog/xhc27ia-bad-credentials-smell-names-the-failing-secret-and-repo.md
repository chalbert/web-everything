---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/health-smells/", "we:scripts/conveyor/github-app-status.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# bad-credentials smell names the failing secret and repo

2026-09-29 ~5:20 PM ET: web-everything CI started failing on every PR at the Checkout FUI (sibling) step with Bad credentials (the repo secret FUI_READ_TOKEN in chalbert/web-everything, last set 2026-07-02, had expired; plateau-app had been rotated the day before). The health smell bad-credentials::github-auth (we:scripts/conveyor/health-smells/) opened, but its alert did not say which secret in which repo, so the operator first rotated the wrong thing and the orchestrator needed several steps (fix-dispatch-daemon ci-heal escalation note on #2999, gh secret list dates) to trace it. MVP: when the 401 comes from a CI run, the smell (or ci-heal escalation) names the failing step, the secret it reads (from the workflow file), the repo, and the secret last-updated date from `gh secret list` (names/dates only, never values), plus the one command to rotate it. Test: fixture CI log with the checkout failure → alert names FUI_READ_TOKEN + chalbert/web-everything. Proof: replay the 2026-09-29 run 36632379377 log.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
