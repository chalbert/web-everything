---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
codifiedIn: "scripts/lib/review-escalation.mjs (hasUnclearedReviewLabel), scripts/merge-ai-prs.mjs (#2366 concurrent-lander backstop)"
tags: [pr-flow, drain, review-gate, tooling]
---

# Merge step must refuse an un-cleared review:pending PR (concurrent-lander race)

A concurrent lander merged escalated review:pending PRs (plateau#11, web-everything#290) before the drain agent-review panel applied review:accepted, shipping 2 bugs the panel had caught (eval-harness win-gate keyed on the inflated majority-class agreement; a humanGate frontmatter field left un-removed) — each needed a follow-up fix PR (plateau#12, #292). The review-escalation park applies review:pending but does not block the merge when a second lander or a bare /merge sweep runs concurrently. Fix: the merge step must refuse a PR carrying review:pending without review:accepted (and/or enforce a single serial lander), so an escalated PR cannot land before its review clears. Relates #2171/#2285 review-escalation and #2362.
