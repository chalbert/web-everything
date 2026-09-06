---
kind: decision
status: open
dateOpened: "2026-09-06"
tags: [cost, dispatch, multi-provider, conveyor, decision]
relatedReport: reports/2026-09-06-token-optimisation-research.md
---

# Effort dial or model cascade — rule how agent work economizes

Two open items assume opposite answers. **#3369** motivates a multi-provider abstraction partly on *"every task
pays for the same tier of model regardless of how hard it actually is"*; the token-optimisation research
concludes that on the **cost axis** routing across models is the weaker lever, because **caches are
model-scoped** and a cascade forfeits cross-model reuse. This card carries the fork so neither item buries it.

## Why it is a real fork, not a preference

It gates work in both directions, which is unusual enough to be worth stating:

- The 2026-09-06 **split** analysis reached it by carving #3006 and finding this was the one thing that could
  not be sliced away.
- The 2026-09-06 **consolidation** analysis reached it from the opposite direction — #3006 and #3369 cannot be
  grouped while an unresolved fork sits between them.

Two skills run independently, pointing opposite ways, converged on the same next action. That agreement is the
argument for ruling it before either proceeds.

## The options

**A — Effort tier inside one model (the research's recommendation on cost).**
Anthropic measured running everything at `low` effort with re-run-on-failure at **~93% pass for ~$0.70/task
versus 91.7% at $1.39** — same quality, half the cost, *counting the wasted cheap attempts*. It needs a cheap
failure signal, which this repo's review path has. Crucially it keeps one model and therefore **one cache
namespace**. The cascade literature is also weaker than its reputation: a lightweight pre-generation router
beat the best cascade policy on 4 of 5 datasets, and routers trained on oracle labels collapse to
majority-class prediction under shuffled-label controls.

**B — Route across models/providers.**
Buys what A cannot: **provider redundancy**, **reviewer diversity** (reviews today carry one model's blind
spots), and throughput beyond one subscription's usage window. These are #3369's actual motivations and they
are *not* cost arguments — which is the substance of the fork. If B wins, the cache cost is a known price, not
an oversight.

**Recommended default: A on the cost axis, without prejudice to B on the diversity and resilience axes.** The
two may not conflict — #3369 could proceed on redundancy grounds while cost tiering happens via effort. Ruling
this explicitly is what unblocks both.

## Premises and their limits

Grounding is at [token optimisation](/research/token-optimisation-research/). The sourcing caveat there is
load-bearing and applies here: several primary domains were egress-blocked during that research, so Anthropic
figures are first-party but much of the rest is search synthesis. **Re-verify the two measured claims above
before ratifying.**

## Done when

The fork is ruled and recorded, #3369's body points at the ruling instead of asserting the tiering premise, and
#3006's remaining cost scope is either folded into #3369 (if B) or closed out as effort-dial work (if A).
