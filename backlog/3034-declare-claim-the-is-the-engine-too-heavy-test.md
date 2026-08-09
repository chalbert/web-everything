---
bornAs: x65hozr
kind: story
size: 2
parent: "3029"
status: open
blockedBy: ["3032"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
scopeRationale: "Adds one declaration file to the new operations directory; the exact filename does not exist yet."
tags: [plateau-loop, delivery, operations, claim]
---

# Declare claim — the is-the-engine-too-heavy test

An operation with **no model step and no human step**: `compute` and `effect` only. Claiming an item reads
ownership state and writes a status change; there is no judgment in it and nobody to ask.

## Why it is worth declaring something this small

This is a deliberate probe, not filler. The risk [#3029] is managing is that engines over-abstract, and the
failure is silent — every operation fits, each one slightly badly, and four kinds quietly becomes seven. The
cheapest way to catch that is to run the smallest possible operation through the machine early: **if declaring
`claim` feels like ceremony, the engine is over-built and we learn it here**, on two points, rather than on the
fifth conversion.

A concrete thing to watch: `claim` has a real invariant that ownership is `status: active`, **not** git state — an
uncommitted working tree is never a reason to drop a claim. That invariant belongs in the pure core. If expressing
it in a declaration is awkward, that is a finding about the engine, and it should be written down rather than
worked around.

## Acceptance

`claim` runs through the declared operation from the **command-line** caller, with the ownership invariant
enforced in the pure core. The HTTP caller is deliberately *not* an acceptance criterion here — it arrives with
[#3036] and, if the epic's claim holds, needs nothing from this slice — which is why this item is blocked only
on the engine and stays independently landable. **The slice is not done until it records a verdict on the probe** — one
paragraph on the item saying whether the declaration felt proportionate, and if not, exactly what was heavy. A
green build with no verdict recorded misses the point of the slice.
