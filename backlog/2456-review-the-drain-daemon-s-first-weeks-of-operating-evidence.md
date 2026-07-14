---
bornAs: xg39p9t
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-12"
tags: []
---

# Review the drain daemon's first weeks of operating evidence

Read the resident drain daemon's pass journal (plateau:.drain-daemon/history.jsonl and its plateau:.drain-daemon/state.json counters) after a few weeks of operation and answer #2449's evidence questions: did drain-class incidents stop, how often did restart-recovery run, did the extraction want to grow. Feed the answer into the deferred #2446 (placement) and #2444 (agent-runner) decisions — they are waiting on exactly this data.

Now a single command: `plateau:tools/drain-daemon/cli.mjs` `evidence` distills the journal into these exact answers (built under #2495, the [#2489](/backlog/2489-loop-console-health-anomaly-detection-turn-the-mirror-into-a/) observability epic). Stays OPEN — the "few weeks" duration gate is not met; the note below is a DAY-1 interim baseline, not the closing review.

## Interim evidence review (2026-07-14, ~1 day — NOT the closing review)

Snapshot from `evidence` over the first **26.1 h / 633 passes**: merged **43** (1.65/h), failed **7** (fail rate **1.1 %**), **0** timeouts, **0** lease-contention (noop 0 %), parked sightings 104, idle 65.6 %, pass time avg 15 s / p95 23 s / max 7 min, **3** restarts, **1** distinct `review:human` PR pulled in.

- **Did drain-class incidents stop?** Largely yes. Fail rate ~1 %, zero timeouts, zero lease-contention, zero dup-NNN. The one big incident — the we #477 batch-loop deadlock (head-churn, 0 merges for 70 min) — was fixed and has NOT recurred. Residual: ~1 % of passes still fail (transient CI/mergeability), none unrecoverable.
- **How often did restart-recovery run?** 3 restarts in 26 h, but operator-driven — each was a deliberate deploy of a daemon change THIS session (activating the observability slices), not crash-recovery. `incidents.jsonl` shows only `restart` markers, **no** `lease-loss` re-arbitration. Autonomous crash-recovery essentially did not fire.
- **Did the extraction want to grow?** Emphatically yes — **+2137 lines across 8 commits** this session, ALL in observability (anomaly detection, health verdict, evidence view, out-of-console alert), while the drain CORE stayed single-sourced in we:scripts. It grew in the RIGHT direction, which VALIDATES the #2445 thesis: the daemon owns coordination + observability, WE owns the drain rules.

### #2444 (agent-runner) readiness — NOT YET (keep running)

The trend is strongly positive (rare incidents, ~1 human-pull/day, healthy directional growth), but two gaps block gating #2444: (1) **DURATION** — ~1 day, not the weeks #2456 asks for; (2) the 26 h was **session-heavy** — a session actively drove landing, review panels, and restarts, so it does NOT yet demonstrate UNATTENDED autonomous operation. Real bugs were also still being found this arc (we #477; the `review-baseline-state` false-alarm; the slice-B parked/deferred false-positive caught in review) — the loop is still stabilizing.

**Concrete threshold to re-review + then prepare #2444:** ≥ ~2 weeks with the daemon left mostly unattended, human-pull-rate staying low (≲ 1/day-equivalent), zero unresolved drain-class incidents, and the incident/anomaly trend flat-or-declining — all now verifiable in one `evidence` read. Re-run this review then; do not force #2444 before it.
