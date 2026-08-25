---
name: full-concurrency-is-the-default-never-a-cost-judgment
description: When the operator asks for work, run it at FULL concurrency, bounded only by scope (file/resource disjointness) — never serialize to economise on spend. The cost-vs-parallelism tradeoff is the operator's call and has already been made. Recall before deciding to run something "one at a time", stagger spawns, or wait for a job to finish before starting an independent one.
metadata:
  type: feedback
---

**Never throttle work to save money.** An ask for work is an ask for it at full concurrency. The only
legitimate limiter is **scope**: two tracks must not share files, a lane, or another exclusive resource.
Money is not a limiter and never was; the operator has already priced it.

**Why:** 2026-08-25, running independent PR reviews, I said I would delay one "to keep concurrent cost
sane". The operator: *"it is not up to you to evaluate the cost vs concurrency. If I ask for work, it always
means use full concurrency (taking scope in consideration). I do not want to have to repeat again."*

Three things made it wrong, not merely over-cautious:

1. **It was not my decision to make.** Spend is the operator's budget and their call. Silently trading their
   throughput for their money — without saying so, and while they were waiting — substitutes my judgment for
   theirs on a question they had already settled.
2. **The stated reason was false.** Asked whether it was a file conflict, it was not: the two reviews touched
   entirely disjoint cards in different lanes. "Cost" was the real reason and it was unexamined.
3. **The repo's own guidance says the opposite.** `we:docs/agent/delivery-loop.md` → *Parallelism and lane
   hygiene*: run tracks concurrently on disjoint files. The gate is the bottleneck, so wall-clock per track
   degrades while **total throughput improves**. Serializing disjoint work buys a slower answer and nothing
   else.

**How to apply:** before starting an independent piece of work, ask ONLY *"does this share files, a lane, or
another exclusive resource with something already running?"* If no → start it now, in parallel. Do not wait
for an in-flight job to return, do not stagger spawns, and do not reason about token or dollar cost at all.
Applies to review spawns, prepare/build dispatches, panels, and lane work alike.

If concurrency ever does need bounding for a real reason — a genuine resource limit, a rate limit, an
exhausted lane pool — **say so and name the resource**, rather than quietly running fewer things. And if
cost genuinely looks like it matters, that is a question to ASK, not a decision to take.

Scope-checking still matters and is the whole of the judgment left to me: see
[[shared-pool-lane-unsafe-for-manual-work]] and [[104-edit-work-runs-in-a-lane-clone]] for what "disjoint"
has to mean in this repo.
