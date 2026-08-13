# Spike: what must a run report so progress, divergence and spend are visible in time

**#3077.** No production code. This report is the deliverable.

---

## The short answer

Four fields, and one refusal.

| field | signal | who reads it |
| --- | --- | --- |
| `lastWriteAt` | liveness — did anything change? | the waker, as a predicate |
| `advancedAt` | progress — did the CURSOR move? | the waker, as a predicate |
| `budgetUsd` (declared) | the ceiling | the engine, exactly |
| `spentUsd` (derived, exists) | consumption against it | both |

**And the refusal: nothing judges convergence.** That is question 3, it is the crux, and the answer is that it
should not be attempted. What replaces it is a budget the operator sets and the machine enforces exactly.

---

## Q3 — who judges convergence? Nobody. RULED.

This is the question the brief calls the crux, so it gets the ruling first.

Two candidates were on the table: an agent judge (accurate, expensive, competes with the work it watches) and
a mechanical proxy (cheap, blunt). **Both are wrong, and this repo has already measured why.**

**The mechanical proxy is wrong on real data, twice.**

- **#1164** ran five review rounds and every one found a real bypass. Its per-round finding counts were
  3 → 1 → 1 → 1. Any count-based or decay-based rule flags that as thrashing. It was the most productive
  review sequence in the repo, and the round cap is 5 *specifically because of it*.
- **PR #1186**, this week, ran four rounds where rounds 1–3 each found *the same defect in a different place*.
  A human reading them says "same class recurring". A count rule says exactly what it said about #1164.

Those two are indistinguishable to every cheap signal available, and they want opposite responses. A
`stuck` detector was proposed in this repo earlier and **refused on this same evidence**; a spike that
re-proposes it would be ignoring a finding already paid for.

The one signal that *would* separate them — does round N raise the same finding CLASS as round N−1 — is not
available: the verdict ledger records neither finding identity nor counts. Making it available is a real piece
of work with its own cost, and it is not smuggled in here.

**The agent judge is wrong for a structural reason, not a cost one.** A convergence judge is a `judge` step
with its own spend, its own latency, and its own failure modes, watching work whose problem is that it is
spending too much. When the watched work is cheap the check dominates; when the watched work is expensive the
check is the same kind of thing that is going wrong. It also cannot be trusted on the exact case that matters
— a stray builder produces confident, plausible output, which is what a judge reads.

**So: replace the question.** The operator's actual ask was *"catch a stray builder that takes too long or is
not going toward the goal **before they spend too much**"*. The clause after "before" is the operable one. A
budget is:

- stateable by whoever declares the operation, without knowing anything about convergence;
- computable exactly, with no model call and no proxy;
- exactly the thing the operator said they cared about.

It does not catch a builder that is diverging cheaply. **That is a real gap and this spike does not close
it** — it is named here rather than papered over with a proxy that has already been shown wrong.

---

## Q5 — refuse a declaration that cannot state a progress measure? NO. RULED.

Refuse one that cannot state a **budget**.

Refusing on a progress measure fails on its own terms: the previous section concludes that nobody can supply
one honestly, so the gate would refuse every declaration or accept a made-up number — and a made-up
convergence measure is worse than none, because it will be trusted.

A budget is different: anyone declaring an operation can say what it is worth, and a wrong guess is visible
and adjustable rather than silently misleading.

**Scoped to declarations containing a `judge` step.** Those are the only ones that spend, and a `compute`-only
operation being made to declare a budget of zero is ceremony. This also keeps every existing read-only
operation untouched.

---

## Q2 — spend or time as the budget axis? SPEND.

Time is a proxy for a loaded machine, not for health. Measured today, in this repo, without changing any code:
a full gate ran **160s** with the machine idle and **690s** with three concurrent reviewers — a 4× swing with
no change in what was being run. A time budget would have fired on the healthy case.

Spend is monotonic, machine-independent, and already half-collected: `totalJudgeSpend` sums `costUsd` over the
`telemetry` rows the adapter records per juror.

Time keeps exactly one job: **liveness**. "Nothing has been written for N hours" is a real signal and it is not
a budget.

---

## Q1 — the minimum field set

Three signals, and the brief is right that they must not collapse.

**Liveness — `lastWriteAt`.** One timestamp, stamped by the store on every write. A run whose record has not
changed in hours is either finished, dead, or parked on something external. The first two are distinguishable
from `pending`; the third is what the waker's in-flight handling already covers.

**Progress — `advancedAt`.** Stamped only when the CURSOR moves. Two timestamps rather than one is the whole
trick: `lastWriteAt` recent and `advancedAt` old is precisely *alive but not getting anywhere*, and neither
field alone says it. This is the state the eleven-hour spike was in, and the state five lost headless runs
were in.

Note what is deliberately NOT the progress marker: `telemetry.length` grows with every juror spawn, so a run
burning money in a judge loop looks maximally "progressing" by that measure. Cursor movement is the only
monotonic marker that costs something to advance.

**Budget — `budgetUsd` declared, `spentUsd` derived.** Per Q2 and Q5.

Nothing else. In particular no `expectedDurationMs`: per Q2 it would fire on the healthy case, and the brief
already suspected this.

---

## Q4 — what happens on a bad verdict? SUSPEND AND ASK.

Never stop silently, never continue past the ceiling.

The engine already has exactly the right construct, and it needs no new machinery: a **`confirm` addressed to
a human**. Budget exhaustion suspends the run at a confirm, the operator sees what has been produced so far
and what it cost, and answers. The run is resumable from that point on any surface, because that is what a
confirm already is.

This matters for the #1164 case. An eager stop rule destroys value — five rounds were *worth* five rounds. A
suspend-and-ask does not: the operator sees "five rounds, $N spent, here are the findings" and says continue.
The budget is a checkpoint, not a kill switch, and the distinction is the difference between catching a stray
builder and strangling a productive one.

It also fails in the right direction. If nobody answers, the run stays parked and spends nothing more.

---

## Q6 — two consumers, one record

**The waker needs a predicate.** All four fields are scalars; the tick is field comparisons and no model call.
That was the constraint #3070's ruling rested on — a tick that spends no model context — and this preserves it.

**A person needs a narrative.** The same four fields plus the run's own `findings`, which already exist and
already carry what each step produced. The split is the one the codebase already uses: one payload shape, two
renderings.

The narrative gains something worth saying out loud: with an effect step now recording its outcome (#3082), a
run's `findings` are a complete account of what happened at every step. "What are we working on, and how is it
going" is answerable from one record without asking anything.

---

## What this does not cover

- **A builder diverging cheaply.** The budget catches expensive strays, not wrong-but-frugal ones. Named in
  Q3; no proxy is proposed, because the two available ones are measurably wrong.
- **Finding-class repetition**, which is the one signal that would separate #1164 from #1186. The ledger
  records neither finding identity nor counts. Making it do so is separate work.
- **Non-judge spend.** `costUsd` covers jurors. A run that burns wall-clock in compute steps is invisible to
  the budget and visible only to `advancedAt`.
- **Where the budget number comes from.** This rules that a declaration must state one, not what a good one
  is. That is calibration, and it wants data the repo does not yet have.
