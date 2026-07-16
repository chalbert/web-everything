---
bornAs: xuzne08
kind: decision
parent: "2445"
status: open
dateOpened: "2026-07-16"
relatedReport: reports/2026-07-16-build-queue-prioritization.md
tags: [plateau-loop, build-queue, prioritization, console]
---

# Plateau build-queue prioritization system — design forks

The Plateau Loop's AI-build UI needs a **full but configurable** prioritization system: the user decides which backlog items an autonomous agent builds next, and in what order. A prior-art survey of the leading backlog / project tools + queue-scheduling theory (`we:reports/2026-07-16-build-queue-prioritization.md`) converges on a clear shape — a **fixed skeleton + a configurable scoring engine**. Most of that shape is settled by that convergence (recorded under "Supported by default"). Two questions are genuine forks that need a call; this decision isolates them. **Contingent on building the build-queue program** (the go/no-go is the separate priority call in the reframed `we:backlog/2525-backlog-view-launch-control-claim-handoff-vs-headless-build-.md`); settle these design forks so that build is spec-ready.

## The settled shape (Supported by default — not forks)

The survey's convergence, adopted without a fork (the alternative isn't broken/exclusive — it's consensus):

- **Two fields, not one: a coarse *tier* + an exact *rank*.** Every mature tool separates importance (4–5 fixed buckets) from sequence (an exact order). We adopt both.
- **Manual rank = a "between-able" key (LexoRank / fractional index).** A drag is one write, not a renumber; rebalance in the background. Universal across Jira/Azure/GitLab.
- **One weighted-scoring engine, WSJF-shaped.** `score = CostOfDelay / JobSize`. RICE/ICE/WSJF are all `Σ(criterion × weight)` — build the engine once, ship WSJF-shaped defaults. WSJF fits a *build* queue (sequencing; effort is cheap when an agent builds).
- **Inputs reuse existing backlog data.** `JobSize ← size`, `unblocks-others ← blockedBy graph`, `readiness ← status/deps`. Only Value / Time-criticality / Confidence are new human inputs. **`JobSize` composition** (just `size`, or `size` + blast-radius/review-load) is a *config dimension*, not a fork — blast-radius is simply another optional weighted criterion; start with `size`, extend via config.
- **Aging to prevent starvation.** Effective priority rises gently with wait time, capped so it can't leapfrog a pinned tier.
- **WIP=1, non-preemptive; deterministic next-to-build.** `filter(ready) → sort(tier, effectiveScore↓, rank, createdAt) → first`, decided once per completion. FIFO tie-break.
- **Divergent human priorities → saved views** (filter+sort), never per-user mutation of the shared queue.
- **Config as data:** one versioned config object (criteria + weights + aging rate + tier defs); items store raw inputs, never a baked score. **Criteria cap** (~3–5, weights sum 100%, none > 50%) is a tuning default, not a fork.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · manual override shape** | **(a)** a separate *tier* field + two-key sort (override legible & reversible) | **(b)** fold the override into the score as an offset | **High** — every surveyed tool keeps the override out of the score |
| **2 · readiness** | **(a)** a hard eligibility gate (only ready items are pullable) | **(b)** readiness as one more weighted factor | **High** — an agent sent at a blocked item wastes a real build |

## Fork 1 — how does a human override compose with the computed score?

**Fork-existence:** real either/or — the human's manual priority is *either* a separate sort key applied around the score, *or* it is folded into the score as a numeric offset. Exactly one ordering results; the two cannot both define "the override." Both are coherent (both produce an order), so it is a genuine design fork, not a forced invariant.

- **(a — recommended) A separate `tier` field + two-key sort.** Order = `(tier, computedScore, rank)`. The human pins an item to a tier (`pinned / normal / someday / won't`); the score only orders *within* a tier; the manual rank breaks ties inside that. The override is legible ("it's pinned") and reversible (un-pin) without reverse-engineering a number.
- **(b) Fold the override into the score.** Add a manual `+N` offset (or a "boost") to the computed score; a single number sorts everything. Simpler data model (one sort key), but the survey's uniform warning: a blended fudge factor is opaque (why did this jump?) and hard to undo cleanly — you can't tell the machine's opinion from the human's after the fact.

**Default: (a).** Every surveyed tool that has both keeps the override *out* of the score (Linear micro-adjust within a tier; Jira Rank ≠ Priority; Productboard / Jira-PD score sorts but a human still reorders). For an autonomous system the legibility of the override is the trust anchor — you must always be able to see and undo why the machine will build X next. (b)'s one merit (single sort key) is not worth the opacity.

**Code shape.**
```js
// (a) two-key sort — the override is a field, not a number in the score
next = ready.sort(by(tier /* pinned>normal>someday */), then(effectiveScore, 'desc'), then(rank))[0]
// (b) blended — override is an offset inside the score (opaque, discouraged)
effectiveScore = computedScore + manualBoost   // why is it high? can't tell machine vs human
next = ready.sort(by(effectiveScore, 'desc'), then(rank))[0]
```

## Fork 2 — is readiness a hard gate or a weighted factor?

**Fork-existence:** real either/or — an unready item (deps unmet / parked / spec ambiguous) is *either* ineligible to pull at all (hard gate) *or* eligible but pushed down by a low readiness score (soft factor). The two give different behavior for the same item and cannot both hold. Leans forced-invariant: an autonomous builder pulled onto a blocked item burns a real build (spend + a failing PR).

- **(a — recommended) Hard eligibility gate.** `next` is computed only over items that pass readiness (open, `blockedBy` all resolved, not parked). An unready item never gets pulled, regardless of score. Mirrors the filter-then-sort model (GitHub / Notion views; Shortcut groups by workflow-state before rank).
- **(b) Readiness as a weighted factor.** Readiness contributes a term to the score; a very high-value unready item could still surface near the top. More "flexible," but for a machine that acts unattended it invites building something that can't be built — the failure the gate exists to prevent.

**Default: (a) hard gate.** Readiness is a fixed primitive, not a tunable weight — the queue's whole point is "what can be built *now*." (b) only makes sense if a human, not an agent, consumes the ordering (they'd judge the unready item themselves); since the consumer here is autonomous, the gate is the safe invariant. If a human-facing "what's important regardless of readiness" view is wanted, that is a *saved view*, not the builder's queue.

## Open / deferred

- **Skeptic + two-confusion screen not yet run** — this card is authored open for review, not stamped `preparedDate`. Once reviewed, run `/prepare 2526` to attack the two defaults and stamp it ready-to-ratify.
- **Program go/no-go is separate.** Whether we build the build-queue program at all is the priority call in the reframed #2525; these design forks only bind if that is greenlit.
