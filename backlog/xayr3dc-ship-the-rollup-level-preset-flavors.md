---
kind: story
size: 3
status: open
parent: "2690"
blockedBy: ["xarvjgf"]
scope: ["we:src/_data/backlog.js"]
dateOpened: "2026-09-06"
tags: [rollup, backlog-model, config, presets]
crossRef: { url: /backlog/3123-name-the-tier-above-feature-rollup-basis-points-vs-outcome-m/, label: "the ruling that authorized presets" }
---

# Ship the rollup-level preset flavors

#3123's ruling has Web Everything ship **presets** over the open-set level dimension, so a project picks a
flavor rather than authoring a hierarchy from nothing. A default-less core is only usable once at least one
flavor exists — this is that half.

## The presets to ship

The three bases #3123 considered become flavors rather than rivals: a **points-rollup delivery grouping**
(reuses the canonical `throughput()`/`rollUp()` aggregation, so the tier reports the unit every lower tier
reports and composes with the velocity-derived forecast), a **time-boxed bet** with its own progress measure,
and an **outcome-attainment** flavor rolling up weighted contributions. Each is a legitimate end-state; the
ruling's point is that a project chooses, not that one wins.

## The naming constraint, which survived the dissolution

The lexical collision with the ratified `we:docs/agent/backlog-workflow.md#program-definition` did not go away
when the fork dissolved — it **moved**. `Program` is now a preset name rather than a `kind` enum value, and a
flavor shipping under that word still collides with the statute's term. **Name around it.** #3123's option (d)
was authored for exactly this reason and its reasoning carries over: the label can decouple from the
aggregation basis, so a flavor may carry points-rollup semantics under a collision-free name.

## Not in scope

**Which flavor Web Everything runs for its own constellation is the operator's call, on merit**, and is
deliberately excluded here. Shipping the flavors and choosing among them are different acts; conflating them
is how a preset quietly becomes a default the core was ruled not to have.

## Done when

1. **Executable** — each shipped flavor is selectable by a project config `extends` and produces its declared
   rollup, proven by a fixture per flavor.
2. No flavor name collides with a ratified statute term; a check pins the `#program-definition` case
   specifically, since that is the one already known.
3. Selecting no flavor leaves the core default-less rather than silently falling back to one.
