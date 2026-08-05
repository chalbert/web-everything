---
name: record-verdict-before-launching-converge
description: When the operator asks for a fix/converge loop after a review, post the changes-request on the PR FIRST, then launch — the verdict is the durable record, and the loop both moves the head and races the review:pending filter
metadata:
  type: feedback
---

# Record the changes-request on the PR before launching fix/converge

When `/review` produces a `changes` verdict and the operator then asks for a fix/review
**convergence** loop, the order is: **record the verdict on the PR, then launch the loop.**
Never launch first and record after.

**Why (operator correction, 2026-08-05, PR #1049).** The verdict was presented in chat, the operator
asked for "a fix/review convergence in subagents", and the loop
(`we:scripts/workflows/review-parked-prs.mjs`) was launched with nothing posted. Three separate
failures:

1. **The verdict was the deliverable and it existed nowhere durable.** The findings lived only in
   chat and a scratchpad file. A review that is not on the PR did not happen, as far as any later
   reader — or the drain — is concerned.
2. **The loop moves the head.** Its editor subagent pushes revisions to the same PR branch, so the
   tree that was reviewed stops being the head. Posting afterwards stamps a `reviewed-sha` marker
   against a tree nobody reviewed, and `acceptanceCoversHead` (#2409) keys on head-SHA identity.
3. **The label flip races the running loop.** The loop reviews the `review:pending` class only.
   Recording `changes` mid-run flips the label out from under it and can make it drop the PR — so
   the late record silently kills the very loop it was meant to accompany.

**How to apply.** On a `changes` verdict, run
`node scripts/review-set-label.mjs <pr> --repo=<owner/name> --to=changes --actor="<operator>" --body-file=<findings.md>`
and confirm it returned `{"ok":true}`, *then* launch the convergence loop. Treat "the operator asked
for the fix loop" as approval to record the verdict too — the request presupposes the finding, so
posting it is not a separate decision to re-ask about.

Footgun: `--body-file` must resolve under the repo root or `os.tmpdir()`. The session scratchpad
under `/private/tmp/claude-501/…` is **rejected** (the guard exists because the body is published to
a public PR), so copy the findings file into `os.tmpdir()` first.

Related: [[review-parked-pr-diff-against-current-main]], [[land-on-no-regression-not-perfection]].
