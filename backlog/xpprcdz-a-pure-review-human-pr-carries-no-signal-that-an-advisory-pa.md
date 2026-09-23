---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# a pure review:human PR carries no signal that an advisory pass ran vs nobody has looked

Live-caught 2026-09-23: a PR that is review:human from the START (a gate-self/statute edit, humanRequired via we:scripts/lib/review-escalation.mjs) gets parked by the drain with only a static comment and the bare review:human label -- confirmed by direct read of PR #2486 and #2492's own comment threads on GitHub, both showing zero advisory-panel comments and no review-status label. The automated advisory-panel comment (we:scripts/operations/review-pr.mjs's advise step, counted by countAdvisoryComments in we:scripts/conveyor/reconcile-core.mjs) only posts for a PR that started as review:pending and bounced through normal rounds before escalating to review:human -- we:scripts/conveyor/reconcile-core.mjs's own dispatch logic never runs a review or fix agent against a PR that is review:human from the start, so a freshly-opened gate-self PR never gets an advisory pass at all. Result: a human looking at the open PR list cannot tell 'freshly parked, nobody has looked' apart from 'an advisory pass already ran and found nothing new' -- both look identical (bare review:human, one static drain comment). Fix direction: either (a) run the SAME advise step against a review:human PR too (agent-reviewable advisory feedback, never auto-clearing the human gate) so the round-count/status machinery already built for review:pending PRs covers this population too, or (b) apply a distinct review-status label (e.g. review-status:advisory-posted) once an advisory pass has run, so the two states are visually distinguishable in the PR list without requiring an agent to run anything new.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
