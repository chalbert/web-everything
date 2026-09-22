---
bornAs: x3pvhaf
kind: decision
parent: "3383"
status: open
relatedTo: ["3800","3612","3807","3808","3456","3737","3727"]
scope: ["we:scripts/lib/lane-concurrency.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/dispatch-plan.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "1fb90c9e870d6d551e11208b9495ee7c262b1a31"
tags: [conveyor, capacity, concurrency, admission-control, dispatch-budget]
relatedReport: reports/2026-09-21-weighted-worker-budget-vs-split-counts.md
---

# One weighted worker budget plus the heavy pool, or separate heavy and light worker counts?

## Digest

Recommendation: keep ONE weighted worker budget (a weight per dispatch kind: review 0.25, light task 0.5, prepare 1.0, build or fix 1.5, calibration exclusive) on top of the structural heavy-command pool, and do NOT add separate heavy-worker and light-worker counts. No weighted budget exists in the repo yet: the only worker limit today is one shared lane COUNT (`we:scripts/lib/lane-concurrency.mjs:38`), and the weights live in the orchestrator's local notes (rule v4), so both forks below are new design. They are grounded in a prior-art survey published as [/research/weighted-worker-budget-vs-split-counts/](/research/weighted-worker-budget-vs-split-counts/) (session report linked via `relatedReport`), and each carries a recommended default in **bold**. Operator, 2026-09-21: "Do we need heavy worker and light worker count?" — the survey's answer is no: Ninja, Gradle, Bazel, Airflow and Jenkins all pair one shared budget with a hard cap on the scarce step, and the one documented static two-class split (Hadoop MRv1's map and reduce slots) idled one class while the other was saturated and was replaced. The survey also surfaced a second call the card and #3807 left implicit (Fork 2): what happens when the next queued item does not fit the remaining budget. Both forks are ratifies of a forced invariant: Fork 1 rejects two counts that REPLACE the shared sum, Fork 2 rejects skip-ahead for the exclusive kind (calibration could never drain the budget). Everything else the survey turned up is a supported-by-default extension, not a rival branch.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — admission shape | **(a) one weighted budget plus the structural heavy pool** | (b) two counts that replace the shared sum, heavy workers and light workers | High — every surveyed scheduler that mixes job kinds does this |
| Fork 2 — an item that does not fit the remaining budget | **(a) an exclusive kind drains the budget; every other kind is admitted by per-item fit, with a per-kind `drain` flag defaulting to false** | (b) skip-ahead for every kind, exclusive included | High for the exclusive half (forced); med for the non-exclusive default, which the existing held-stall detector watches |

Supported by default (not decisions, below): an optional per-kind ceiling inside the same budget; strict rank order for any kind (its `drain` flag set to true); the lane count kept as a physical bound; the weight values and the ramp. Settled by precedent (not a decision): the structural heavy pool stays.

## What is true today (facts, not forks)

- **Three limits exist or are proposed, each on a different resource.** (1) Lane slots: a lane count, default 8, `WE_MAX_CONCURRENT_LANES` (`we:scripts/lib/lane-concurrency.mjs:38`, `:52`, `:68`), applied identically to builds and to prepare/fix spawns (`we:scripts/readiness/dispatch-plan.mjs:328`, `we:scripts/conveyor/tick-core.mjs:1118` and `:1157`). (2) Heavy commands: a structural semaphore, cap 2 slots x 4 vitest threads, about 8 of 12 cores (`we:scripts/readiness/heavy-admission.mjs:109`, ratified #3456, built #3461, widened #3785). (3) Worker weight: the proposed budget, which today exists only as the orchestrator's rule v4 (8 units, ramp 8 -> 10 -> 12), seeded into card #3807's config.
- **The provisional weights already price the difference the operator asked about (their ratio is re-fitted under #3800; see the last bullet).** A build weighs six reviews; a prepare (research plus one `verify-lane` at the end) weighs one. That is the gap between a worker that launches heavy commands repeatedly and one that launches none (operator, 2026-09-21: "A review that does not launch heavy commands takes very little capacity vs a build lane that has to run tests repeatedly").
- **The pool is a bounded-wait guarantee, not a hard cap (correction to the first draft of this card).** A waiter that cannot get a slot fails OPEN after 20 minutes and runs unslotted (the 20-minute constant at `we:scripts/readiness/heavy-admission.mjs:117`, the fail-open return at `we:scripts/readiness/heavy-admission.mjs:420`), and the wrapper is a pass-through under `CI=true`, `WE_HEAVY_ADMISSION=off` or a missing pool root (`we:scripts/readiness/heavy-admission.mjs:449-455`). The pool's waiting count and age are the direct signal that too much heavy work is admitted (`admissionStatus`, `we:scripts/readiness/heavy-admission.mjs:433`; card #3808 reads it). An upstream budget that keeps that waiting count low is what keeps waiters from ever reaching the fail-open timeout.
- **The statute disagrees with rule v4.** The "Core budget (PROVISIONAL)" paragraph says the worker dispatch cap is 3 (`we:docs/agent/platform-decisions.md:4403-4404`) and rejects a load-average gate (`we:docs/agent/platform-decisions.md:4410`); rule v4 replaced the flat 3 with the weighted budget. Reconciled below (Statute overlap).
- **Per-kind measurements are thin.** The only per-kind samples are the orchestrator's: review 8.3 percent CPU and 1669 MB over 5 workers, build 0.5 percent and 1065 MB over 3, task 28.3 percent and 3706 MB over 8; the statute says a worker process uses about 0.4 percent of a core (`we:docs/agent/platform-decisions.md:4405`). None of this is enough to fit a per-kind RAM limit, and it does not yet support the 6:1 build-to-review ratio: RAM per worker is about 334 MB for a review (1669 over 5) against about 355 MB for a build (1065 over 3), and agent CPU is lower for a build (0.5 percent) than a review (8.3 percent). The seeded weights are provisional, and a weight should price what the pool does NOT already cap (agent RAM, agent CPU, git and `gh` throughput); re-fitting them is #3800's job, and the shape ruled here does not depend on the ratio (with every weight equal to 1 the budget degenerates to today's flat count). The host sampler that would supply more data is on the `lane/mechanical-dispatcher` branch, not on `main`.

## The axes, and the per-fork classification

The concern decomposes into three orthogonal limits (lane slots, worker weight, heavy commands), each pinned above to code. Classification (the 7-question pass): **Q1** this is delivery-loop machinery under the statute layer (`#heavy-command-admission-queue`, `#deterministic-core-thin-judgment`), not an intent, block, plug or protocol; **Q2** not a protocol (no swappable-vendor story); **Q3** no intent axis is involved; **Q4** the invariant "sum of live weights plus the new weight is at most the budget" is a fixed mechanic, while the budget, the ramp and the weights are config values (card #3807's tracked config, per-hardware formula in #3800), not ruled here; **Q5** not DI-injectable; **Q6** most-permissive default: every kind that can be admitted is admitted (per-item fit), with the one exception Fork 2 shows is forced; **Q7** the seam is between the lane count and the budget, and between the budget and the pool, both named in the facts above.

## Fork 1 — one weighted budget plus the heavy pool, or two counts

*Why this is a fork:* the excluded branch is (b), two counts that REPLACE the shared sum, because agent RAM, agent CPU and git/`gh` throughput are ONE shared resource, and two independent counts cannot express a trade between kinds (a static class split idled capacity where it was tried: Hadoop MRv1). *Composability probe:* a per-class ceiling INSIDE the shared sum does compose with (a) (see Supported by default 1), so that shape is not offered as a rival; what cannot coexist with (a) is a count that takes the place of the sum, which is (b).

- **(a) One weighted budget plus the structural heavy pool. — DEFAULT.** Under normal operation the pool bounds concurrent heavy commands at 2 whatever a worker declares (a bounded-wait bound, see the facts above); the budget spreads the remaining load (RAM, agent CPU, git and `gh` throughput) by kind and keeps the pool's waiting count low. One number is ramped and `capacity-review` (#3808) returns one well-posed verdict on it. Merit: models the shared resource as one budget; keeps the pool as the backstop that holds when a weight is wrong. The pool itself is settled by precedent, not decided here: ratified #3456, built #3461, widened #3785 (`we:docs/agent/platform-decisions.md:4336`); a weights-only design with no pool would rest on declared weights alone, which Bazel's maintainers call inaccurate ("Resource modeling for actions is… inaccurate") and Kubernetes charges by declared request, and both keep a cap that does not trust the declaration.
- **(b) Two counts that replace the shared sum: a heavy-worker count and a light-worker count. — Rejected.**
  - It models one shared resource as two independent ones. With a joint budget, 3 builds plus 14 reviews and 5 builds plus 2 reviews can both be admitted or refused on the same arithmetic; two counts must fix the split in advance, and a machine with room for reviews but not builds, or the reverse, is underused or oversubscribed. Where a static two-class split was shipped (Hadoop MRv1 map and reduce slots) it idled one class while the other was saturated and was replaced by fungible containers; Airflow reports the same wasted headroom across separate pools ([Airflow discussion 25139](https://github.com/apache/airflow/discussions/25139)).
  - "Heavy worker" is not a stable class. A prepare or a light task runs one `verify-lane` at the end, a fix runs tests repeatedly, a review may run none. A count needs a hard kind-to-class mapping, and a misplaced kind is a discrete error; a weight is a graded number that the sampler's per-kind rollup re-fits (#3800).
  - It duplicates the pool with less information. The pool already caps concurrent heavy commands at 2, so a heavy-worker count above 2 only adds pool waiters (which fail open at 20 minutes) and one below 2 leaves a slot idle.
  - Its control loop is not well-posed: `capacity-review` (#3808) returns ONE verdict, `raise`, `hold` or `lower`; with two counts the verdict must also name which count, and no rule says which moves first when both knee signals fire.

Code shape (real call site, then the two configs):

```js
// today — one COUNT shared by every kind (we:scripts/readiness/dispatch-plan.mjs:328)
const { admitted, overflow } = capToConcurrency(freeLanes, { activeCount: activeLeases.length, cap: maxConcurrentLanes });
```

```jsonc
// Fork 1 (a) — the tracked dispatch-budget config (seeded per #3807; values provisional)
{ "budget": 8, "ramp": [8, 10, 12],
  "weights": { "review": 0.25, "light": 0.5, "prepare": 1.0, "build": 1.5, "fix": 1.5, "calibration": "exclusive" },
  "maxLanes": 8 }   // the old lane COUNT, kept as a physical bound (Supported by default)
// admit(kind)  <=>  liveWeight + weights[kind] <= budget        (an exclusive kind: liveWeight === 0)
```

```jsonc
// Fork 1 (b) — rejected: two independent counts and a hard kind-to-class map
{ "heavyWorkers": 3, "lightWorkers": 12,
  "class": { "review": "light", "light": "light", "prepare": "light?  heavy?", "build": "heavy", "fix": "heavy" } }
```

Known occurrences (the pattern already ships): Ninja (`-j` plus `pool` `depth`), Gradle (`--max-workers` plus `maxParallelUsages`), Bazel (declared CPU/RAM per action against one scheduler), Airflow (`pool_slots` inside one shared pool), Jenkins (Heavy Job executor weights). The rejected shape's documented failure: Hadoop MRv1 static map/reduce slots. Details and links: [/research/weighted-worker-budget-vs-split-counts/](/research/weighted-worker-budget-vs-split-counts/).

Skeptic: SURVIVES-WITH-AMENDMENT — the strongest attack was that (b) is a strawman and the card's own per-kind ceiling is (b) in disguise; it partly landed, so (b) is now stated as counts that REPLACE the shared sum, the ceiling is an optional field on the same config (Supported by default 1), the former "weights only, no pool" branch became a settled-by-precedent note, and the pool is described as a bounded-wait bound rather than a guarantee.
Screen: clear — a fresh-context agent cleared both questions: the ruling fixes the operator's config surface and the single `capacity-review` verdict, and merit remains with both branches free (idle capacity from a static split, an unstable "heavy worker" class, pool duplication, an ill-posed two-count verdict); its one trim (a maintenance-sounding clause about "one place in the config") is removed.

## Fork 2 — an item that does not fit the remaining budget

*Why this is a fork:* the excluded branch is (b), skip-ahead for EVERY kind, because an exclusive item (calibration: "the whole budget, nothing else live") needs live weight 0, and skip-ahead keeps refilling headroom with smaller items as workers finish, so an exclusive item is admitted only at an idle instant, which a steady stream of work never produces (it starves under load). *Composability probe on the rest:* how a NON-exclusive item that does not fit behaves (hold the line, or let smaller ones pass) is one boolean per kind, `drain`; strict rank order for any kind is that flag set to true, so it coexists with the default and is not a rival branch (Supported by default 4).

Today's planner is one rank-ordered pass that holds, never drops, what it cannot launch (`we:scripts/readiness/dispatch-plan.mjs:340-468`), and it covers BUILD items only: prepare, fix and ci-heal spawns are separate sequential steps in `we:scripts/conveyor/tick-core.mjs` that thread the shared lane count between them (`we:scripts/conveyor/tick-core.mjs:1118`, `:1157`), and review and task dispatch read no ceiling at all (#3807, #3727). A weighted budget therefore needs ONE tick-wide ledger of live weight plus this tick's admissions, held in the shared resolver (`we:scripts/lib/lane-concurrency.mjs`, extended by #3807) and threaded through every planner the way `activeCount` is today. Card #3807's tests already assume per-item fit for ordinary kinds (test (b): "live weight 7.0, a build (1.5) is refused and a review (0.25) is admitted") and an exclusive kind admitted only at live weight 0 (test (c)).

- **(a) An exclusive kind drains the budget; every other kind is admitted by per-item fit, and a per-kind `drain` flag (default false) can make any kind hold the line. — DEFAULT.** The ledger has a `draining` state. When an exclusive item is reached with live weight above 0, it is held `budget-drain` and the ledger refuses every later admission that tick, from every planner; it is admitted the first tick live weight is 0. Any other item is tested on its own, `liveWeight + weight <= budget`, admitted or held `budget`, and (with `drain: false`) never blocks those behind it; with `drain: true` a refused item of that kind stops later admissions that tick (it holds the line, it does not drain to zero). "Later" means later in the tick's fixed planner order (the build planner, then the prepare, fix and ci-heal steps in `we:scripts/conveyor/tick-core.mjs` order) and, within one planner, later in rank order. What the decider ratifies is the exclusive-drains half; the flag's default of false is not a pick, it is the most-permissive value (Q6). The hold is applied at the LAST gate, like `dispatch-paused` (`we:scripts/readiness/dispatch-plan.mjs:449-457`), so it never relabels an item already held for a more specific reason and never stops later items from being classified (`tick-core` reads that `held` list, `we:scripts/conveyor/tick-core.mjs:1254-1259`). Merit: the exclusive kind stays reachable; ordinary admission is work-conserving and a pure function of (live weights, the item's weight); capacity is not idled behind an item that does not fit; the most-permissive value is the default and the restriction is the operator's per-kind opt-in. **Named residual risk (stated, not solved):** with `drain: false`, a steady stream of small kinds can overtake a non-exclusive build (1.5) indefinitely. The existing stall detector watches for it (`advanceHeldStall`, `we:scripts/conveyor/tick-core.mjs:258`: the same item held on the same reason for `stallTicks` consecutive ticks),
- **(b) Skip-ahead for every kind, including exclusive. — Rejected.** Broken: the exclusive kind starves under load (see the fork-existence line).

Precedent, cited as supporting context only: the planner already lets a lower-ranked item launch past a held higher-ranked one when the two overlap in SCOPE (`we:scripts/readiness/dispatch-plan.mjs:444-448`), which is a path conflict, not a capacity conflict, so it does not authorize skip-ahead for weights; the only capacity precedent in the file holds everything behind an exhausted free-lane list (`we:scripts/readiness/dispatch-plan.mjs:461-464`), and that is safe only because every kind counts as one lane. The Go weighted semaphore is strict FIFO for the same reason a drain exists (`x/sync/semaphore`: skipping ahead "could cause starvation for large requests; instead, we leave all remaining waiters blocked"), and Airflow issue 29474 is the mirror complaint (a large task overtaken by small ones), so the trade is real in both directions; that is why the flag exists and the residual risk is named.

Code shape (a tick-wide ledger in the shared resolver, not a loop-local `break`):

```js
// Fork 2 (a) — in the shared resolver (we:scripts/lib/lane-concurrency.mjs, per #3807), called by dispatch-plan AND tick-core
// dispatchKind is review | light | prepare | build | fix | calibration — NOT the backlog item's own `kind`
export function admitWeighted(ledger, dispatchKind, cfg) {
  const w = cfg.weights[dispatchKind];                  // a number, or 'exclusive'
  if (ledger.draining) return { ok: false, reason: 'budget-drain' };
  const fits = w === 'exclusive' ? ledger.live === 0 : ledger.live + w <= cfg.budget;
  if (!fits) {
    if (w === 'exclusive' || cfg.drain[dispatchKind]) ledger.draining = true;   // exclusive is always drain: true
    return { ok: false, reason: ledger.draining ? 'budget-drain' : 'budget' };  // drain false: the caller moves on to the next item
  }
  ledger.live += (w === 'exclusive' ? cfg.budget : w);
  return { ok: true };
}
```

```jsonc
// Fork 2 — the per-kind flag in the tracked dispatch-budget config (values provisional)
"drain": { "calibration": true, "review": false, "light": false, "prepare": false, "build": false, "fix": false }
// strict rank order for every kind (the old option (c)) is every value true
```

Skeptic: SURVIVES-WITH-AMENDMENT — attacks: (1) classification: the non-exclusive half is a config dimension, not a fork, so it is now the `drain` flag and strict order moved to Supported by default; the forced half (exclusive drains) stays as this fork's ratify; (2) "never admitted" overclaimed, so it now says it starves under load; (3) the first code shape used a loop-local `break`, which would silently drop later items' holds and cannot drain the other planners, so it is now a tick-wide ledger with a last-gate hold; (4) citation scope: the scope-overlap skip-ahead precedent does not authorize capacity skip-ahead, so it is demoted to supporting context; (5) the trigger no longer waits on #3808 because `advanceHeldStall` already exists.
Screen: clear — a fresh-context agent (had not seen the authoring) cleared both questions: the ruling changes what an operator observes (whether calibration runs under load, the `budget-drain` vs `budget` hold reasons), and a merit difference remains with both branches free (liveness of the exclusive kind vs work-conservation); its two trims (a timing clause, and stating that only the exclusive-drains half is ratified) and the `drain: true` definition and planner-order gaps it found are applied above.

## Supported by default (not decisions)

1. **An optional per-kind ceiling inside the same budget** (for example builds at most 4 at once whatever headroom remains). Composability probe: it is an optional field on the SAME config; absent, behavior is exactly Fork 1 (a). It coexists with the default, so it is not a competing branch, and it is not a second count because the shared sum stays authoritative. Jenkins (Throttle categories over Heavy Job weights) and Slurm (`GrpTRES`/`MaxJobs` beside `TRESBillingWeights`) ship exactly this. Trigger to add it: available RAM under the emergency floor while the budget is not full, driven by one kind's memory. Not decidable today: 3 build samples and 5 review samples are too thin.
2. **The lane count stays as a physical bound** (`maxLanes`, #3807 design point 3, and #3612). Lane slots are a different resource from worker weight; it is not a worker class.
3. **The budget, the ramp and the weight values** are config values (#3807), re-fitted from telemetry (#3800, #3808). This card rules the SHAPE, not the numbers.
4. **Strict rank order for any kind** (an item of that kind that does not fit holds the line for later admissions that tick, as Go's weighted semaphore does): it is Fork 2's per-kind `drain` flag set to true, so it coexists with the default. Trigger to flip a kind: the stall detector reports an item of that kind held on `budget` across `stallTicks` consecutive ticks while smaller kinds were admitted.

## What would change the default

1. Calibration shows one kind's RAM binds before the budget does: add the per-kind ceiling (Supported by default 1). Still one budget.
2. The pool cap moves (for example 2 to 3): re-price the weights; still one budget.
3. The weights are unstable across the sampler's per-kind rollup: re-fit them (#3800). Not a reason for two counts.
4. The stall detector (`advanceHeldStall`, `we:scripts/conveyor/tick-core.mjs:258`) reports a non-exclusive item held on `budget` for `stallTicks` consecutive ticks while smaller kinds were admitted: set that kind's `drain` flag to true so a refused item of that kind holds the line for later admissions that tick (Supported by default 4). This changes Fork 2's residual risk, not its default; the flag is a reviewed config change with a dated reason (#3807).

## Statute overlap (reconciled now, so ratification inherits no conflict)

The ruling would extend `#heavy-command-admission-queue` (`we:docs/agent/platform-decisions.md:4336`). Same-subject text found: the "Core budget (PROVISIONAL)" paragraph. (1) Its "worker dispatch cap is **3**" (`we:docs/agent/platform-decisions.md:4403-4404`) is superseded, and rule v4 already overtook it; the ruling rewrites that clause to "worker admission is one weighted budget (seed 8 units, in the tracked `dispatch-budget` config) on top of the pool", keeping the pool numbers (cap 2 x 4 threads, 2 cores reserved). (2) "No load-average gate" (`we:docs/agent/platform-decisions.md:4410`) stays true: rule v4's emergency floor is a CPU-busy and available-RAM floor, not a load average (#3807 design point 9). (3) "The lane ceiling (#3612) is also separate" (`we:docs/agent/platform-decisions.md:4412-4413`) stays true: it becomes `maxLanes`. (4) Clause 2 of the same anchor says a lane may always be acquired freely and an idle-but-leased lane is never itself the expensive thing (`we:docs/agent/platform-decisions.md:4353-4356`), and clause 1 says the heavy-command set is not weighted (`we:docs/agent/platform-decisions.md:4346-4352`). Both bind the HEAVY-COMMAND pool (where it caps, and that every command costs one slot); the worker budget is a different, upstream admission point that already exists in kind (the lane-count ceiling sits "upstream of heavy-admission entirely", `we:scripts/lib/lane-concurrency.mjs:10-17`), and a worker's agent RAM is what it prices. The ruling states this so neither clause is read as forbidding it: the pool stays equal-cost per command, the weights are on workers. No other anchor governs worker-count shape (searched for budget, ceiling, dispatch cap, worker, exclusive); the pool clauses (`we:docs/agent/platform-decisions.md:4346-4372`) are cited only as the settled backstop, never as authority over the worker-count shape.

## If ruled otherwise

If Fork 1 (b) were ruled, the config of #3807 gets two budgets and `capacity-review` (#3808) returns two verdicts; both cards should be re-read before either is built. If Fork 2 (b) were ruled, calibration would be admitted only at an idle instant, so under sustained load it never runs; #3807's test (c) as written would still pass, and the drain test in Done-when 3 could not be met. Strict order for every kind is not an alternative ruling; it is the `drain` flag set true everywhere. Recommend ruling before #3807 and #3808 are built.

## Done when

1. **Assertable** — the ruling is recorded on this card as a dated paragraph naming the chosen option of each fork, and `we:docs/agent/platform-decisions.md` carries it: the "worker dispatch cap is 3" clause is rewritten to the one weighted budget plus the structural pool, Fork 2's drain rule and its `drain` flag are stated, the per-kind-ceiling trigger (Supported by default 1) is named, and the statute says the pool stays equal-cost per command while the weights are on workers.
2. **Executable** — `git grep -n "heavyWorkers\|lightWorkers" we:scripts we:config` finds nothing (no second count was introduced), and the resolver test of card #3807 asserts a single `budget` field.
3. **Executable** — card #3807's tests gain a drain case on ONE ledger shared by the build planner and the prepare/fix planner: with live weight above 0 and a queue of [calibration, review], neither is admitted (calibration held `budget-drain`, the review held by the drain, not by weight); with live weight 0, calibration is admitted; and with `drain: false` a refused build does not stop a review from being admitted (#3807's test (b)).

## Touch-set probe (#2619) and provisional review jury (#2638)

The ruling authorizes a statute edit (`we:docs/agent/platform-decisions.md`) and one amendment to card #3807's test list; no new buildable child is carved (#3807 and #3808 already exist and are re-read after the ruling), so no child `scope:` is stamped here. A statute edit is `high` care.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
