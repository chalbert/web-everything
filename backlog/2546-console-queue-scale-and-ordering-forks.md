---
kind: decision
size: 3
parent: "2505"
status: open
dateOpened: "2026-07-18"
tags: [plateau-loop, console, console-board, queue, ordering, design-forks]
---

# Console queue scale & ordering forks

Ordering/scale rulings the mock deferred (design doc §3f/§3g "decisions needed before build"). They shape how
the board renders and launches at real WE throughput, so they gate the board slices [#2550]. Serves G1 (at
scale) and G3 (parallel-safe launch). NOT prepared.

## Forks
- **DAG frontier render rule** — with hundreds of items, what renders on the board vs folds (the frontier =
  the next-actionable set; deeper chains collapse). Sets what C1/C5 draw.
- **Cleared-set ordering** — once a set is cleared for build, is the order FIFO, by score, or operator-pinned?
  (Distinct from prioritization #2526, which orders the *ready* set; this is the *cleared-to-run* order.)
- **Wave vs whole-cluster launch** (T1/R9) — launch a cluster as one wave, or item-by-item as lanes free?
  Changes lease acquisition and the conflict engine ([#2551]).
- **Repo / program dimension on lanes** — are lanes scoped per-program, or global across the constellation?
  (The L2 "all programs" claim vs the single-program board — resolve the namespace.)

## Acceptance
Each fork ruled; the board build cites the frontier rule (render/fold), the cleared-order, the launch-wave
policy, and the lane namespace, so C1/C5/C6 don't hardcode an unratified choice.
