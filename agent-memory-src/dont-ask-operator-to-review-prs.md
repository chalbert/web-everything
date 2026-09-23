---
name: dont-ask-operator-to-review-prs
description: Never put "review PR #N" in the operator's to-do tail; PR review is the review daemon's job — report PRs as waiting on it
metadata:
  type: feedback
---

Do not ask the operator to review PRs or list "Review PR #N" as an action item. Report an opened PR as "waiting on the review daemon" and move on.

**Why:** 2026-09-22 — the operator said "for review, we just have to wait until the daemon finishes, I'd like to stop asking me to review." Review is mechanized (the review daemon auto-clears `review:pending`).

**How to apply:** Default agent PRs to the normal park (`review:pending`) so the daemon handles them. The one exception is a `review:human` park, which the daemon can never clear. If one exists, say once, as a fact, that it is blocked until a human clears it. Don't turn it into a recurring to-do. Related: [[single-session-should-use-a-lane]].
