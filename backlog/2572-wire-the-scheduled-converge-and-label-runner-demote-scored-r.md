---
bornAs: xpfousp
kind: epic
status: open
blockedBy: ["2864"]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/review-policy.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/auto-land-seam.mjs
  - we:scripts/lib/disposition-land-seam.mjs
  - we:scripts/pr-land.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/fetch-parked.mjs
  - we:scripts/workflows/
  - we:scripts/conveyor/
  - we:scripts/__tests__/
  - we:scripts/lib/__tests__/
dateOpened: "2026-07-19"
tags: []
---

# Wire the scheduled converge-and-label runner + demote scored review:pending to advisory care routing

The safety-coupled behavior half of #2563/#2567. (1) A SEPARATE scheduled agent-runner (cron/routine — the daemon can't spawn agents, #2391 lease) runs the un-deferred convergence workflow (review-parked-prs, #2437/#2410) over care-annotated PRs, dialing panel rigor by the care-level built in #2567, then applies review:accepted / ready-to-merge ONLY — converge+label, never land (the resident daemon stays sole main-writer). (2) Demote the scored signals (blast/size/dismissed/cross-repo/sampling) from the blocking review:pending human-park to a non-blocking care:* annotation the runner keys on. These MUST ship together: demoting the park without the wired runner lets the daemon auto-land scored PRs with ZERO review (merge-ai-prs hasUnclearedReviewLabel only refuses review:pending/human/changes). gate-self/statute stay review:human; non-convergence stays review:human. Edits the review trust chain → review:human, a human clears it.

## The enforce flip is BLOCKED by #2864 — now in the DAG, not just in prose

**#2864 said "it **must** land before the enforce flip (#2572 part 2)" in its body, while this card carried
`blockedBy: []`.** Nothing machine-readable stopped the flip from being picked up first, and on 2026-08-03 it was
nearly recommended as ready on exactly that basis — `status: open`, `size: 8`, no blockers.

The prerequisite is real and only bites in enforce mode: the jury ledger carries **no commit SHA**, so a verdict
written at head A folds to *clear* at head B. Enforced, that auto-clears a PR for a diff no juror saw, and the
`reviewed-sha` marker cannot catch it — it is stamped at WRITE time, so it certifies the unreviewed tree. Shadow
mode is safe from this only because its "no ledger → keep parked" path fails closed.

This is the class #2874 exists for, arriving from the other direction: an outward prerequisite stated in the
blocked item's prose, never lifted into the blocker's edges. Fixed here by writing the edge.

## Also corrected here

- **`kind: story` → `kind: epic`.** This card has a child (#2864), and a *sized* story with children
  double-counts in the burndown — `we:scripts/backlog-guard.mjs` blocks any edit until it is resolved.
- **`size: 8` dropped.** An epic is sized only while unsliced; this one has a slice.

## Naming decision — the "converge daemon" (operator, 2026-08-03)

Rename `we:scripts/review-runner.mjs` / `we:scripts/lib/review-runner-core.mjs` and every "shadow runner"
reference to the **converge daemon**, riding THIS story rather than a separate cycle.

"Shadow" names its *mode*, not its job — the observe-only phase this story ends, so the name is wrong the day it
lands. "Review daemon" was rejected as the obvious pair for the drain daemon because it hides the part that
matters: this process REVIEWS via a fresh multi-lens panel, then an editor subagent FIXES each finding and
**pushes the revision to the PR branch**, and only then DECIDES the label. Nobody expects a "review daemon" to
rewrite their branch. `converge` is already this codebase's word for that loop.

The pair then reads by what each one writes:
- **drain daemon** — writes to `main`; lands what is cleared.
- **converge daemon** — writes to PR branches; reviews, fixes, decides. Never touches `main`.

It rides this story because both files are POLICY tier of the trust chain
([`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs)) — a rename needs a human clear, and this story
already requires exactly one.
