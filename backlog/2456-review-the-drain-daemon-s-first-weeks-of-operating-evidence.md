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

## Done when

**No tier-1 criterion, and here is why.** This is a **read-and-judge task, not a build**: it runs an existing
CLI, reads its counters, and writes an answer. Nothing in this repo changes, so no test can fail before and pass
after. It also carries a **duration gate** — "a few weeks" — that no command can satisfy early. Every criterion
below is tier 2 (a named artifact, checked by one read) or tier 3 (a prose claim with the exact place to look).

- The duration gate is met before the review is written: the `evidence` output covers **≥ ~2 weeks** of daemon
  operation, and that window is stated with its pass count and hour count the way the 2026-07-14 interim note
  states "26.1 h / 633 passes". A review over a shorter window is another interim note, not the closing review —
  say so and keep the item open.
- The item body gains a **closing review section** that answers #2449's three questions from a single
  `evidence` read, each with the number it rests on: (1) did drain-class incidents stop — fail rate, timeouts,
  lease-contention, dup-NNN; (2) how often restart-recovery ran — restarts split into operator-driven deploys
  vs. `lease-loss` re-arbitration in `incidents.jsonl`; (3) did the extraction want to grow — where the lines
  went, core vs. observability.
- The two gaps the interim note names are explicitly re-tested, not assumed closed: **unattended** operation
  (the 26 h window was session-heavy — the closing review must state how much of its window had no session
  actively driving), and the concrete threshold already written down — human-pull-rate ≲ 1/day-equivalent, zero
  unresolved drain-class incidents, incident/anomaly trend flat-or-declining.
- **Correction to the interim note above, before it misleads the closing review: "all now verifiable in one
  `evidence` read" is an overclaim.** The evidence summary carries span / window / lifetime / rates /
  throughput / pass-duration / human-pull / incidents / time-to-land, and each pass record carries
  `{at, ms, exit, merged, considered, parked, noop, consideredPrs, mergedPrs}` — **no field distinguishes
  session-driven from unattended operation**. Three of the four threshold components do come from one read;
  the unattended one needs a source outside it (session/transcript activity over the window). Strike or qualify
  that sentence in the same pass, and name where the unattended figure actually comes from.
- **Re-check the routing targets first — one has moved.** #2444 (agent-runner) is now `status: resolved`, so
  the *#2444 readiness — NOT YET* section above is stale: it gates work that has since been done. The closing
  review must reconcile that (was it gated on this evidence and shipped anyway, or did the gate dissolve?) and
  strike or recast the section, rather than leaving a live-looking "do not force #2444 before it".
- The answer is **routed**, not just recorded: #2446 (placement, still `open`) carries a note saying what this
  evidence decided for it — either "prepare now" or "not yet, re-review at <date>" with the specific number that
  failed. It is named in the digest above as waiting on exactly this data; leaving it un-updated means the
  review produced no effect.
- The item resolves only when the closing review exists. Until then it stays `open` with the latest interim
  note dated — the discipline the 2026-07-14 note already models.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — The card's own Done-when explicitly requires re-checking whether we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md has moved before the closing review reuses the interim note's '#2444 readiness — NOT YET' section. Live-repo check confirms it has: #2444 is now status: resolved (dateResolved 2026-07-16, graduatedTo: 2530) — barely two days after the 2026-07-14 interim note, i.e. before the 'few weeks' gate this card asks for. The card correctly anticipates and requires reconciling exactly this drift.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Both named consumers of this evidence are correctly identified and still exist as the card describes: we:backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-.md is confirmed still status: open (the placement decision genuinely waiting on this data), and we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md is the other. The Done-when requires an explicit routing note land on #2446, not just a passive record in #2456's own body.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — plateau:tools/drain-daemon/lib.mjs's summarizeEvidence() (called by plateau:tools/drain-daemon/cli.mjs's `evidence` command) returns only span/window/lifetime/rates/throughput/passDuration/humanPull/incidents/timeToLand — no field distinguishes session-driven vs. unattended daemon operation (confirmed: pass records appended in plateau:tools/drain-daemon/daemon.mjs carry {at, ms, exit, merged, considered, parked, noop, consideredPrs, mergedPrs}, nothing session-related). The interim note's 'Concrete threshold' sentence nonetheless claims the unattended criterion is '...all now verifiable in one `evidence` read,' which the tool's actual schema does not support — the Done-when section is more careful (it just asks the closing review to 'state how much of its window had no session actively driving' without claiming a mechanical source), so the risk is contained but not flagged anywhere in the card.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card ties the evidence explicitly to unblocking we:backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-.md's placement call and requires the closing review to state whether we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md's resolution happened because of this gate or despite it — so the review's impact is checked rather than assumed.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Rather than let the stale '#2444 readiness — NOT YET (keep running)' text sit unnoticed, the Done-when forces it to be struck or recast, and keeps the item 'open' with a dated interim note (the same discipline the 2026-07-14 note already models) so a partial/premature read can't silently pass as the closing review.

**Corrections applied by this review:**

- The interim note's claim that the duration/unattended/human-pull-rate/trend threshold is 'all now verifiable in one `evidence` read' overstates the tool: plateau:tools/drain-daemon/lib.mjs's summarizeEvidence() output has no field for session-attended vs. unattended time, so the closing review's unattended-operation criterion will need a source outside a single evidence read despite that phrasing.

The preparation holds up well under independent re-verification — cross-repo citations, #2444/#2446 live status, and the evidence-CLI's actual output shape all check out — and its Done-when checklist already forces the two things a lazy closing review would skip (reconciling the now-stale #2444 reference, routing the answer to #2446); the one soft spot is the interim note's overclaim that "unattended operation" is verifiable from a single `evidence` read when the tool's output carries no session-attendance field.

**Finding applied after this review** (accepted): the interim note's "all now verifiable in one `evidence` read" is an overclaim — the evidence summary carries no session-attendance field — so the unattended-operation criterion now says where that figure has to come from instead.

_Recorded through the declared `review-prep` operation._
