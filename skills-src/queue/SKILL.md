---
name: queue
description: Read who's holding or waiting on the heavy-admission pool right now (the host-wide cap on concurrent check:standards/test:unit/verify-lane runs) through the declared heavy-queue operation. Use when asked "what's running on the heavy queue", "who's waiting on the gate", "is the pool full", or to check heavy-command contention before starting another gate run.
---

# Read the heavy-admission queue

## One call

Replaces the hand-built "who's holding/waiting" report with:

```bash
node scripts/operations/run.mjs heavy-queue --json
```

Read `verdict` in the standard operation envelope — see [heavy-admission.mjs](../../scripts/readiness/heavy-admission.mjs)'s own header for the admission mechanism this reports on, and
[heavy-queue.mjs](../../scripts/operations/heavy-queue.mjs)'s header for exactly how `kind`/`who` are derived.

## Present the table

From `verdict.rows`, render one row per holder/waiter, briefly (a markdown table is fine):

- **RUN/WAIT** — `state`
- **lane** — `lane` (null when not a lane clone)
- **who** — `who` (the lane's lease `purpose`, e.g. `fix-2672`/`ci-heal-2636`, falling back to `session`, a
  chat-session id; null when the repo carries no live lease)
- **minutes** — `minutes` held (RUN, since acquire) or waiting (WAIT, since `requestedAt`)
- **kind** — `selected` / `FULL` / `standards` / `files` / `other`

Then the headline: `verdict.heldCount` of `verdict.cap` held, `verdict.waitingCount` waiting, and
`verdict.projectedWaitMinutesForNewJob` (the rough estimate for a NEW job arriving now — `0` whenever
`verdict.freeCount > 0`).

Then **projected wait if you start now** (card xkyw1x4): `verdict.queueAdmission.projectedWaitMinutes` against
`maxWaitMinutes` (30 by default) — the wait a dispatch's short checks would see on the fast lane (fast slots + free
heavy slots) — plus `fullSuiteWaitMinutes`, the wait a new full suite would see on the heavy slots. The fast slots
(`fastSlots`, default 1) are added on top of the heavy cap. For each kind in `verdict.queueAdmission.byKind` (review, fix, ci-heal,
build) whether one more session started now would be admitted or held `queue-cap` — the same rule the conveyor
tick and the fix-dispatch daemon apply. `standardSource` says whether each kind's standard time is the rolling
median of real holds or still the seed.

## Read only

This is a READ: it never acquires, releases, or reaps a slot, and never runs a gate. A row's `kind: FULL` on
an old lane base is worth flagging to the operator (card `xb0iuxq`'s own log has the finding: guard-bash loads
from the lane's own checkout, so a deny wired in only after PR #2680 never reaches a lane forked before it) —
but this skill does not fix it.
