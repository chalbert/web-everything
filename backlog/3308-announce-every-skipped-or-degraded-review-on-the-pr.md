---
bornAs: x5pen0r
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/merge-ai-prs.mjs
tags: []
---

# Announce every skipped or degraded review on the PR

22.5% of merged PRs carry no recorded verdict. That is a ruling (#2631), not an omission — but nothing says so on the PR, and a silent absence reads as a clean bill of health. merge-ai-prs already carries a per-PR skip reason; post it, along with juror timeouts and any partial review, in the "Incomplete review — these files were not examined" shape.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
