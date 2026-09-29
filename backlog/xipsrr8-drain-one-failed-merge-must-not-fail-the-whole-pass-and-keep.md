---
kind: story
size: 2
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Drain: one failed merge must not fail the whole pass, and keep the gh error text

Live 2026-09-28 9:08 PM ET: the drain pass considered #2879 and #2880; the merge of #2879 failed with only 'Command failed: gh pr merge 2879 ...' (no stderr kept), the pass exited 2, #2880 was never tried, and the daemon backed off 120s. MVP in we:scripts/merge-ai-prs.mjs: catch a per-PR merge failure, record its stderr in failedPrs[].detail, continue with the remaining PRs, and do not treat a single-PR failure as a pass failure for backoff. Must: test with two PRs where the first merge throws; live proof: a pass with one failing merge still lands the other.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
