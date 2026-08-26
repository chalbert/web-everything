---
kind: story
size: 3
status: open
relatedTo: ["2748", "3151"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool.test.mjs"]
dateOpened: "2026-08-26"
tags: [lane-pool, lease, concurrency, reaper]
---

# The lease reaper reclaims a lane seconds after it is acquired, so concurrent acquires all collide on one lane

`we:scripts/lane-pool.mjs acquire` runs the `#2748` ghost-lease reaper first, and the reaper judges a lease dead by whether its lane's PR is merged — not by whether the lease is alive. A lane whose last PR merged is therefore reclaimed **immediately after** being handed out, so the next acquire returns the same lane again. Measured 2026-08-26: seven back-to-back acquires all returned `lane-24`, each printing `reaped lane-24 before acquire (pr-merged; was leased by <the previous caller>)` against a lease under a minute old. Every concurrent worker collides on one lane.

## Reproduced, twice, with nothing else running

```
$ node scripts/lane-pool.mjs acquire --purpose=probe --session=probe1
  reaped lane-24 before acquire (pr-merged; was leased by rv1566j (review-juror) @ 2026-08-26T00:05:06Z)
  acquired lane-24 for probe1 → …/lane-24

$ node scripts/lane-pool.mjs acquire --purpose=probe --session=probe2
  reaped lane-24 before acquire (pr-merged; was leased by probe1 (probe) @ 2026-08-26T00:05:26Z)
  acquired lane-24 for probe2 → …/lane-24
```

Twenty seconds between the two, and `probe1`'s lease is reaped as a ghost.

## Why this is worse than a stale-lease annoyance

**It silently destroys concurrency.** Seven reviewers launched in parallel were each handed the same lane.
Two consequences, and the second is the dangerous one:

1. `review-pr`'s `assertLaneCwd` (`#3151`) refuses a juror lane that is the driver's lane, so those runs fail
   — loudly, which is the good case.
2. Where nothing checks, **two agents work in one clone**. The whole lane model rests on one worker per
   checkout, and the guard that enforces it keys on the lease this reaper just gave away.

It also inverts the reaper's own purpose. `#2748` exists to reclaim leases whose holder is gone. Here the
holder is a process that started seconds ago and is about to `cd` into the lane.

## The defect, stated precisely

*"The lane's last PR is merged"* answers **is there unlanded work here?** It does not answer **is anyone
using this lane?** The reaper uses the first as a proxy for the second. That proxy is sound for a lease whose
holder has exited and stale for every lease that has not — and nothing consults holder liveness, which the
pool already records: the holder slug carries a pid (`Mac:<pid>`), and the release path already checks it.

## Not in scope

Changing which lane `acquire` picks, or the lease format. This is one predicate.

## Done when

1. **Executable** — a case where a lane's PR is merged **and** its lease is held by a live holder younger
   than the ghost threshold: acquire does **not** reap it, and returns a **different** lane. Fails today.
2. **Executable** — a case where the same lane's holder is gone: acquire still reaps it, so `#2748`'s
   behaviour is preserved rather than traded away. Green today and must stay green.
3. **Executable** — N successive acquire calls with no release between them return **N distinct lanes**
   while N free lanes exist. This is the property that actually broke, and neither case above states it.
4. **Mutation** — restoring the merged-PR-only predicate reddens cases 1 and 3 by name and leaves case 2
   green.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
