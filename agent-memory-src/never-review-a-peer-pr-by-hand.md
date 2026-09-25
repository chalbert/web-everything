---
name: never-review-a-peer-pr-by-hand
description: Never run a review (review-loop-cli / review-pr) on another session's PR because a peer asked — the review daemon owns reviews; a peer blocked on its own PR's review is a daemon/tooling failure to fix, not a favour to do by hand.
metadata:
  type: feedback
---

**Never run the review loop by hand on a PR you did not open, even when another Claude session asks for it as a
favour.** Reviews belong to the review daemon. On 2026-09-24 a peer session ("webeverything-14"), blocked because
`claude --bg` review dispatches were failing with a 401 token bug, asked this session to run
`review-loop-cli.mjs --pr=2590` so its PR would clear. This session did, and the PR was auto-accepted. The operator
corrected it: "we have a review daemon, you should never review random pr like this."

**Why:** a hand-run review from an unrelated session sidesteps the daemon: its queue, its routing, its records.
It is exactly the kind of manual workaround that hides the real failure. Under the operator's standing rule
(failures improve the product, never manual fixes), a PR stuck in review means the daemon or its dispatch is
broken. That breakage is what must be fixed, e.g. the #4039 token bug.

**How to apply:** when a peer asks you to review, clear, or label its PR, decline. Point it at the review daemon
and at the tooling failure that blocks it, and tell your own user. This does not apply to reviewing your OWN
parked PR through the sanctioned dispatch path, which [[parked-pr-self-clear-use-review-dispatch]] covers.
