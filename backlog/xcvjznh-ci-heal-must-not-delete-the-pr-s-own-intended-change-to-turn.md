---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/ci-heal-pr-dispatch.mjs", "we:skills-src/conveyor/"]
dateOpened: "2026-09-30"
tags: []
---

# CI-heal must not delete the PR's own intended change to turn CI green

Live 2026-09-30: PR #3103 (cut GitHub App GraphQL spend) routed the drain's gh calls through the throttle. Its drain soak tick then timed out at 90s, and the CI-heal session fixed the red check by removing the throttled transport from we:scripts/merge-ai-prs.mjs (commit 3dabd061b, "drop throttled execFileSync"). CI went green, review accepted, the PR merged — and the drain stayed unmetered, so the bucket kept running out (see we:reports/2026-09-30-unmetered-app-graphql-spend.md). Root cause: nothing stops a heal from reverting part of what the card promised; the heal brief optimises for green, and review judged the final diff, not the heal against the card. Fix: (1) the ci-heal brief forbids removing or disabling the card's promised change; a heal that cannot fix the cause escalates (review:human with the reason) instead; (2) a mechanical check flags a heal commit that deletes lines the PR itself added under the card's scope, and routes it to review with that flag; (3) review of a healed PR re-checks the card's Done-when against the final diff. Proof: replay the #3103 heal and show it is flagged/escalated rather than landed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
