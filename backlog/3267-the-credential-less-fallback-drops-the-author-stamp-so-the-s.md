---
bornAs: xq9wr4t
kind: story
size: 3
status: open
dateOpened: "2026-08-24"
tags: []
---

# The credential-less fallback drops the author stamp, so the self-clear refusal silently never fires

`we:scripts/pr-land.mjs#withAuthorStamp` appends the #2844 `authored-by-actor` marker to a PR body at open.
That marker is the **input** to the self-clear refusal: `we:scripts/lib/review-independence.mjs` compares the
clearer's `CLAUDE_CODE_SESSION_ID` against it and `we:scripts/review-set-label.mjs` refuses when they match.

On a host with no `gh` credential, `we:scripts/operations/open-pr.mjs` correctly halts at `submit` and hands back a plan for another
channel to execute (the documented fallback in the `/pr` skill). That channel creates the PR **without ever
running `pr-land`**, so no stamp is written. `parseAuthorActorId` then returns `''` — `unknown-author` — and
per `we:scripts/lib/review-independence.mjs`'s own header that status is **tolerated, not refused**.

Net effect: every PR opened through the fallback is exempt from the guard that stops an author clearing their
own review, silently and by omission. Nothing warns, nothing fails, and the refusal simply never fires.

The `/pr` skill already documents that the fallback drops the **park label** and instructs a second call to
re-apply it. The stamp is a second loss with no such remedy, and it was undocumented until now — the skill and
`we:docs/agent/vm-sessions.md` were updated ahead of this item to say so, but saying so is not fixing it.

Observed 2026-08-24: PR #1537 was opened this way, carries no `authored-by-actor` stamp, and its author's own
session could have cleared its `review:pending` park with no refusal.

**Do not fix this by having the fallback hand-write the marker.** A stamp asserting a session identity the
operation did not itself observe is worse than an absent one — it converts "the guard was not in play" into a
false claim that it was, which is the trust-chain failure `we:scripts/lib/review-independence.mjs`'s own
TRUST_CHAIN note is about.

## Done when

1. **Executable** — `we:scripts/operations/open-pr.mjs`'s `plan` step carries the author stamp into the body it hands the fallback (so
   the marker is produced by the operation, from the session that actually decided the PR), and a unit test
   pins that a plan whose `submit` is executed elsewhere still yields a stamped body.
2. **Executable** — a unit test pins the negative: a PR body with no stamp is refused by the clearer path
   rather than tolerated, OR — if `unknown-author` must stay tolerated for the pre-regime backlog — that an
   UNSTAMPED PR created after the regime date resolves to `STAMP_LOST` and is refused, using the
   `distinguishMissingAuthorStamp` / `prCreatedAt` inputs its header already describes as built-but-unwired.
3. **Executable** — `we:scripts/review-set-label.mjs` / `we:scripts/auto-land-seam.mjs` actually consult those inputs. The
   `we:scripts/lib/review-independence.mjs` header names this as the owed follow-up that was deliberately not
   folded in — wiring the two new inputs into the clearer path so a live clear actually consults them, rather
   than leaving them opt-in and unread. This is that follow-up.
4. **Observed** — on a credential-less host, a PR opened via the documented fallback carries a stamp, and an
   attempt to clear it from the authoring session is refused.

## Note

Related but distinct: #3265 (the lane-pool deadlock) and #3266 (the stop-hook false positive) are the other
two cloud-VM defects from the same session. This one is the only one of the three with a **safety**
consequence rather than an ergonomic one.
