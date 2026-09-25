---
bornAs: x0esjde
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/prune-landed-lanes.mjs", "we:scripts/__tests__/pr-merge-gate.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# A PR closed by the bot must always carry a reason comment

Live: chalbert/web-everything#2578 was closed by web-everything[bot] TWICE on 2026-09-24 with no comment on either close explaining why — 21:44:43Z (a stacked-base branch delete cascading GitHub's own auto-close, root-caused live and partly fixed by we:scripts/lib/pr-merge-gate.mjs's retargetStackedPrs, wired into we:scripts/merge-ai-prs.mjs around the merge-with---delete-branch step) and again at 23:09:55Z AFTER the PR had already been retargeted to main, so the same stacked-base mechanism cannot explain the second close — a second, still-unidentified path also closes PRs silently. Task: (1) find every code path in we:scripts/merge-ai-prs.mjs / we:scripts/lib/pr-merge-gate.mjs / we:scripts/prune-landed-lanes.mjs that can result in a PR closing (an explicit gh pr close, a --delete-branch cascade, or a GitHub auto-close on branch deletion) and (2) require every one of them to post an explanatory reason comment on the PR BEFORE (or atomically with) the action that closes it, the same discipline we:scripts/review-set-label.mjs already applies to label swaps. Reproduce the #2578 second-close live before fixing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
