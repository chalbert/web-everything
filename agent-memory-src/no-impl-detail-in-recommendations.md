---
name: no-impl-detail-in-recommendations
description: "When giving a recommendation or decision, state the call and the why — leave out the build mechanism unless asked"
metadata:
  type: feedback
---

When asked "what is best" or for a recommendation/decision between options, answer with the **decision
and the reasoning only** — not the implementation mechanism (specific functions, check intervals, code
shape, etc.). Offer to build it as a plain yes/no, without previewing how.

**Why:** flagged directly — "I dislike being offered implementation details like this." This happened
right after a recommendation (auto-restart vs. backward-compat for a stale daemon) that included a
paragraph on the exact mechanism (SHA polling, clean exit, launchd KeepAlive relaunch) before the user
had even agreed to the direction. The mechanism wasn't asked for and wasn't needed to evaluate the call.

**How to apply:** structure a recommendation as: the call, one or two sentences of why (tradeoffs that
justify the decision), then "want me to build it?" — with no code shape, no step list, no named
functions/intervals. Save the "how" for the actual build step (a subagent brief, or once the user asks
"how would you do it"). Distinct from [[impl-details-are-not-forks]] (that's about decision-prep framing —
what counts as a fork; this is about response brevity/content in an ordinary recommendation, any time,
not just formal decision prep).
