---
bornAs: xu92z8m
kind: story
size: 3
parent: "2753"
status: open
dateOpened: "2026-07-28"
scope: ["we:scripts/lib/decision-routing.mjs", "we:scripts/conveyor/decision-route.mjs"]
relatedTo: ["2704"]
tags: [conveyor, decision, ratification, shadow, session-free]
---

# Shadow→enforce flip for decision auto-ratification

#2704 mechanized the conveyor's decision auto-disposition / auto-ratify, but it runs in **shadow only**: the disposer in [we:scripts/lib/decision-routing.mjs](../scripts/lib/decision-routing.mjs) logs the *would-ratify* (a ledger entry / card comment, `apply:false`) while a human still confirms. Nothing tracks turning it on. This item **defines and gates the shadow→enforce flip** so decision ratification can run with no session in the loop — the last human-in-the-loop step that keeps a session pinned to the conveyor's decision flow. It does not build a new disposer; it defines *when* the existing one is allowed to flip `apply:false → apply:true`.

## Why this is on the session-free critical path

The parent epic's target is: a session does only queue + expose-state. #2704 removed the human from *clear* decisions in principle, but only in shadow — a human still confirms every auto-ratification, so a session (or a human) is still required in the decision loop. Until the enforce flip is defined and its trigger met, decisions can't ratify session-free. This is the decision-flow analogue of the PR-review shadow→enforce seam (#2675 `LAND_MODES`), and it deliberately mirrors that shape rather than inventing a new one.

## Scope of this item

1. **Define the flip.** A one-line `enforce` ruling behind the existing `we:scripts/lib/decision-routing.mjs` disposer + the #2675 `LAND_MODES` knob — the flip is `apply:false → apply:true` for a converged ruling, exactly the seam #2704 left as "a separate later ruling."
2. **Gate it on a concrete, tracked trigger** (below) — not an open-ended "later."
3. **Wire the divergence metric** the trigger reads: the shadow ledger already logs each would-ratify; this compares it against the human's actual ruling and tracks agreement vs divergence per decision.

## The un-defer trigger (deferral discipline)

This item carries a **concrete tracked trigger**, not an indefinite defer:

> **Enforce-flip fires once N consecutive shadow auto-ratifications match the human ruling with zero divergence over the trailing window of M decided decisions.** Starting proposal: **N = 20 matches with 0 divergences** over the trailing window. A *single* divergence (shadow would-ratify ≠ human ruling) resets the counter and blocks the flip until the streak rebuilds — the confidence bar is agreement, not volume alone.

The exact N/M and the "match" predicate (identical ruling vs. same disposition class) may be **refined** during the build, but the item MUST ship with a concrete tracked trigger read off the shadow-vs-human divergence ledger — never a bare "flip it when we're comfortable." The metric is the gate; the flip is mechanical once the gate is green.

## Acceptance

- The shadow ledger records, per decided decision, whether the shadow would-ratify matched the human ruling (match / divergence).
- A named metric answers "how many consecutive matches, zero divergences, over the last M?" and is readable without a session.
- The flip from `shadow` to `enforce` is defined as a one-line ruling gated on that metric crossing the trigger — and blocked (counter reset) by any divergence.
- Reuses the #2704 disposer and the #2675 `LAND_MODES` seam — no second disposer or auto-ratify engine is built.

locus: we
