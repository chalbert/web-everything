---
bornAs: xlt67co
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

> **RULED 2026-08-13 (operator, in session). The mechanism is settled; the NUMBERS are deliberately not.**
>
> **Declared per EFFECT** — beside `idempotent`, which is the same shape for the same reason: only the effect
> knows whether it is a cheap comment or a forty-minute build. Scoping it to "operations that spend on AI"
> was considered and rejected as the wrong axis: spend and retry are different questions, and every effect is
> retryable.
>
> **Enforced in the EXECUTOR**, the one chokepoint every caller passes through. Enforcing in the waker would
> bound today's timer and leave the next automatic caller unbounded — and "the next caller must remember" is
> the class of rule this repo keeps proving does not hold.
>
> **Default: the machine does not retry; a person still may.** An effect that declares nothing is retried by
> people exactly as before, and not by the timer. Unlimited automatic retry IS the defect — measured at
> eleven dispatches over ten ticks at exit 0. A first draft defaulted to "unlimited, blast radius zero"; that
> was risk-management dressed as a recommendation, and merit says the timer needs permission.
>
> **Exhaustion returns a DISPOSITION, not a boolean.** Initially `retry` and `ask-human`. The set is closed
> and versioned, and may grow — a blocker identified, needs splitting — but **an outcome earns its place only
> when it changes what happens next**, either machine-actioned or actionable by a person reading it.
> Otherwise it is a label on a shrug, which is exactly how the waker's `unresolved` cost three rounds. An
> unknown member read from an older record routes to a human; never ignored, never crashed.
>
> **Only `retry` is automatic.** Everything else goes to a person. That is what stops the set becoming a way
> for the machine to keep deciding things about itself.
>
> **The numbers stay unset**, and now for a measured reason rather than caution: #3090 found that the
> sample-size estimator answers `1` above a 97% base rate, so the tool meant to say "we have enough" cannot
> yet. The collector (#3091) is accumulating; the floor needs deriving from a fixed estimator.
>
> **Follow-up, not part of this:** on exhaustion, ask a juror to diagnose rather than only reporting. Better
> suited to a judge than the convergence question refused in #3079 — it runs ONCE and reads an ERROR, not the
> work's own plausible output. Two constraints: it may grant ONE bounded extension, never repeatedly, and any
> failure or unrecognised answer routes to the human. It may RECOMMEND a different approach in prose; it may
> not apply one, because applying one is the converge loop with write access and its own review.

The executor's `failed` means *"the sink threw `notApplied` — I am CERTAIN nothing landed"*, and its
pre-flight lets such an entry straight back through to the sink. That is correct and always has been, because
until now the only thing that re-entered `applyPendingEffects` after a failure was **a person re-running the
command**. Retry was bounded by someone deciding to retry.

The waker (#3084) breaks that. It re-enters on a timer, so `failed` becomes an unbounded automatic retry
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

## 2026-08-13 — the reader that would have supplied the numbers is coming back here

PR #1195 collected retry observations so this card's numbers could be measured rather than guessed. Its
fifth review recommended **splitting it**, and that was accepted:

- **The collector lands** — the `attemptedBy` threading and per-population counts in
  `we:scripts/operations/effect-executor.mjs`. Unrecoverable: an attempt not recorded when it happens is
  gone for good.
- **The reader (`we:scripts/operations/retry-health.mjs`) is re-filed against this card.** It is a pure
  function with no production caller, not currently runnable, and it exists only to answer *this* decision.

**Why it comes back rather than being finished there.** Every blocking finding from round 2 onward lived in
the reader, and all four were one class — a statistic or statement about one population applied to another
population's decision. The last one: an all-`unknown` corpus renders byte-identical to an empty one (1,000
settled entries and 5,000 real attempts printing "0 attempt observation(s)"), and the refusal explains it
with "Human retries do not answer this" — a claim about the human population in a case containing zero
human retries.

**What must be settled before the reader is written again.** This is a modelling question, not an
implementation one, and iterating on the implementation is what failed — the same conclusion [#3071]
reached:

- Name the population each threshold guards. `MIN_OBSERVATIONS` and `MIN_SUCCESSES` currently guard a
  denominator built from two populations at once.
- Decide what an all-`unknown` corpus is allowed to conclude. It is not "no data", and it is not the human
  answer either; rendering it as the former is what made the defect invisible.

**Newly unblocked:** [#3090] fixed `requiredNPerGroup`, which used to answer `1` above a 97% base rate —
exactly the range retry success rates sit in. `MIN_SUCCESSES = 20` can now be *derived* rather than chosen:
±5 points on a 95% coverage fraction wants roughly 153 observations, not 20. The estimator is ready before
the reader that needs it.
