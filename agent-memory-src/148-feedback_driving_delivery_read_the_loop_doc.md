---
name: driving-delivery-read-the-loop-doc
description: Before driving items card→merged (esp. spawning independent review), read docs/agent/delivery-loop.md
metadata:
  type: feedback
---

When the task is **driving delivery** — taking backlog items from card to merged, not answering a
question — read `docs/agent/delivery-loop.md` FIRST, before touching a lane.

**Why:** the loop is `claim → lane → build → mutate → gate → PR → spawn an INDEPENDENT reviewer →
verdict → fix → re-spawn → merged`, and two of those steps are neither mechanical nor documented
anywhere else. **Spawning independent review** is the one that cannot be guessed: a subagent inherits
the parent's `CLAUDE_CODE_SESSION_ID`, so the independence check sees the author clearing their own PR
and refuses the label. Only a headless `claude -p --session-id <derived>` in its OWN lane, prompt on
stdin, is a distinct actor. That was worked out by trial over a long session and lived only in that
session's head until it was written down.

**How to apply:** read the doc, then work the open PRs and cards. The doc also carries what makes a
mandate find things (naming the author's recurring defect is the highest-yield line), running the
reviewer's own mutation before believing a fix, the vacuous-test shapes, and when to stand down
instead of iterating a fourth time.

Related: [[edit-work-runs-in-a-lane-clone]], [[backlog-is-the-tracker]].
