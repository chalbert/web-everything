---
bornAs: xlxr0lv
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lane-pool.mjs
tags: []
---

# The lane lease is advisory, so one non-participating consumer disables it for everyone

guard-lane protects a lane only when its occupant was DECLARED via adopt. A consumer that pins lanes by hand without leasing is invisible to the pool, so acquire hands its lane to another session and the contested-lease guard cannot fire.

## Observed

Two sessions worked in **lane-7 at the same time**, in both directions:

- A dispatched agent ran `lane-pool acquire`, was given lane-7, found an untracked `backlog/3350-*.md`
  already sitting there, and ran `git reset --hard origin/main` as its first act.
- Mid-task, that agent's own commit was reset out from under it onto unrelated PR #1600 work.

**No work was lost** — both sides had committed; `origin/lane/file-queue-latency` at `80456358` carries the
#1600 corrections intact. That is luck, not design. A `git reset --hard` at acquire time is the standard opening
move for a lane, and it destroys any uncommitted work the previous occupant left.

## Why the guard did not fire — and it is not a guard bug

`we:scripts/guard-lane.mjs` states the limit in its own header:

> A lane whose occupant was never **DECLARED** is not protected — an undeclared lease cannot be told from a
> free lane. Protection is **opt-in per lane**, via `--adopt`/`adopt`; without it this guard behaves exactly as
> before.

The competing consumer held **no lease at all**. It derived lane pairs at start-up from whatever looked busy
and pinned them by hand, never calling `acquire`. So there was no lease to contest, `lane-pool` had every reason
to believe lane-7 was free, and it handed it out correctly.

**The guard worked as designed and as documented.** Everything reported success.

## The generalizable claim

**A lease is advisory unless every consumer participates.** One non-participating consumer does not merely go
unprotected itself — it makes the exclusivity guarantee **structurally unenforceable for every other consumer**,
because the pool cannot distinguish "occupied without a lease" from "free". The protection is not weakened at
the margin; it is switched off for that lane, silently, for everyone.

This is the same quiet-degradation shape as the other capacity failures found today: **no gate fires, and every
component reports success.** `acquire` succeeded. The guard behaved per spec. The reset was routine. Only the
overlap was wrong, and nothing was positioned to see it.

## How the non-participating consumer came to exist

It was a deliberate workaround for [#3283](/backlog/3283/) — the lease reaper reclaiming a lane seconds after
acquisition, which made concurrent acquires collide. Hand-pinning avoided the reaper. #3283 was then filed and
prepared, and **the workaround was never withdrawn**.

That is the more useful half of this item: a workaround that outlives the defect it routed around, and quietly
disables the mechanism it was routing around. Worth checking for others of the same kind rather than only fixing
this one.

## Two directions for the fix — decide, do not assume

1. **Make participation mandatory** — the pool refuses to hand out a lane whose working tree is dirty or whose
   `.git` shows recent foreign activity, and `guard-lane` treats an *undeclared but visibly-occupied* lane as
   occupied rather than free. Closes the hole without requiring every consumer to cooperate, which is the point:
   a guarantee that depends on universal good behaviour is not a guarantee.
2. **Make non-participation impossible** — every lane consumer routes through `acquire`/`release`, and hand-pinning
   is refused. Cleaner, but only as strong as the last consumer to be migrated, and it does not protect against
   the next tool written in a hurry.

These compose; (1) is the one that holds when (2) is incomplete. Note the sibling session has already committed
to migrating its dispatchers onto real `acquire`/`release` now that #3283 is prepared — so (2) is partly in
motion, which is a reason to build (1) rather than a reason to skip it.

## Related, same theme

- Release leaves **untracked residue** behind — an untracked card file from a released lane was still present at
  the next acquire, making a free lane look occupied. Smaller, but it corrupts the same signal the fix in (1)
  would depend on.
- An adopter given a **fixed pool of four lane pairs** ran out, reported `UNADOPTED`, and left two PRs uncovered
  for thirty minutes. Fixed capacity meeting unbounded demand, degrading quietly.

## Done when

1. **Executable** — a test asserting that a lane which is occupied but **unleased** is not handed out by
   `acquire`, and that a genuinely free lane still is. Both directions: a pool that refuses free lanes is worse
   than one that over-shares, since it stalls every dispatch.
2. The `#3283` workaround is withdrawn wherever it still stands, or its remaining sites are named here.
3. `npm run check:standards` — 0 errors.
