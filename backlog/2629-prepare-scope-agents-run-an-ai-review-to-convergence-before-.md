---
bornAs: xakcnr6
kind: story
size: 3
parent: "2612"
status: resolved
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: []
---

# Prepare-scope agents run an AI review-to-convergence before any human review

Operator invariant: no PR reaches a human review gate without an automated AI-reviewer convergence pass first.

Builds already satisfy this — the delivery brief runs the adversarial review pre-PR. But prepare-scope PRs run NO AI review yet can still be human-routed (e.g. #690 was sampled and bounced with no prior AI pass).

Fix: either give prepare-scope agents their own AI review-to-convergence pass before they open the PR, or guarantee scope-only PRs are never routed to a human. Whichever path, the invariant holds: a human only ever sees a PR that an AI reviewer has already driven to convergence.
