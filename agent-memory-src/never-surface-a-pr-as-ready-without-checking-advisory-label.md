---
name: never-surface-a-pr-as-ready-without-checking-advisory-label
description: Before telling the user a PR is ready for their review, check the actual review:awaiting-advisory label state — don't infer readiness from a PR's category (e.g. "stood-down, needs a human") without confirming the advisory panel has actually posted.
metadata:
  type: feedback
---

The user has a standing rule: they will not review any PR until its automated advisory
pass has actually posted (tracked via the `review:awaiting-advisory` label, built
2026-09-13 — the label is present until the advisory comment posts, then clears
automatically). That rule means the orchestrating session must never present a PR to
the user as "ready for your review" or "needs you" without first checking that label's
actual current state — not inferring it from the PR's category or blocking reason.

**Why:** the orchestrating session relayed a driver run's final report listing several
PRs as "needs you to answer a question" (a `stood-down` category, meaning a fix agent
already asked the human something) without checking whether those PRs had actually had
their advisory panel run yet. The user corrected this directly: "you should not have
pointed me to the PR without advisory" — and separately asked for clearer tagging so
the label alone can be trusted to show what's actually ready, without the orchestrating
session's own summary getting ahead of that signal.

**How to apply:**
- Before listing any PR as ready for the user's attention (in a status update, a `/wip`
  report, or any other summary), check its actual current label state
  (`gh pr view <n> --json labels`, or however the reporting agent already has this data)
  — specifically whether `review:awaiting-advisory` is still present.
- A PR being in a category that implies human involvement (stood-down, needs-human,
  review:changes) is NOT the same fact as "the advisory panel has posted for it." Both
  conditions must hold before presenting it as ready.
- If advisory hasn't posted yet, either trigger it (if that's in scope for the current
  task) or say plainly "still waiting on advisory" rather than including it in a ready
  list.
- This is a general reporting discipline, not a one-off fix for a single run — apply it
  to every future status/backlog summary involving PRs.
