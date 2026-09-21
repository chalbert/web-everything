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

1. **Full SHA only — settled by rule 8's own wording ("`--expect-head=<full sha>`").** The value must be a
   full 40-hex SHA. A prefix, or any non-40-hex value, is refused exactly like a missing flag (non-zero exit,
   no comment, no label move). The gate still accepts prefixes when it *reads* `reviewed-sha`; the restamp
   never *writes* one.
2. **Other `--to` values.** Whether `--expect-head` is also accepted (optional) on `--to=accepted` and
   `--to=clear-human`, or restamp-only for now.
3. **The drain's reaction to a refusal.** The drain should log it and let the next pass judge the new head;
   confirm it does not count as a failure that parks the PR.
4. **Every marker comes from the expected head, not only `reviewed-sha`.** A restamp writes these markers
   (`buildComment`, we:scripts/review-set-label.mjs:1141-1146): `reviewed-sha` (today the live `headRefOid`,
   `:709`), `reviewed-diff` and `reviewed-contribution` (both from `computeNetDiffText` with
   `rev: headRefName`, `:862-867` — a live fetch of the branch taken *after* the head compare), and
   `clearer-actor` (from `clearerId`, not head-derived). `cleared-human` is written on `clear-human` only.
   **Required:** each head-derived marker derives from the `--expect-head` commit. Either compute the digests
   with `rev=<expect-head sha>`, or refuse when the fetched branch tip differs from `--expect-head`. Open
   here: which of the two.

## Done when

1. **Executable** — a test in the review-set-label suite asserts that `--to=restamp` with no `--expect-head`
   exits non-zero and writes no comment and moves no label, and that `--to=restamp --expect-head=H1` against a
   live head H2 refuses the same way (fails today: the flag does not exist and the restamp succeeds).
2. **Executable** — a test in the review-set-label suite asserts that a successful `--to=restamp
   --expect-head=H1` writes `reviewed-sha: H1`, even when the mocked live-head read returns H1 on the first
   call and a different head H2 on any later call: the marker is the `--expect-head` value, never a re-read of
   the live head (rule 8 of we:docs/agent/platform-decisions.md#merge-only-push-approval-carry).
3. **Executable** — a test in the review-set-label suite runs `--to=restamp --expect-head=H1` where the live
   head read returns H1 but the branch fetch behind the net-diff read returns H2 (the head moves between the
   compare and the diff read). It asserts either a refusal (non-zero exit, no comment, no label move), or that
   `reviewed-sha`, `reviewed-diff` and `reviewed-contribution` all equal H1's values. Fails if any marker
   carries H2's digest (rule 8, "every marker it writes").
4. **Executable** — a test in the review-set-label suite asserts that `--to=restamp` with an `--expect-head`
   that is a 7-char prefix of the live head, a 39-char value, or a 40-char non-hex value each exits non-zero,
   writes no comment and moves no label (rule 8, "full sha").
5. **Executable** — a test in the merge-ai-prs suite asserts `restampAcceptance` passes
   `--expect-head=<newHead>` to the child, where `newHead` is the commit the drain's rebase pushed (rule 8,
   "the drain's own rebase passes the commit it pushed").
6. **Executable** — `npm run check:standards` reports 0 errors.
