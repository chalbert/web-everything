---
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/lib/main-staleness.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Review dispatch: refuse on a stale clone only when the missed commits touch the review code path

we:scripts/lib/main-staleness.mjs's guard, called from we:scripts/operations/review-dispatch.mjs (#3439), refuses a review dispatch when the dispatching clone is even 1 commit behind origin/main. The drain lands about one PR a minute and a daemon rebuild takes minutes (longer when its smoke check hits the GitHub rate limit), so the review daemon spends long stretches refusing: live 2026-09-28 the review-daemon log recorded 970 stale refusals before the 9:32 PM ET restart, and the clone sat 4-18 commits behind. MVP: compute the files changed in HEAD..origin/main and refuse only when one is on the review code path (the review operation and its imports: we:scripts/operations/review-pr.mjs, we:scripts/operations/review-dispatch.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/lib/ judge/jury/review modules — derive the set from the import graph or a declared list); otherwise dispatch and log the tolerated lag. Must: unit test for both branches; live proof: with the clone behind by commits that do not touch the review path, a review dispatches (before: refused). Follow-up: same rule for the fix and verify dispatchers.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
