---
bornAs: xy8e7h0
kind: task
relatedTo: ["2285"]
status: open
dateOpened: "2026-07-12"
tags: []
---

# Review mandates for couple PRs should carry the sibling repo/ref from the lane manifest

A fresh-context diff-only reviewer judging ONE half of a cross-repo couple false-positives on symbols the sibling PR adds: re-reviewing plateau#19 (impl half of the #2449 couple), the round-2 reviewer's only finding was that --under-lease does not exist in we:scripts/merge-ai-prs.mjs — it verified against WE main, where the couple's WE half (PR #441) had not landed. buildMandate()/buildPanelMandate() in we:scripts/lib/review-core.mjs take no couple context, yet the lane manifest already carries the couple's repos/refs. Fix: thread the manifest's sibling repo/ref list into the mandate text so reviewers judge cross-repo symbols against the couple, not each repo's main. Observed 2026-07-12 (dismissed-with-reason on plateau#19).
