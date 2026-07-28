---
kind: story
size: 5
parent: "2606"
relatedTo: ["2745"]
status: open
dateOpened: "2026-07-28"
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/lane-pool.mjs
tags: [conveyor, drain, lane, plateau-loop]
---

# on-land cleanup: release lease + resolve card when the drain lands a PR (+ reaper backstop)

Hang lane-lease release AND the item's active→resolved card-flip off the DRAIN's terminal land event (the authoritative serial merge), not the delivery agent's exit — plus a lane-pool reaper that reclaims provably-dead leases on acquire. Generalizes the conveyor-only #2667/#2700 pr-watch version to cover EVERY land path (conveyor, solo /pr, /finish). Kills the ghost-lane / stale-open-card / wasted-stale-re-dispatch family at its shared root.

## Problem — one root cause behind a family of recurring bugs

Post-land cleanup today hangs off the **delivery agent's exit** (or a conveyor-armed `pr-watch` that only exists for conveyor-launched PRs). That coupling is the shared root of three recurring problems:

- **Ghost lanes** — a lease sits on disk holding its lane after its work is done or its agent died. The conveyor status board (via the now-live `assessHealth` / stall scan, #2616/#2700) only *flags* these as ghosts; nothing *acts* on them until a human sweeps or the TTL expires.
- **Stale-open cards** — an item whose PR has landed still reads `status: open`/`active` because the resolve flip depended on the producer authoring it into the PR body (or a manual resolve-sweep after merge). When that path is missed, the card lies about being done.
- **Wasted stale re-dispatches** — the dispatcher sees a still-open card and/or a still-held lease and re-dispatches or blocks unrelated work behind a lane that is, in fact, finished.

All three vanish if cleanup instead hangs off the **PR's terminal land event** — the moment the drain merges the ref. The drain is the single serial writer to `main` and the authoritative merge point for **every** land path (conveyor delivery agents, solo `/pr`, `/finish`), so it is the natural, universal owner of on-land cleanup.

## The fix — three parts

1. **release-on-land** — when the drain merges an item's PR (couple), it releases the lane lease held for that item's session, in **every pool** the item acquired (cross-locus couples hold a lane in both the WE and impl pools). The owning session slug is derivable from the item→PR mapping the drain already computes at land (`conveyor-<num>` for a conveyor build; the drain already knows the item number and its lane refs from the queued manifest). Reuse the pool-aware by-session release delivered in #2667 (`lane-pool release --all-pools --session=<slug>`) — this item just invokes it from the drain's land path instead of from the conveyor's `pr-watch` watcher, so it fires no matter who launched the PR.

2. **resolve-on-land** — the drain flips the item's card to `status: resolved` from the PR it just landed, as part of (or immediately after) the WE-last resolve-carrying merge. This makes the drain's own land event the authority for the flip and **removes the reliance on a separate/manual resolve-sweep** and on the producer having pre-authored the flip. Keep the existing WE-last ordering and the `resolveReachableFromBody` frontmatter-strict guard (#2603/#2455) so a failed impl merge never leaves a false `resolved` (#96). The `unqueue` single-clear-point stays exactly where it is — this item makes the resolve flip ride the same terminal event.

3. **reaper backstop** — `lane-pool` reaps a **provably-dead** lease on the next `acquire` (and/or a periodic sweep): a lease whose item is already merged/resolved, or whose PR is open, with no live owner. This covers the orphans the drain path can't (the agent died *before* opening/landing, so there was never a land event to hang release off). This is exactly the state the conveyor status board currently only *flags* as a ghost (#2616/#2700's health/stall scan) — this makes the **pool act on it**, not just report it. Build on the reaper primitive from #2667 (`we:scripts/conveyor/lease-reaper.mjs` — `classifyReap`/`reapPlan`), but wire the "provably-dead" axes (item merged/resolved; PR merged/closed) into `lane-pool acquire` so reclamation is native to the pool and needs no separate tick to run.

### Safety invariants (unchanged)

- **Never reap a reserved lease** (permanent-memory holds) — carry #2667's reserved-lane skip.
- **Never reap a lease that only *looks* idle** — a freshly-acquired, mid-claim lane with no diff yet is not dead (the #2267 data-loss hazard). Reap only on a *positive* death signal (item resolved/merged, PR closed), never on absence-of-activity alone.
- **Resolve stays WE-last and frontmatter-strict** — the drain must not flip a card whose impl half failed to land.

## Relationship to prior work (predecessors, not duplicates)

- **#2667** (RESOLVED) delivered the *mechanisms*: pool-aware by-session release, the reaper primitive `we:scripts/conveyor/lease-reaper.mjs`, and `pr-watch --release-session`. But release fires from the **conveyor's `pr-watch`** — a watcher that only exists when the conveyor armed it — and the reaper is a **standalone script** the conveyor tick must run. It explicitly deferred anything beyond that.
- **#2700** (RESOLVED) wired those into the **conveyor SKILL tick** (arm `--release-session`, run the reaper each tick, consume `state.health`). Still conveyor-scoped.
- **This item** relocates release to the **drain's land event** (so it covers solo `/pr` and `/finish`, not just conveyor PRs), **adds the drain-owned resolve-on-land flip** (which neither predecessor did), and makes the reaper **native to `lane-pool acquire`** (so no separate tick is required). It is the generalization from "conveyor cleans up its own launched PRs" to "the authoritative merger cleans up whatever it lands."

## Ownership note (design decided, recorded for the record)

There is a live-looking fork — *which process owns release/resolve: the drain, a conveyor-side post-land hook (#2667's `pr-watch`), or the lane-pool reaper?* This item takes the position that the **drain owns it** because the drain's merge is the one terminal event common to every land path; the conveyor `pr-watch` release (#2667) becomes the **redundant/narrow** case (safe to keep as a fast-path or retire), and the **reaper is the backstop** for the no-land-event orphan only. Baked in as a plain story rather than a separate `type:decision` because the terminal-event argument makes the drain the unambiguous owner; if implementation surfaces genuine contention (e.g. the drain can't cheaply derive the session slug for a non-conveyor land), carve the ownership question out as a decision sub-card then.

## Done when

- The drain, on landing an item's couple, releases that item's lease across every pool it held and flips the card to `status: resolved` from the landed PR — no manual sweep, no dependence on the delivery agent's exit or a conveyor watcher.
- `lane-pool acquire` reclaims a provably-dead lease (item merged/resolved, or PR merged/closed) before allocating, so a ghost never blocks a fresh dispatch and the board's ghost flag has a matching act.
- Reserved leases and mid-claim lanes are never reaped; resolve stays WE-last and frontmatter-strict.
- `npm run check:standards` green.
