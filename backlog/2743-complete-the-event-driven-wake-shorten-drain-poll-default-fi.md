---
bornAs: xs9t6l5
kind: story
size: 2
parent: "2606"
status: open
blockedBy: ["2605"]
dateOpened: "2026-07-27"
tags: [conveyor, delivery, drain, drain-daemon, wake]
---

# Complete the event-driven wake: shorten drain poll default + fire /nudge on PR-ready

Deliver the WAKE half of the ratified **#2692** (event-driven land is WAKE-only —
[we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)):
shorten the drain-daemon poll default (60s → ~5–10s) and wire the just-landed **#2605** `POST /nudge` to fire on a
PR-reaching-ready event, so the **one** polling writer wakes near-instantly — **no second writer, no fence**. This is
the cheap immediate win #2692 sanctioned independent of the deferred merge-queue build (which stays gated behind
tripwire #2740).

## What remains (the seam is mostly already there)

- **#2605 (landing) delivered the seam** — the drain-daemon `POST /nudge` (coalescing) + `GET /events` SSE + the
  `nudge` / `watch` CLI verbs. And **#2683 (resolved)** already fires the single-PR fast-drain from the conveyor's
  `we:scripts/conveyor/pr-watch.mjs` on the `isReadyToLand` (CI-green ∧ non-author sign-off) transition.
- **This item closes the daemon-side remainder:**
  1. **Shorten the drain poll default.** Lower `plateau:tools/drain-daemon` `DEFAULTS.intervalSec` from `60` to
     ~5–10s (one constant). The interval floor **stays** — push is an accelerator, not a replacement (#2605).
  2. **Fire `/nudge` on a PR-reaching-ready event.** Wire the daemon's own `POST /nudge` to fire when a PR reaches
     the last land-precondition (whichever of {CI-green, review-sign-off} completes last — the #2683 predicate), so
     the resident writer wakes on the event rather than only on the next poll tick, for PRs that arrive by any path
     (a hand-applied label, a producer that never nudged), not just the in-conveyor watcher.

## Invariants held (from #2692's ruling)

- **One logical writer.** The wake only shortens the perceived poll gap; it never adds a second writer or a fence.
  The full merge-queue build (speculative merge-commit + per-step CAS guards + batching) stays **deferred** behind
  the measured `land-serialization` saturation tripwire #2740 — this item does **not** touch it.
- **Authority ≠ serialization.** The nudge triggers the daemon's own land path; the pre-land gate is still
  re-derived server-side (`we:scripts/lib/pr-merge-gate.mjs`). A nudge is a wake signal, never a trusted land order.

## Definition of done

- Drain-daemon poll default is ~5–10s with the interval floor intact.
- A PR reaching its last land-precondition fires `/nudge` (the resident writer wakes on the event, not only the tick).
- No second writer / no fence introduced; the deferred build gate (#2740) is untouched.

## Lineage

Builds on #2605 (drain-daemon `/nudge` seam, landing) and #2683 (conveyor fast-drain trigger, resolved). Delivers
the WAKE half ruled ship-now in decision #2692 (codified
[#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)). Program #2606
/ epic #2612. Latency lever; whether it moves #2606 throughput is provisional on #2680's serial-land-vs-wall-clock
regime finding (same caveat as #2683).
