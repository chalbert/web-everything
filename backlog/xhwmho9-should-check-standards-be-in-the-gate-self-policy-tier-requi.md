---
kind: decision
parent: "2445"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, governance, gate, trust-chain]
---

# Should check-standards be in the gate-self / policy tier (require review:human)?

From the dry-run, editing the standards gate script [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) only scores `blast-radius` → `review:pending` (agent-reviewable, clearable by an agent), **not** `review:human`. So an agent can weaken the gate with only agent-review. Should the gate script itself join the gate-self / policy tier, so any change to it requires a human?

## The gap (from the dry-run)

The gate-self / policy tier (`isGateSelfPath`, [#2448](/backlog/2448-re-anchor-the-gate-self-trust-chain-when-the-delivery-engine/)) covers the **transport / lander** — `we:scripts/pr-land.mjs`, `we:scripts/lane-drain.mjs`, `we:scripts/lane-pool.mjs` — the things that could subvert **landing**. It does **not** cover the gate script that defines **what** is validated. So editing [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) — the standards GATE — scores only `blast-radius`, which lands at `review:pending`: agent-reviewable, and clearable by an agent. An agent can therefore soften or remove a check in the gate that decides what "green" means, and clear its own review, with no human in the loop.

## Forks

- **(a) Add the gate to the gate-self path.** Put [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) (and its rule/LOCI config — e.g. `we:scripts/check-standards-rules.mjs` / the loci config it reads) under `isGateSelfPath`, so any change to the gate escalates to `review:human` — a human must approve any edit to the gate. **Bold default IF we treat "the gate itself" as trust-core**: the definition of "green" is exactly the thing an autonomous builder must not be able to move on its own.
- **(b) Leave as-is.** The write-time `PreToolUse` hooks plus the gate's own tests already guard its behaviour, and `blast-radius` → `review:pending` is a proportionate review level. Adding `review:human` to every gate edit adds friction to routine, legitimate gate work (new lints, rule tweaks) that the existing guards already cover.

## Tradeoff

Defense-in-depth (a) vs review friction (b). (a) closes the "agent weakens the definition of green and self-clears" hole by construction — the same argument #2448 used for the transport/lander — at the cost of a human gate on all gate edits. (b) trusts the existing write-time hooks + gate tests to catch a bad gate change, keeping gate work fast.

**Lean: (a), for defense-in-depth** — the gate that defines what is validated is as trust-core as the lander that defines what gets landed; a self-modifiable gate is the weakest link in an autonomous loop. Left **OPEN** for the human to ratify.

Refs [#2448](/backlog/2448-re-anchor-the-gate-self-trust-chain-when-the-delivery-engine/) · [#2307](/backlog/2307-producer-tags-the-review-escalation-label-at-pr-open-determi/) · [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinator/).
