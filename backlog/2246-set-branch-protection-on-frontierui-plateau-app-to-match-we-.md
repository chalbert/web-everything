---
kind: story
size: 2
parent: "2241"
status: open
blockedBy: ["2242", "2243"]
dateOpened: "2026-07-04"
tags: []
---

# Set branch protection on frontierui & plateau-app to match WE's self-approved transport

WE's transport lands via a NON-admin gh pr merge that relies on branch protection: 0 required reviewers + the required 'test' check. FUI and plateau currently have neither a required check nor a defined protection posture (11 FUI PRs merged 2026-07-03 on bare mergeability). Configure both repos' main branch: require the 'test' status check, 0 required approving reviews, no force-push — so the ported /drain self-approval works identically to WE and nothing lands red. Blocked by each repo's CI test check existing first.
