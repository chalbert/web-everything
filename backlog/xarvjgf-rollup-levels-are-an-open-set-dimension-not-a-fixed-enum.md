---
kind: story
size: 5
status: open
parent: "2690"
scope: ["we:src/_data/backlog.js", "we:scripts/readiness/velocity-metrics.mjs"]
dateOpened: "2026-09-06"
tags: [rollup, backlog-model, config, standards]
crossRef: { url: /backlog/3123-name-the-tier-above-feature-rollup-basis-points-vs-outcome-m/, label: "the ruling that dissolved the fork" }
---

# Rollup levels are an open-set dimension, not a fixed enum

#3123 was ruled on 2026-09-06 by dissolving its fork: the tier count is **an open number configured per
project**, each level carrying its own attributes including its **rollup basis**. This is that contract.

## What the ruling settles, so this build does not re-open it

Points-rollup, bet-progress and outcome-metrics are all **legitimate end-states**, not rival branches — per
`#config-extends-platform-default`, a concern with more than one legitimate end-state is a configurable
dimension and never a baked mechanism. So no level vocabulary is hard-coded here, and the core stays
**default-less**: values arrive from a project config that `extends` a platform flavor.

The realization shape is already ratified rather than invented: #1662 establishes that **an open-set dimension
*is* a `CustomRegistry` subclass**, with per-dimension storage carrying its own `extends`-to-flavor chain.
Follow that shape; do not mint a parallel mechanism for levels.

## The constraint that decides whether this is built correctly

#2690's claim is that *"the tree generalizes upward with zero new visual language — a higher tier is just
another indent + rollup level."* #3123's fork-existence justification argued a per-level basis would force
*"the renderer to branch per tier"*, which would break that claim.

The ruling's answer, and this build's acceptance bar: the basis is a **declared per-level field**, so the
renderer resolves it through **one data-driven code path**. A renderer that grows a `switch` on tier name — or
any per-tier special case — has re-introduced precisely what #2690 forbids, and fails this item even if the
output looks right.

## Done when

1. **Executable** — a project config declaring three levels and a project declaring five both render and roll
   up correctly with no code change between them, and a test asserts a level's rollup basis is read from the
   declared field rather than inferred from its name or depth.
2. The renderer contains no per-tier branch: a test pins that adding a level with a novel name needs no
   renderer edit.
3. The core carries no default level set — the values come from an `extends` chain, per #1662.
