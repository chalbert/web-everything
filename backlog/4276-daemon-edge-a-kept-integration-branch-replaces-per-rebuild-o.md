---
bornAs: x59tqsg
kind: epic
parent: "4075"
status: open
dateOpened: "2026-09-27"
tags: [conveyor, daemons, daemon-edge]
---

# daemon-edge: a kept integration branch replaces per-rebuild overlay re-merging for the WE daemons

Daemon clones re-merge every overlay from scratch each rebuild (we:scripts/lib/daemon-rebuild.mjs planRebuild); a clash drops or freezes the overlay and nobody resolves it (4 hand swaps on 2026-09-26/27). Replace with a kept origin branch daemon-edge: each fix PR merged in once, clashes resolved once by a dispatched resolver, main merged in every tick, closed PRs reverted, daemons adopt an edge head only after a dry-run shadow phase.

Design agreed with the operator 2026-09-27 (Sat/Sun approval). This card is the design note.

## Why the overlay list fails

The daemon clones (`wev-review-daemon`, `wev-health-watch`, `wev-merge-daemon`) rebuild each tick from
`origin/main` plus an overlay list (we:scripts/lib/daemon-overlays.mjs, we:scripts/lib/daemon-rebuild.mjs).
The merged result is never kept. So:

- Every rebuild re-does every overlay merge from zero.
- When two overlays clash, or one clashes with main, the rebuild drops one. A pinned one freezes the clone instead.
- Nothing ever resolves the clash. It comes back every tick until a person swaps overlays by hand.

On 2026-09-26/27 the orchestrator did that swap by hand 4 times.

## The design

A branch `daemon-edge` on origin that is **kept**. Its tip = main + every registered daemon-fix PR, with any
clash resolved once and kept.

- **Register.** `daemon-overlay add` becomes "register the PR for edge". It first runs an admission check. The
  check merges the PR head onto main and onto edge in the object store, with no checkout. A clash with **main**
  means the fix must be rebased first, so it is refused unless `--force`. A clash with **edge** only means
  another fix touches the same lines. It is admitted, and the tick records the clash as owed.
- **Edge tick** (every rebuild tick, mechanical):
  1. Merge main into edge.
  2. Merge each registered PR's head in, if it is not already there. A moved head gets its new commits merged.
  3. A PR merged on main becomes a no-op on the next main merge, then is retired.
  4. A PR closed unmerged is reverted out of edge (a `revert -m 1` of the commit that brought it in).
  5. Any clash (main→edge, PR→edge, revert) becomes an **owed resolution**. It is never dropped.
- **Resolver** (slice 2). One dispatched agent per owed resolution. Brief: merge the two sides keeping both
  intents, run the selected gate, push to `daemon-edge` with a lease. The next tick sees the PR head inside edge
  and clears the debt by itself.
- **Shadow** (slice 3). Before a daemon adopts a new edge head, that head runs 2–3 real ticks in DRY-RUN beside
  the live daemon: reconcile plan, dispatch plan, drain plan. The plans are diffed against the live daemon's.
  Flags: "refuses everything", "dispatches nothing", "more than N new dispatches". The head is adopted only if
  clean.
- **Adopt** (slice 4). Daemons build from the latest shadowed edge head, not main + overlays. The existing
  live smoke and fallback to last-good stay.

## State machine (per registered PR)

```
register ──admission──▶ registered ──tick merge──▶ merged-to-edge ──shadow clean──▶ shadowed ──daemons run it──▶ adopted
     │                       │                          │                                                        │
     │ clash with main       │ clash                    │ PR merged on main ──────────────────────────────────▶ landed-on-main ──main merged into edge──▶ retired
     ▼                       ▼                          │
  refused               owed-resolution ──resolver pushes──▶ merged-to-edge
  (unless --force)           │
                             └── PR closed ──▶ retired (never in edge)
merged-to-edge ── PR closed unmerged ──▶ reverted (revert clash ⇒ owed-resolution)
```

`shadowed` and `adopted` are really properties of an edge HEAD, not of a PR. A PR is "shadowed" when an edge
head that contains it passed shadow. Slices 3/4 record them per head. Slice 1 never writes them.

## Failure modes and bounds

| Failure | What happens | Bound |
| --- | --- | --- |
| PR clashes with edge | owed-resolution, PR stays registered, other PRs still merge | one resolver per debt (slice 2), retry cap, then notify |
| main clashes with edge | owed-resolution; PR merges still land on the current tip | same; the edge is stale vs main until resolved, so slice 4 must fall back to main + last-good if the debt is older than a max age |
| Resolver pushes while a tick is planning | the tick's push loses its `--force-with-lease`; nothing overwritten; next tick re-plans | one lost tick |
| PR closed unmerged | revert of its introducing commit; revert clash ⇒ owed | same as a clash |
| Too many unlanded fixes in edge | soft warning above 4 (`EDGE_SOFT_CAP`) | warning only, never a refusal |
| Unknown PR state (`gh` down) | treated as OPEN: never reverted or retired on an unknown | — |
| A bad edge head | shadow (slice 3) refuses it; live smoke + last-good still guard adoption | 2–3 dry-run ticks |
| Ledger file corrupt | tick and register refuse; never overwritten | person inspects |
| Edge drifts far from main (merge history piles up) | an owed main-merge that sits is the signal; last resort is to re-cut edge from main + open PRs (a new card, not automatic) | — |

Every commit the tick mints has the old tip as first parent, so the push is always a fast-forward. Commits use
the fixed rebuild identity and the later parent's date, so the same inputs mint the same sha.

## Migration from overlays

1. Slice 1 (this epic's first child): the edge maintenance code, behind `WE_DAEMON_EDGE` (default OFF). Flag off,
   nothing changes. The overlay list keeps working exactly as today.
2. Slices 2 and 3 run beside the overlay mechanism, still flag-gated. The edge is built and shadowed but no
   daemon runs it.
3. Slice 4: import each clone's overlay list into the edge ledger once (one registration per overlay with a PR).
   Wire the edge tick into the rebuild tick. Switch the clone build source to the shadowed edge head. Keep smoke
   and last-good.
4. After a soak with the flag on, flip the default. Retire the overlay list code in a later card.

The real `daemon-edge` branch on origin is created only when the flag is first turned on (the tick bootstraps
it at main).

## Slices

| Card | What | State |
| --- | --- | --- |
| 4277 | Slice 1 — edge maintenance planner + IO shell + CLI, flag default off | this PR |
| 4279 | Slice 2 — resolver dispatch for owed resolutions | open, blocked by slice 1 |
| 4278 | Slice 3 — shadow runner (dry-run ticks, plan diff, divergence flags) | open, blocked by slice 1 |
| 4280 | Slice 4 — adoption switch + overlay migration + wire into rebuild tick | open, blocked by 2 and 3 |

## Done when

1. **Executable** — all four slices resolved; with `WE_DAEMON_EDGE=1` on the three daemon clones, two clashing
   daemon fixes both stay in the running daemons' tree after one resolver pass, with no hand swap.
