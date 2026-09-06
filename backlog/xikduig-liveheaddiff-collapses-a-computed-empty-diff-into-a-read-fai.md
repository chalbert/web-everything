---
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# liveHeadDiff collapses a computed-empty diff into a read failure

we:scripts/merge-ai-prs.mjs derives liveDiffReadFailed as liveDiffReadOwed AND NOT liveHeadDiff, which treats a genuinely empty computed diff (the empty string) as indistinguishable from a failed read (null). That is the precise null-versus-empty distinction the diffHunksFrom contract exists to preserve, and the line above it hand-rolls the ternary that contract forbids. A PR whose live head diff is legitimately empty is therefore recorded as a read failure, which changes the park reason and, for a re-hold that would revoke a clearance, the label write.

## Done when

1. **Executable** — a test where the live head diff is computed and legitimately empty asserts
   `liveDiffReadFailed === false`; a test where the read throws asserts `true`. Red before, green after.
2. The check distinguishes `null` from `''` rather than testing falsiness, per the `diffHunksFrom` contract.
