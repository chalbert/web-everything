---
bornAs: xu03x3d
kind: story
size: 2
parent: "3029"
status: open
dateOpened: "2026-08-11"
tags: [plateau-loop, delivery, operations, engine, dispatch]
scope:
  - we:scripts/operations/effect-executor.mjs
---

# The effect executor cannot say "in flight by design", so a dispatch is refused on replay

`declared → pending → applied | failed` marks an entry `pending` **before** its sink runs, so a crash mid-sink
leaves the outcome unknown and a non-idempotent `pending` entry is refused on replay. That is exactly right for
a crash and exactly wrong for work that is deliberately still running — and the two share one state. Named as
owed follow-up 1 by the [#3030] spike and not filed until now.

## Why it blocks the epic

[#declare-dispatch] is the effect that **starts** something rather than completing it. Under today's states a
dispatch marks `pending`, and the replay guard then refuses to advance it — so the one operation the epic exists
to reach cannot be expressed, for a reason that has nothing to do with the four step kinds.

The spike checked the vocabulary and cleared it: `advance`'s no-resume path is idempotent, three of four kinds
suspend, so *"start work, come back later"* is already expressible. **The gap is the outcome model, not the
vocabulary.** That distinction matters because the statute says an operation appearing to need a fifth kind is
a signal the model is wrong — and the model is fine.

## The distinction to encode

| state | means | on replay |
| --- | --- | --- |
| `pending` | attempted, outcome **unknown** — the process died mid-sink | refuse unless `idempotent: true` |
| *(new)* | **started on purpose**, outcome arrives later | resume and poll; refusing is wrong |

The second is not a weaker `pending`. It carries a handle — the spike established `sessionId` is durable and
`pid` is not — and its resolution is a *later observation*, not a retry.

## Watch for

- The state is written **before** the sink runs, and must stay that way. Marking in-flight after the sink would
  reintroduce the indeterminate window this fixes.
- A dispatched effect whose handle is lost is NOT in-flight-by-design; it has become unknown. That transition
  needs to exist, or a lost handle silently reads as "still running" forever.
- The replay guard is the thing being relaxed, so it needs a test per state rather than one for the happy path.

## Done when

- [ ] An effect that starts long-running work is distinguishable from one whose outcome is unknown.
- [ ] Replay resumes the first and still refuses the second.
- [ ] A dispatched effect that loses its handle degrades to unknown rather than staying in-flight.
