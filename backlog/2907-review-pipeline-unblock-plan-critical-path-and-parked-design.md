---
bornAs: xj4caam
kind: task
status: open
dateOpened: "2026-08-04"
relatedReport: reports/2026-08-04-review-pipeline-unblock-plan.md
tags: [review, conveyor, orchestrator-mechanization, planning]
relatedTo: ["2572", "2864", "2639", "2830", "2874"]
---

# Review pipeline unblock plan — critical path and parked design decisions

The board state, the one rule while PRs are blocked, and every design decision from 2026-08-03/04 — captured so
nothing is lost, and explicitly **not scheduled** so nothing is started early.

The rule the plan exists to enforce: **open no PR that does not unblock an existing PR.** Eleven PRs are open and
most are parked; every good idea from those two days would become another item, another lane, another PR and
another review, into the queue that is already stuck. Five design decisions are recorded in the report with an
explicit trigger — zero `review:pending` PRs *and* #2572 landed — rather than filed as five separate items that
would compete for capacity now.

Critical path is one operator action: **land PR #1031**, which makes
`we:scripts/workflows/review-parked-prs.mjs` launchable at all. It has been unlaunchable since it was written
(its `meta` used string concatenation, which the Workflow runtime rejects), and three layers of built machinery —
the jury ledger, the scheduled runner, the operator's own queueing — inherited that silence.

Close this item when the report's critical path is done and #2572 has landed; the report is obsolete at that
point, not before.

## Current state (re-grounded, 2026-08-21)

**The critical path's first step is done.** `we:scripts/workflows/review-parked-prs.mjs` now carries
`export const meta = { … }` as a **pure literal** — its own comment says so ("meta — a PURE literal (no
computation): the harness reads it to name/describe the workflow"). The string-concatenation defect that made
the workflow unlaunchable is gone, so PR #1031 (or an equivalent) has landed. The report's step 1 is closed;
steps 2–4 are not.

**The stated close condition is still open.** `we:backlog/2572-wire-the-scheduled-converge-and-label-runner-demote-scored-r.md`
reads `status: open`. Of the `relatedTo` set, #2864 and #2639 are `resolved`, #2830 is `active`, #2874 is `open`.
So this item stays open, exactly as its body says.

## Done when

**No tier-1 criterion, and here is why.** This is a deliberately *unscheduled* holding item: it carries a plan
and five parked design decisions so they are not lost, and its own body says "explicitly **not scheduled** so
nothing is started early". It builds nothing, so no test can fail before and pass after. Its close condition is
a *state of other work*, which is tier 2 — one cheap read each.

- `grep -m1 "^status:"` over `we:backlog/2572-wire-the-scheduled-converge-and-label-runner-demote-scored-r.md`
  reads `resolved`. (Today: `open`.)
- `gh pr list --label review:pending --state open` returns **zero** rows across the constellation repos — the
  second half of the report's own trigger for unparking the five design decisions.
- `we:scripts/workflows/review-parked-prs.mjs` is launchable: `export const meta` is a pure object literal with
  no concatenation or template interpolation. **Already true as of 2026-08-21** — record it as met rather than
  re-verifying it as new work.
- When both of the first two hold, the five parked design decisions in
  `we:reports/2026-08-04-review-pipeline-unblock-plan.md` are each either **filed as an item or explicitly
  dropped with a reason**, and this item is resolved pointing at that disposition. Closing it while the parked
  five are still only prose loses exactly what the item exists to preserve.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — Every re-grounded claim checks out against the live repo: we:scripts/workflows/review-parked-prs.mjs:105-108 has export const meta as a pure object literal (no BinaryExpression concatenation) with the exact comment quoted at we:scripts/workflows/review-parked-prs.mjs:102; we:backlog/2572-wire-the-scheduled-converge-and-label-runner-demote-scored-r.md reads status: open; and the relatedTo set (we:backlog/2864-ledger-freshness-binding-before-review-runner-enforce-flip.md resolved, we:backlog/2639-convergence-loop-editorround-and-rereview-bounded-by-the-rou.md resolved, we:backlog/2830-drain-auto-review-must-clear-review-pending-mechanically-no-.md active, we:backlog/2874-check-standards-a-bare-nnn-in-a-sentence-carrying-pr-vocabul.md open) matches exactly. The card also correctly hedges 'PR #1031 (or an equivalent) has landed' rather than asserting #1031 itself landed — git history shows the #1031 branch's own commits (e.g. 4b0db627) are NOT ancestors of main, only the carved-out fix commit b0082853 ('Make the parked-PR converge loop launchable') is, which the commit message itself explains was split out of #1031 after four bounced review rounds.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card does not claim this item's own resolution unblocks anything; it is explicitly a zero-cost, unscheduled record ('explicitly not scheduled so nothing is started early') whose only job is preserving the report's five parked decisions and tracking an external close condition (we:reports/2026-08-04-review-pipeline-unblock-plan.md's critical path plus #2572), so there is no unmeasured-impact claim to challenge.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's own 'Done when' operationalizes 'the report's critical path is done' into checks for #2572 status and a zero review:pending count, but the report's critical path (we:reports/2026-08-04-review-pipeline-unblock-plan.md, 'Critical path' section) has a distinct step 3 — 'measure the false-positive rate on a control PR before trusting the batch' — that leaves no repo-state trace and is not covered by any of the four bullets. A closer following the checklist mechanically could resolve this item, and thereby retire the report as obsolete, without that measurement ever having been confirmed as done.

**Corrections recommended:**

- none — the preparation held up as written.

The card's factual claims all verify against the live repo — including a subtle nuance it gets exactly right (the literal PR #1031 never landed on main; only a smaller carved-out fix, commit b0082853, did) — and its scope-free, unscheduled framing is appropriate for a pure preservation/close-condition holding item.

_Recorded through the declared `review-prep` operation._
