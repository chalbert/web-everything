---
bornAs: x3pvhaf
kind: decision
parent: "3383"
status: open
relatedTo: ["3800","3612","3807","3808"]
scope: ["we:scripts/lib/lane-concurrency.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/dispatch-plan.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# One weighted worker budget plus the heavy pool, or separate heavy and light worker counts?

Operator, 2026-09-21: "Do we need heavy worker and light worker count?". Should dispatch be limited by ONE weighted worker budget with a weight per dispatch kind (rule v4: review 0.25, light task 0.5, prepare 1.0, build or fix 1.5, calibration exclusive) on top of the structural heavy-command pool (we:scripts/readiness/heavy-admission.mjs, cap 2 slots x 4 vitest threads), or by two separate counts, one for heavy workers and one for light workers? Open, not ruled. The default and every option, with rejection reasons, is written out below.

Filed uncleared and NOT prepared or ruled (no `preparedDate`). The options below are drafted for a talk-through, not a decision made.

## What is true today (facts, not forks)

- **Two limits already exist, at different layers.** The heavy pool (`we:scripts/readiness/heavy-admission.mjs`, ratified in #3456, built in #3461, widened in #3785) is a structural semaphore: at most 2 heavy commands (`verify-lane`, `check:standards`, `test:unit`, the visual capture) run at once, each with 4 vitest threads, so about 8 of 12 cores. It bounds heavy work whatever anyone declares. Above it, the orchestrator's rule v4 admits a dispatch while the sum of live weights plus the new weight stays within a budget of 8 units (review 0.25, light task 0.5, prepare 1.0, build or fix 1.5, calibration exclusive).
- **The weights already price "heavy".** A build weighs six reviews; a prepare (research plus one `verify-lane` at the end) weighs one. That is the cost difference between a worker that launches heavy commands repeatedly and one that launches none, which is what the operator asked for on 2026-09-21 ("A review that does not launch heavy commands takes very little capacity vs a build lane that has to run tests repeatedly").
- **A worker beyond the pool just waits.** Builds beyond the pool cap queue for a slot; the pool's waiting count and age are the direct signal that too much heavy work is admitted (card 3808 reads it).
- **Per-kind measurements are thin.** The only per-kind samples are the orchestrator's: review 8.3 percent CPU and 1669 MB over 5 workers, build 0.5 percent and 1065 MB over 3, task 28.3 percent and 3706 MB over 8. The statute says a worker process uses about 0.4 percent of a core (`we:docs/agent/platform-decisions.md`, heavy-command admission queue). The orchestrator's notes also record 92 `claude` processes at 19.4 GB in total, many idle. None of this is enough to fit a per-kind RAM limit.

## Fork: one weighted budget with the heavy pool, or two counts

- **A. One weighted budget plus the structural heavy pool. — DEFAULT.**
  - **Why.** Each limit does one job: the pool guarantees no more than 2 heavy commands run, whatever a worker declares; the budget spreads the rest of the cost (RAM, CPU of the agents themselves, git and `gh` throughput) by kind. One number to ramp, one verdict from `capacity-review`, one place in the `dispatch-budget` config (card 3807).
- **B. Two counts: a heavy-worker count and a light-worker count. — Rejected.**
  - It double-counts. The pool already caps concurrent heavy commands, so a heavy-worker count above the pool size only adds waiters, and one below it leaves a paid-for slot idle. It is a second, less accurate copy of the pool.
  - "Heavy worker" is not a stable class. A prepare or a light task runs one `verify-lane` at the end; a fix runs tests repeatedly; a review may run none. A count needs a hard kind-to-class mapping, which is a guess; a weight only needs a number that can be re-fitted.
  - It cannot say "four reviews cost about one build". Two counts trade nothing against each other, so a machine with room for reviews but not builds is underused, and the reverse is oversubscribed.
  - Two knobs to ramp, two thresholds and two verdicts to review; the ramp of rule v4 is one step of one number.
- **C. Weights only, no structural pool. — Rejected.** A weight is a DECLARED cost, not a measured one, and a raw heavy command typed by hand never passes through any budget. The pool is the backstop that holds when a weight is wrong. It is also already built.
- **D. A per-kind cap inside the same budget** (for example, builds at most 4 at once whatever headroom remains). — **Not now; worth a look only if calibration data shows a per-kind RAM limit** (available RAM under the emergency floor while the budget is not full, driven by one kind's memory). Then it is a field in the same config, not a second count, and it does not change the default's shape. Not decidable today: 3 build samples and 5 review samples are too thin.

## What would change the default

1. Calibration or the per-kind rollup shows one kind's RAM binds before the budget does: take D.
2. The pool cap moves (for example 2 to 3): re-price the weights; still one budget.
3. The weights turn out unstable across the sampler's per-kind rollup: re-fit them (card #3800), which is not a reason for two counts.

## If ruled otherwise

If B were ruled, the config of card 3807 gets two budgets and `capacity-review` (card 3808) returns two verdicts; both cards should be re-read before either is built. Recommend ruling before those two are built.

## Done when

1. **Assertable** — the ruling is recorded on this card as a dated paragraph naming the chosen option, and `we:docs/agent/platform-decisions.md` carries it (the heavy-command admission queue statute states that the budget is one weighted number plus the structural pool, with option D's trigger named).
2. **Executable** — `git grep -n "heavyWorkers\|lightWorkers" we:scripts we:config` finds nothing (no second count was introduced), and the resolver test of card 3807 asserts a single `budget` field.
