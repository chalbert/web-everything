---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-12"
tags: [plateau-loop, delivery, operations, engine, spike, observability]
scope:
  - we:reports/
scopeRationale: "A spike whose only output is one report; its filename is not known until the spike runs."
---

# Spike: what must a run report so progress, divergence and spend are visible in time

A run record says what operation, what inputs, how far, and what it waits on. It cannot say how it is GOING.
Three-point spike, **no production code** — one report naming the minimum a run must emit for a waker to act,
a person to watch, and a stray builder to be caught while it still matters.

## The brief, in the operator's words

> *"I'd not only ask are you done, but ask progress in relation to a preset goal with, when possible, a
> measure. Sometimes the task itself is faulty, so we need to catch a stray builder that takes too long or is
> not going toward the goal before they spend too much."*

Plus: a user should see **not only what we are working on, but how it is going**.

## Why a spike and not a field

`#3070` ruled the waker: a tick that asks *"are you finished?"*. That is answerable today. Two questions are
not, and adding an `expectedDurationMs` answers neither well:

- **Still going, or dead?** No expectation is recorded, so a stalled run and a slow one look identical. Five
  headless runs across 2026-08-10/11 exited before their work finished; one left an orphaned record stalled on
  a pending judge with zero telemetry. A tick would poll it forever.
- **Going toward the goal?** The goal is implicit in `op` + `input` — enough to know what was asked, not
  enough to know whether the work approaches it.

## Three signals, which the spike must not collapse

| signal | question | cost |
| --- | --- | --- |
| liveness | is it alive? | cheap, binary, nearly useless alone |
| progress | has it advanced? | needs a monotonic marker |
| convergence | is it advancing TOWARD the goal? | the hard one |

A run can be alive and stuck, or progressing and diverging. The stray builder is the third case.

## Questions to answer

1. **The minimum field set** to distinguish finished / running / stalled / diverging — each field tied to one
   signal.
2. **Spend or time as the budget axis?** Time is a poor proxy (a loaded machine is slow but healthy); spend is
   already partly captured in `telemetry` and is what the operator cares about. Rule on it.
3. **Who judges convergence, and what does that cost?** An agent judging it is a judge step with its own
   spend — the check competes with the work. A mechanical proxy (diff growth, finding count, test movement) is
   nearly free and blunt. **This is the crux; land on a position rather than listing both.**
4. **What happens on a bad verdict** — stop, ask, or continue? PR #1164 ran five rounds and every one found a
   real bypass, so an eager stop rule destroys value. Separate *thrashing* from *converging slowly*.
5. **Refuse an operation at declaration time if it cannot state a progress measure?** The aggressive reading
   prevents stray builders rather than catching them late. Rule either way.
6. **Two consumers, one record.** A waker needs a predicate; a person needs a narrative. Say how both are
   served without making the tick expensive or the human view unreadable.

## Evidence to mine, all in-repo and measured

The 11-hour spike that produced nothing. Five lost headless runs. #1164's five productive rounds. Three
reviewer sessions on 2026-08-12 that exited mid-gate having done the analysis and set no label.
`we:scripts/lib/gate-health.mjs` already refuses to conclude when its evidence is too weak — the same
discipline, a different question.

## Acceptance

A short report in `we:reports/` naming the field set, each field tied to a signal and a consumer. It rules on
questions 3 and 5 rather than surveying them, and states what it does not cover.

**No production code, and no cards beyond this one.** The last spike here ran eleven hours and produced
nothing because its brief also asked it to design, enumerate, write the card, gate and open a PR. A spike's
deliverable is an answer.
