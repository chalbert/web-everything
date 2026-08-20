---
kind: story
size: 3
status: open
dateOpened: "2026-08-20"
tags: []
---

# verify-lane refuses to re-verify after an ordinary second commit in the same lane

The start-side guard that stops an overlapping run from clobbering a sibling terminal marker cannot tell a sibling apart from the same lane one commit later. Commit, verify green, commit again, verify: it emits superseded and exits 3 without writing a marker, so pr-land then refuses the lane as unverified. There is no flag and no documented way forward, and the only route is deleting the marker file by hand, which nothing tells you. Every lane that commits twice hits this.



## Exactly what happens

Reproduced twice in one session, on an ordinary lane:

1. commit → `node we:scripts/verify-lane.mjs --repo=<lane>` → marker `green` for sha A;
2. commit again (a review fix) → re-run the same command → **exit 3**, no marker written:

> refusing to START verification for 699d9271: the on-disk marker holds a terminal green record for
> 17dbc20f (an overlapping verify-lane run) — overwriting it with a running marker would destroy that
> result; no marker written for this run.

`we:scripts/pr-land.mjs` then refuses the lane, correctly, because HEAD has no marker. So the lane is
stuck: the gate will not run, and the land will not proceed without it having run.

## The guard is right; its discrimination is not

The #2833 finding-4 guard exists so two OVERLAPPING runs sharing one clone's marker cannot destroy each
other's recorded result, and that is a real hazard worth guarding. But it identifies a sibling purely by
*"terminal record, different sha"*, and that describes the same lane one commit later just as well as it
describes a concurrent run. The common case is therefore treated as the dangerous one.

There is **no flag** — no `--force`, no `--supersede` — and the message names no way forward. The only
route is deleting `.git/.lane-verify` by hand, which nothing documents. An agent that does not think to
try that is simply blocked; one that does is performing an undocumented manual step on gate state, which
is worse than a sanctioned flag.

Deleting the marker is at least SAFE in the honest direction: an absent marker makes HEAD look
*unverified*, never verified, so nothing can land on the strength of a result that was not produced.

## What would distinguish them

A terminal marker for a sha that is an ANCESTOR of current HEAD is this lane's own history, not a
sibling's in-flight work. A concurrent run's sha is typically not an ancestor. That test is cheap
(`git merge-base --is-ancestor`) and is available in the same checkout the marker lives in — but whether
it is the right discriminator, or whether the run should be identified explicitly (a pid/session stamp in
the marker, which would settle it without inference), is the fork this needs.

## Done when

Re-verifying a lane after a second commit succeeds without a hand-deleted marker, while two genuinely
overlapping runs still cannot destroy each other's terminal record. A test drives both: sequential
commits in one lane (must proceed) and a foreign in-flight sha (must still refuse).
