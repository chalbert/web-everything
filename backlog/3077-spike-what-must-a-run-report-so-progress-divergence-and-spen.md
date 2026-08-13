---
bornAs: xuy3mlv
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-12"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [plateau-loop, delivery, operations, engine, spike, observability]
relatedReport: reports/2026-08-13-run-observability-spike.md
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

## The answer

`we:reports/2026-08-13-run-observability-spike.md`. Four fields and one refusal.

| field | signal |
| --- | --- |
| `lastWriteAt` | liveness |
| `advancedAt` | progress — cursor movement only |
| `budgetUsd` declared | the ceiling |
| `spentUsd` derived (exists) | consumption |

Two timestamps rather than one is the whole trick: `lastWriteAt` recent with `advancedAt` old is *alive but
not getting anywhere*, and neither field alone says it.

**Q3, the crux — nobody judges convergence, and nothing should.** Both candidates were refused on measured
grounds. The mechanical proxy cannot separate #1164 (five rounds, every one a real bypass, and the reason the
cap is 5) from PR #1186 (four rounds, the same defect relocating) — a `stuck` detector was already refused in
this repo on that same evidence. An agent judge is a `judge` step with its own spend watching work whose
problem is spending. So the question is REPLACED: a budget the operator states and the machine enforces
exactly. It does not catch a builder diverging cheaply, and the report says so rather than proposing a proxy
already shown wrong.

**Q5 — refuse a declaration with no BUDGET, not one with no progress measure**, and only where the
declaration contains a `judge` step. Refusing on a progress measure would refuse everything or invite a
made-up number, which is worse than none because it gets trusted.

**Q2 — spend, not time.** Measured today: an identical gate ran 160s idle and 690s under load. A time budget
fires on the healthy case. Time keeps liveness only.

**Q4 — suspend and ask**, as a `confirm` addressed to a human. No new machinery, resumable on any surface, and
it does not strangle a productive five-round run the way an eager stop would.

Four gaps are named as uncovered, including the cheap-divergence case and the ledger's missing finding
identity.
