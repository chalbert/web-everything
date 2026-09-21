---
bornAs: xg39p9t
kind: task
parent: "2445"
status: active
dateOpened: "2026-07-12"
dateStarted: "2026-09-18"
tags: []
scope:
  - we:backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence.md
  - we:backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-.md
  - we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md
---

# Review the drain daemon's first weeks of operating evidence

Read the resident drain daemon's pass journal (plateau:.drain-daemon/history.jsonl and its plateau:.drain-daemon/state.json counters) after a few weeks of operation and answer #2449's evidence questions: did drain-class incidents stop, how often did restart-recovery run, did the extraction want to grow. Feed the answer into the deferred #2446 (placement) and #2444 (agent-runner) decisions — they are waiting on exactly this data.

Now a single command: `plateau:tools/drain-daemon/cli.mjs` `evidence` distills the journal into these exact answers (built under #2495, the [#2489](/backlog/2489-loop-console-health-anomaly-detection-turn-the-mirror-into-a/) observability epic). The "few weeks" duration gate is now met (~9.5 weeks); the **closing review** below supersedes the day-1 interim baseline kept under it for comparison.

## Closing evidence review (2026-09-18, ~67 days — the review this item asks for)

**Sources.** `evidence` over the live journal, plus the lifetime counters in `plateau:.drain-daemon/state.json`,
`plateau:.drain-daemon/incidents.jsonl`, `plateau:.drain-daemon/alerts.jsonl` and the full `plateau:.drain-daemon/daemon.log`
(which goes back to the 2026-07-13 first start). **Caveat:** `history.jsonl` rotation (#2498) has kept only the last
**138 h / 4,793 passes** (2026-09-13 → 09-18), so the pass-level journal answers cover that window. The whole-life
answers below come from the counters and the log.

| Measure | Day-1 interim (26 h) | Lifetime (~67 d) | Last 138 h (journal) |
| --- | --- | --- | --- |
| Passes | 633 | **62,008** | 4,793 |
| Merged | 43 (1.65/h) | **1,605** (~1.0/h) | 87 (0.63/h) |
| Failed passes | 7 (1.1 %) | **165 (0.27 %)** | 25 (0.5 %): 23 dup-NNN, 2 `gh pr merge` fails |
| Timeouts / lease-contention | 0 / 0 | 0 / 0 | 0 / 0 |
| Starts | 5 | **13** | current process up **405 h** (since 2026-09-02) |
| `review:human` pulled in | 1 | n/a | 2 distinct PRs (~0.35/day) |
| Time-to-land | n/a | n/a | p50 ≈ 0, p95 0.53 h, max 11.4 h |

- **Did drain-class incidents stop?** **Mostly, with one class that did not stop.** Failures are rare (0.27 %
  lifetime), with zero timeouts, zero lease contention, zero `lease-loss` rows, and no repeat of the we #477
  deadlock. The one exception is **dup-NNN on main (exit 3)**. It came back after the interim's "zero dup-NNN"
  and has **risen with throughput**: 8 red episodes in July, 10 in August, **89 in September so far** (peaks of
  21/day on 09-08 and 09-09). Each one is short. Most episodes are a single detection, only 3 lasted longer than 3 back-offs
  (the longest was 2.2 h, on 2026-08-17). In the episode I spot-checked, the very next pass after the 900 s back-off
  merged normally, and main has no duplicate numbers now. So these are self-clearing collisions of JIT
  numbering at land time, not unresolved incidents. Even so, the daemon logs each one as "an operator must fix
  it", and together they stall the whole queue for about 15 min each time (~23 h of back-off in September). This
  is the one drain-class trend that is **not** flat or declining.
- **How often did restart-recovery run?** **Once for real, and it worked.** There were 8 restarts after the
  interim (starts 6 → 13). Every exit was a clean `SIGTERM — releasing lease` (a deliberate stop or deploy). None
  was a crash. The one real recovery event was on **2026-08-01**. A new instance started while the old PID still
  held the lease. It hit `EADDRINUSE` on the push seam, logged "lease held … waiting it out", and took the lease
  12 min later. The single-owner invariant held, with no double-drain. Since 2026-09-02 the daemon has run
  **405 h without a restart**.
- **Did the extraction want to grow?** **It stopped.** After the day-1 observability burst (+2,137 lines in 8
  commits), the daemon's own code (`plateau:tools/drain-daemon/`) grew by only **+995 / −119 lines over 9
  commits in ~9 weeks** (5 since 2026-08-15). It now stands at ~3,700 lines. Meanwhile the WE **engine core kept
  growing where it is**: `we:scripts/we:merge-ai-prs.mjs` + `we:scripts/pr-land.mjs` + `we:scripts/lane-pool.mjs`
  went from 6,776 lines (#2446's 2026-08-15 re-measure) to **7,931**. `we:merge-ai-prs.mjs` alone took 78 commits
  since 2026-07-14, still keyed by the same 3-name `CONSTELLATION_REPO_NAMES`. The coordination/observability
  shell has settled. The drain *rules* are what is still growing, and they are all in WE.

### Against the interim's re-review threshold

| Threshold (set 2026-07-14) | Verdict |
| --- | --- |
| ≥ ~2 weeks, mostly unattended | **Met.** About 9.5 weeks in total, including 405 h continuous since the last restart, with no crash-restarts. |
| Human-pull rate ≲ 1/day | **Met.** 2 distinct `review:human` PRs in the last 138 h. |
| Zero *unresolved* drain-class incidents | **Met.** Every failure cleared itself; nothing is still open and main is clean. |
| Incident/anomaly trend flat or declining | **Not met on two counts.** (1) dup-NNN is rising (above). (2) The anomaly trend **cannot be read yet**, because the alert stream is dominated by false positives (below). |

**Alert signal is polluted (finding).** `alerts.jsonl` recorded **1,050 out-of-console alerts** (274 in July,
350 in August, 426 in September). 608 of them are `stuck`, mostly `stall` + `considered-never-merged`. In the
journal window, **4,682 of the 4,693 zero-merge passes were fully explained by `skippedPrs`**, meaning PRs left
for their author: BEHIND/DIRTY/BLOCKED (4,621 sightings), a red required check (5,851), or CONFLICTING/UNKNOWN
mergeability. `stuckPassKind` in `plateau:tools/drain-daemon/lib.mjs` treats a pass as "explained" only through
`parked` and `deferred`, and never subtracts author-side skips. So one PR with red CI waiting on its author (right
now #2072 and #2110) raises a queue-wide `stall` / `stuck` alarm. That means the health verdict cannot yet show
whether the drain itself is stuck, and the "trend" gate cannot be checked in one `evidence` read as the interim
assumed. **Follow-up needed (outside this item's scope):** count author-side `skippedPrs` as explained in
`stuckPassKind`, the same way parked/deferred are counted.

### Feed into the waiting decisions

- **[#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/) (agent runner):**
  **no longer waiting.** It was un-deferred and ratified on 2026-07-16 through its own trigger (the #2530
  supervised builder), on the grounds that the daemon spawns no agents and so its evidence would not shape the
  runner contract. This review agrees: nothing above bears on the steer, permission or stop forks. The one
  runtime-stability point that carries over is that the process-supervision pattern (clean `SIGTERM` lease
  release, wait-out-the-lease on a double start) has held for 9 weeks. That is supporting evidence for the
  ratified Fork 3, not a reason to reopen it.
- **[#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/) (placement):**
  the evidence **supports its recommended staged default** and **raises the cost of waiting.** Hosting the
  daemon/console as a plateau-app `tools/` module worked for 9 weeks with no placement-caused friction, and that
  code has stopped growing. The engine core that the statute says must leave WE grew by another ~1,150 lines in
  a month. None of the staged-rollout graduation triggers is visible in this evidence. The placement call is
  ready for ratification on the evidence side. The operating window neither argues for a separate repo nor for
  waiting longer.
- **Transitively, [#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/)
  (multi-project registry)**, which is "deferred behind the phase-1 evidence gate (#2456)": the duration,
  human-pull and unresolved-incident parts of that gate are met. The trend part is blocked only by the
  alert-classification defect above and the rising dup-NNN rate. Neither is a reason to keep the registry
  decision waiting for more *time*.

## Progress

- [x] Read `evidence` (138 h journal window) plus the lifetime counters, the incidents/alerts journals and the
  full daemon log (2026-07-13 → 2026-09-18).
- [x] Answered the three #2449 evidence questions, with the whole-life vs rotated-window split stated.
- [x] Scored the interim's re-review threshold: 3 of 4 met; the trend gate is not met (dup-NNN rise, polluted
  alert signal).
- [x] Fed the answer into #2444 (already resolved; evidence agrees) and #2446 (evidence supports the staged
  default; cost of waiting rising). Noted the transitive effect on #2472.
- [ ] Follow-ups surfaced for separate filing (not built here): count author-side `skippedPrs` as explained in
  the daemon's stall classification, and look at why dup-NNN collisions on main rose about 10× in September.

## Interim evidence review (2026-07-14, ~1 day; superseded by the closing review above)

Snapshot from `evidence` over the first **26.1 h / 633 passes**: merged **43** (1.65/h), failed **7** (fail rate **1.1 %**), **0** timeouts, **0** lease-contention (noop 0 %), parked sightings 104, idle 65.6 %, pass time avg 15 s / p95 23 s / max 7 min, **3** restarts, **1** distinct `review:human` PR pulled in.

- **Did drain-class incidents stop?** Largely yes. Fail rate ~1 %, zero timeouts, zero lease-contention, zero dup-NNN. The one big incident — the we #477 batch-loop deadlock (head-churn, 0 merges for 70 min) — was fixed and has NOT recurred. Residual: ~1 % of passes still fail (transient CI/mergeability), none unrecoverable.
- **How often did restart-recovery run?** 3 restarts in 26 h, but operator-driven — each was a deliberate deploy of a daemon change THIS session (activating the observability slices), not crash-recovery. `incidents.jsonl` shows only `restart` markers, **no** `lease-loss` re-arbitration. Autonomous crash-recovery essentially did not fire.
- **Did the extraction want to grow?** Emphatically yes — **+2137 lines across 8 commits** this session, ALL in observability (anomaly detection, health verdict, evidence view, out-of-console alert), while the drain CORE stayed single-sourced in we:scripts. It grew in the RIGHT direction, which VALIDATES the #2445 thesis: the daemon owns coordination + observability, WE owns the drain rules.

### #2444 (agent-runner) readiness — NOT YET (keep running)

The trend is strongly positive (rare incidents, ~1 human-pull/day, healthy directional growth), but two gaps block gating #2444: (1) **DURATION** — ~1 day, not the weeks #2456 asks for; (2) the 26 h was **session-heavy** — a session actively drove landing, review panels, and restarts, so it does NOT yet demonstrate UNATTENDED autonomous operation. Real bugs were also still being found this arc (we #477; the `review-baseline-state` false-alarm; the slice-B parked/deferred false-positive caught in review) — the loop is still stabilizing.

**Concrete threshold to re-review + then prepare #2444:** ≥ ~2 weeks with the daemon left mostly unattended, human-pull-rate staying low (≲ 1/day-equivalent), zero unresolved drain-class incidents, and the incident/anomaly trend flat-or-declining — all now verifiable in one `evidence` read. Re-run this review then; do not force #2444 before it.
