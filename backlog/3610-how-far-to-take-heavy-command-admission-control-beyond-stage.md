---
bornAs: xqraqab
kind: decision
parent: "3611"
status: open
dateOpened: "2026-09-07"
tags: []
---

# How far to take heavy-command admission control beyond Stage 1 visibility: a simple EWMA-adaptive cap, a genuinely learned policy, or hold at fixed-cap-plus-visibility

Real fork under we:backlog/3611-hardware-usage-aware-heavy-command-capacity-control-a-staged.md, carved out per this repo's own epic/decision split rule rather than left inline in the epic body. Once Stage 1 (we:backlog/3608-stage-1-sample-real-cpu-memory-usage-per-heavy-command-run-a.md) has landed and produced real CPU/memory-vs-heavy-command usage data, this decides what to build on top of it. Option A (hold): keep we:scripts/readiness/heavy-admission.mjs's fixed cap=2 and treat Stage 1's data as pure operator-facing visibility, revisit only if evidence shows real contention despite the cap. Option B (Stage 2, simple adaptive): an EWMA-based headroom estimate (short trailing average of free CPU/memory from Stage 1 samples) drives a dynamic concurrency cap in place of the fixed constant — bounded complexity, precedented shape (GNU Parallel's --load, per #3456's own prior-art survey we:reports/2026-09-02-heavy-command-admission-queue.md, though that tool polls ps rather than the slower os.loadavg() and this repo has neither wired yet). Option C (Stage 3, genuinely learned): a self-correcting policy that also tunes per-command weighting, degree-of-parallelism, and lane/checkout-level slack reservation from observed outcomes over time — the operator's full stated ask, but substantially higher build and validation cost (needs a real feedback signal for 'was this cap too tight/too loose', drift/overfitting risk on a small single-host sample size, and no existing self-learning/adaptive-threshold convention anywhere in this repo to build on — confirmed by grep before filing). Recommended default: B before C — a simple EWMA cap is cheap, bounded, and testable in isolation (fails-open the same way we:scripts/readiness/heavy-admission.mjs already fails open on timeout), and #3456's own ratified text already anticipated exactly this as the next real increment ('real-time adaptive load-sampling... would better address the actual root cause'); C should only be scoped once B's own data shows a static EWMA still leaves real contention or real idle capacity on the table, per the operator's own bottleneck-avoidance-first-but-don't-waste-capacity framing. Not yet prepared to Definition-of-Ready (no Skeptic/Screen pass, no dedicated /research/ topic beyond what #3456 already surveyed) — needs a /prepare pass once Stage 1's real data exists to ground the options in actual measurements rather than projection.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
