---
bornAs: x7v8jvr
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, conveyor, scope-lease, status-board]
---

# Conveyor lease-collection counts empty/stale leases (finished-agent lanes read as running)

The live scope-lease collector counts a **held-but-empty lane** as an active lease, so the conveyor's status view reads a *finished* agent's un-released lane as still "running" and over-counts the active lanes. An empty lease holds no scope, so it should not count.

**From the dry-run.** [`we:scripts/readiness/scope-lease-collect.mjs`](../scripts/readiness/scope-lease-collect.mjs) walks the live lane pool and, per held lease, reads its git diff and status to assemble the `leases` array the observer consumes. A lane whose agent has **finished but never released** — no diff, no `git status` change, no claimed backlog item — still holds a live lease marker, so the collector emits it as an active lease. Downstream, `we:scripts/readiness/conveyor-state.mjs` and the status-board's lane derivation then render that finished-agent lane as **running** and inflate the active-lane count that the dispatcher and the board both read.

**Why it's wrong.** An empty lease holds **no scope** — it is not contending for any file and is doing no work. Counting it as active is a false positive on two axes: the board misreports occupancy, and the active-lane count (which the dispatcher's concurrency ceiling reads) is inflated by ghost lanes.

**Fix.** Drop leases with **no observed scope and no claimed item** from the collected picture — either in `scope-lease-collect` (don't emit a zero-scope, zero-item lease) or in the board's lane derivation (don't render one as running). Prefer the collector, so every consumer sees the same de-ghosted set. This lines up with the earlier serial-floor-era note that an **empty lease shouldn't block dispatch** — the same "empty holds nothing" principle, applied to the *count* as well as the *gate*.

Refs the status-board ([#2613](/backlog/2613-the-conveyor-skill-command/)) and the scope-lease engine ([#2560](/backlog/2560-scope-lease-and-conflict-policy-engine/)).
