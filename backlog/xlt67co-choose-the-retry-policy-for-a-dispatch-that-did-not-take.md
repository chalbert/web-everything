---
kind: decision
size: 1
parent: "3029"
status: open
dateOpened: "2026-08-12"
tags: [plateau-loop, operations, engine, dispatch, retry]
scope:
  - we:scripts/operations/effect-executor.mjs
---

# Choose the retry policy for a dispatch that did not take

The executor's `failed` means *"the sink threw `notApplied` — I am CERTAIN nothing landed"*, and its
pre-flight lets such an entry straight back through to the sink. That is correct and always has been, because
until now the only thing that re-entered `applyPendingEffects` after a failure was **a person re-running the
command**. Retry was bounded by someone deciding to retry.

The waker (#x0t9923) breaks that. It re-enters on a timer, so `failed` becomes an unbounded automatic retry
with no cap and no backoff. PR #1186's round-3 reviewer measured it on a persistently broken dispatch — bad
credentials, exhausted quota, a missing binary:

```
after park: dispatches = 1
tick 1 → 2 · tick 2 → 3 · tick 3 → 4 · … · tick 10 → 11
exit code 0 every tick, operator line byte-identical every tick
```

The waker now refuses to write anything for a dispatch that did not take, precisely because there is no
policy to appeal to. That is the safe answer and it is not the right one forever: work that genuinely did not
start SHOULD be retried, and today a person has to notice and do it by hand.

## What has to be decided

- **How many times, and how far apart.** A fixed cap, exponential backoff, or a deadline.
- **Where the count lives.** The run record is the obvious home, but it is transient session-local state and
  a retry budget arguably outlives it.
- **Who owns it.** The executor (so every caller inherits it), the waker (so only automatic retry is
  bounded and a human re-run stays unbounded), or the declaration (so an operation states its own tolerance).

The third is the most interesting and the least obvious: a `gh` comment and a CI build want very different
answers, and the declaration is the only place that knows which one it is.

## Why this is a decision and not a task

The three homes differ in what they couple, not in effort — the same shape as [#3070]. Putting it in the
executor changes behaviour for every existing caller including the human one; putting it in the waker leaves
two different retry semantics in the system; putting it in the declaration means every operation now has to
have an opinion. That trade is a ruling.

## Watch for

- Whatever is chosen must not make a HUMAN re-run refuse. The operator hitting `--resume` after fixing the
  credentials is the recovery path, and a budget that has been exhausted by the timer must not block it.
