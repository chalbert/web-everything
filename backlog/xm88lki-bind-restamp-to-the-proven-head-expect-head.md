---
kind: task
parent: "3054"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-21"
relatedTo: ["3735", "2409"]
tags: [review, drain, acceptance, restamp, bug, design-first]
---

# Bind restamp to the proven head: --expect-head on review-set-label --to=restamp and in restampAcceptance

we:scripts/review-set-label.mjs --to=restamp stamps whatever head is live when the child runs, and restampAcceptance in we:scripts/merge-ai-prs.mjs names the head it means only inside the free-text --reason, so a push between the drain's probe and the stamp gets blessed unreviewed. Add a required --expect-head=<full sha> to --to=restamp that refuses on a missing flag or a moved head, and pass the proven sha from restampAcceptance. A real bug independent of the #3735 ruling.

**Design-first and deliberately not cleared for the conveyor.** Settle the design section below on this card
first; only then clear it (the `add` command of we:scripts/conveyor/queue.mjs).

## FOUND (2026-09-21)

- `runReviewLabelCli` re-reads `headRefOid` (we:scripts/review-set-label.mjs:709) and writes it as
  `reviewed-sha` (`buildReviewedShaMarker(headSha)`, `:1142`). No `--expect-head` flag exists in either file.
- `restampAcceptance({ pr, repo, newHead, … })` (we:scripts/merge-ai-prs.mjs:715) puts `newHead` only in the
  free-text `--reason`; nothing parses it.
- So if the drain pushes H1 and the author pushes H2 before the restamp child runs, H2 is stamped as reviewed.
  The window is seconds, but the result is an unreviewed tree honoured silently. This holds today, on the
  drain's own rebase re-stamp, with or without the #3735 carry.
- The ruling that makes the flag required is we:docs/agent/platform-decisions.md#merge-only-push-approval-carry
  rule 8. The carry build [xp3usow](/backlog/xp3usow-build-merge-only-approval-carry-per-3735/) depends on this.

## DESIGN TO SETTLE

1. **Full SHA only, or a prefix?** The gate accepts prefixes for `reviewed-sha`; the expected head should
   probably be a full 40-hex SHA, refused otherwise.
2. **Other `--to` values.** Whether `--expect-head` is also accepted (optional) on `--to=accepted` and
   `--to=clear-human`, or restamp-only for now.
3. **The drain's reaction to a refusal.** The drain should log it and let the next pass judge the new head;
   confirm it does not count as a failure that parks the PR.

## Done when

1. **Executable** — a test in the review-set-label suite asserts that `--to=restamp` with no `--expect-head`
   exits non-zero and writes no comment and moves no label, and that `--to=restamp --expect-head=H1` against a
   live head H2 refuses the same way (fails today: the flag does not exist and the restamp succeeds).
2. **Executable** — a test in the review-set-label suite asserts that a successful `--to=restamp
   --expect-head=H1` writes `reviewed-sha: H1`, even when the mocked live-head read returns H1 on the first
   call and a different head H2 on any later call: the marker is the `--expect-head` value, never a re-read of
   the live head (rule 8 of we:docs/agent/platform-decisions.md#merge-only-push-approval-carry).
3. **Executable** — a test in the merge-ai-prs suite asserts `restampAcceptance` passes
   `--expect-head=<newHead>` to the child.
4. **Executable** — `npm run check:standards` reports 0 errors.
