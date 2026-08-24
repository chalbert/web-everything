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

On a host with no `gh` credential, `we:scripts/operations/open-pr.mjs` correctly halts at `submit` and hands
back a plan for another channel to execute (the documented fallback in the `/pr` skill). That channel creates
the PR **without ever running `pr-land`**, so no stamp is written.

**The guard itself is armed** — this item's first draft said otherwise and was wrong. Since #3067
(`3a98c0a6`, merged 2026-08-21) `we:scripts/review-set-label.mjs` passes `prCreatedAt` / `stampLostMarked`
into `decideClearerIndependence`, so a stampless PR created after the 2026-08-08 regime start resolves to
`STAMP_LOST` and is REFUSED, not tolerated as `UNKNOWN_AUTHOR`.

The real defect is one level up: **on this host the label swap never reaches that home at all.** `record`'s
`review.label-swap` calls `we:scripts/review-set-label.mjs` — the single home (#2644) carrying the
independence check, the `reviewed-sha` / `reviewed-diff` / `reviewed-contribution` markers and the #2964
write ordering — and that call needs `gh`. Applying the label through a connector instead does not weaken one
guard; it steps around every guard in that home at once. The `STAMP_LOST` refusal that would have fired never
gets the chance to.

The `/pr` skill already documents that the fallback drops the **park label** and instructs a second call to
re-apply it. The stamp is a second loss with no such remedy, and it was undocumented until now — the skill and
`we:docs/agent/vm-sessions.md` were updated ahead of this item to say so, but saying so is not fixing it.

Observed 2026-08-24: PR #1537 was opened this way, carries no `authored-by-actor` stamp, and its
`review:pending` park was cleared by applying the label through the connector — so
`we:scripts/review-set-label.mjs`,
and with it the `STAMP_LOST` refusal that would have blocked it, never ran.

**Do not fix this by having the fallback hand-write the marker.** A stamp asserting a session identity the
operation did not itself observe is worse than an absent one — it converts "the guard was not in play" into a
false claim that it was, which is the trust-chain failure `we:scripts/lib/review-independence.mjs`'s own
TRUST_CHAIN note is about.

## Done when

1. **Executable** — `we:scripts/operations/open-pr.mjs`'s `plan` step carries the author stamp into the body it hands the fallback (so
   the marker is produced by the operation, from the session that actually decided the PR), and a unit test
   pins that a plan whose `submit` is executed elsewhere still yields a stamped body.
2. **Executable** — a test pins that a label swap performed OUTSIDE
   `we:scripts/review-set-label.mjs` is detectable after the fact: the home writes the `reviewed-sha` /
   `reviewed-diff` / `reviewed-contribution` markers, so their ABSENCE on a cleared PR is the signal that no
   guard ran. A clear with no markers must not read as a guarded one.
3. **Decision** — what the fallback should do when it cannot reach the home. Options: refuse the swap outright
   (the PR stays parked until a credentialed host clears it); or allow it and require a machine-readable
   "unguarded clear" marker on the PR so the drain can re-score before merging. Not obvious — rule it, do not
   assume.
4. **Observed** — on a credential-less host, either the swap goes through the home, or the resulting PR is
   visibly marked as cleared without one.

## Note

Related but distinct: #3265 (the lane-pool deadlock) and #3266 (the stop-hook false positive) are the other
two cloud-VM defects from the same session. This one is the only one of the three with a **safety**
consequence rather than an ergonomic one.
