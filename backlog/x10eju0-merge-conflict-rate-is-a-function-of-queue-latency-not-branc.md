---
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/merge-ai-prs.mjs
tags: []
---

# Merge-conflict rate is a function of queue latency, not branch hygiene

Accepted PRs rebase once at acceptance and then wait while main keeps moving, so a long-queued PR eventually meets a main it genuinely conflicts with. The requeuer removes the symptom and cannot touch the cause.

## The mechanism

Three behaviours compose into a deadlock, each reasonable alone:

1. **Landability is a one-shot.** A PR is rebased once, at acceptance.
2. **The drain skips a `BEHIND` PR by design** and never rebases it.
3. **`main` moves every time anything lands.**

So the moment two PRs are accepted, all but the first go `BEHIND` and stay there. The queue does not drain
itself — it stalls, and every PR in it keeps ageing against a moving `main`.

## Measured, in one session

**Eight accepted, one merged in thirty minutes** — the other seven all `BEHIND`. *(Measured by the sibling
session running the drain, not by this one.)*

**Two accepted PRs went stale-then-conflicting while queued** — #1585 and #1582 — neither from a messy branch.
*(#1585's conflict was resolved first-hand by this session: a single import block in
`we:scripts/operations/__tests__/review-pr.test.mjs`, where `main` had added the `#xwk0tzu` stamp imports and
the branch had added `sessionSeed` and `MANDATORY_LENSES`. Nothing mutually exclusive — just two additions to
one list, arriving at different times.)*

That is the whole point: **#1585 did not conflict because anything was wrong with it.** It sat accepted long
enough for `main` to move under it three times, and the third overlap happened to touch the same six lines.

## The claim

**Conflict rate is a function of queue latency.** It is not a branch-hygiene problem, not a rebase-discipline
problem, and not evidence that anyone did anything wrong. Every additional minute a PR waits is another chance
for `main` to move across its lines, so the probability of a genuine conflict rises with waiting time and with
nothing else.

This inverts the obvious reading. The instinct on seeing conflicts is to get better at resolving them — better
tooling, smarter merges, more careful authors. That treats the symptom. **The cause is that accepted work
waits.**

## Why this argues against the existing fix

A **requeuer** now keeps accepted PRs rebased while they wait. It works, it is correctly scoped (only
`ready-to-merge` + `review:accepted`, never a PR under review, aborts on conflict rather than forcing) — and it
is a **stopgap**. It removes the `BEHIND` symptom and cannot touch the cause. If accepted work landed promptly,
neither the requeuer nor smarter conflict handling would be needed at all.

**Filing this as "keep the queue rebased" would be filing the workaround.** The item is: why does accepted work
wait, and what would it take to land it on acceptance. Keep the requeuer meanwhile — it is strictly better than
the stall — but do not let it stand in for the fix.

## The theme it belongs to: capacity, not correctness

A sibling failure the same session, worth recording because it is the same shape rather than the same bug: an
adopter was given a **fixed pool of four lane pairs**, ran out, reported `UNADOPTED`, and left two PRs
uncovered for thirty minutes. It now derives free lanes from what is actually busy.

Both failures are **fixed capacity meeting unbounded demand, degrading quietly rather than loudly**. Neither is
a correctness bug; both were found by noticing that something took too long, not by anything going red. That is
the harder class to see, because no gate fires and every individual component reports success.

## Honest scope of the evidence

**The queue has since drained.** At filing, one accepted PR remains open (#1585) and it is `MERGEABLE`. So this
documents a structural condition observed in a window that has passed, not a live incident. The condition
recurs whenever acceptance outpaces landing — which is whenever more than one PR is accepted at a time.

## Done when

1. **Executable** — a measurement, not a code change: report the time between `review:accepted` and merge across
   the last N PRs, and the count that were `BEHIND` while waiting. The fix is only demonstrable against a
   baseline, so the baseline has to exist first.
2. A decision recorded on whether landing-on-acceptance is the right end state, or whether something about the
   current sequencing genuinely requires the wait. **Do not assume the answer** — there may be a reason
   acceptance and landing are separate that is not visible from the queue's behaviour.
3. `npm run check:standards` — 0 errors.
