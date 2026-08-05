---
bornAs: xvdn4un
kind: decision
status: open
dateOpened: "2026-08-05"
tags: []
---

# Amend #2563 — a machine park is the only available spelling of "wait for the panel" once the drain cannot spawn agents

Point 1 of the ratified blast-radius anchor says scored signals do not block the land on a review verdict, and that the review still happens via the loop. That assumes the panel runs inline in the land path. The #2391 lease means the drain daemon cannot spawn agents, which is why the converge daemon is a separate ticked process — so an inline panel is unavailable and a park is the only way left to say "wait for the panel". Amend the anchor to say so, rather than letting each successor reinterpret it. Surfaced by the 2026-08-04 red-team of #2572.

## The contradiction, stated plainly

[`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
point 1 (#2563, ratified 2026-07-18):

> Scored signals are advisory, not a gate. … they do **not** block the land on a review verdict. … the review
> still happens (via the loop), just not a human park.

Today every scored PR *does* block the land on a review verdict: `producerReviewLabel`
([`we:scripts/lib/review-escalation.mjs:307-311`](scripts/lib/review-escalation.mjs)) applies `review:pending`,
and `hasUnclearedReviewLabel` (`:564-569`) refuses the merge until a verdict label arrives. The shipped system
has contradicted the anchor's letter since the anchor landed.

## Why it cannot be fixed by wording

#2563's design reads as **inline**: point 3 says "high-blast auto-**lands** run a diverse panel," i.e. the panel
is a step inside the land path, not an external actor the PR waits on. Inline, "does not block on a verdict"
and "the review still happens" are both true at once.

That is structurally unavailable here. The drain daemon cannot spawn agents (#2391 lease) — which is precisely
why the converge daemon is a separate, scheduled process (#2572). A separate process cannot be an inline step;
the only way for the drain to wait on it is a label the drain refuses to merge past. So the park is not a
choice made in defiance of #2563 — it is what #2563's own requirement degrades to under a constraint the
anchor did not model.

## The failure mode this prevents

Two successive rulings on #2572 tried to reconcile a park with #2563 by re-reading its text — first by quoting
the config-tightening clause's definition of "gate" as if it were the rule, then by leaning on #2851's
human/machine axis to answer a park/no-park question. Both were struck. An anchor that the running system
contradicts invites exactly that: each successor re-litigates the wording instead of amending it, and the
reinterpretations get progressively more strained.

## The fork to rule

**Default:** amend point 1 to say that where the reviewing panel cannot run inline in the land path, a
**machine park** — a label an automated reviewer clears within a bounded time — is the sanctioned spelling of
"wait for the panel", and that the prohibition it is narrowing is on the *standing human* park, not on waiting
as such. Keep the human/machine distinction (#2851) and the gate-self/statute human floor untouched.

**Alternative:** hold the letter and make the drain wait on something that is not a label — e.g. the drain
consults the jury ledger directly before landing a scored PR. Rejected on first read because it is a park by
another name with a second source of truth, but it deserves an argued rejection in the amendment, not a
dismissal.

**Also settle:** whether "bounded time" is a stated SLO (the converge daemon's tick interval) or left
unspecified. Unbounded, a machine park is just a human park with no human.

## Handling

Statute-layer edit → `review:human`, its own PR, never bundled with impl. Preconditions: none — this is
independent of the enforce flip and can be ruled before or after #2572's scheduling fork.
