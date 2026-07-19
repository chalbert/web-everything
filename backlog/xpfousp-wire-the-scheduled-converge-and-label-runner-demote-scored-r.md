---
kind: story
size: 8
status: open
blockedBy: ["2567"]
dateOpened: "2026-07-19"
tags: []
---

# Wire the scheduled converge-and-label runner + demote scored review:pending to advisory care routing

The safety-coupled behavior half of #2563/#2567. (1) A SEPARATE scheduled agent-runner (cron/routine — the daemon can't spawn agents, #2391 lease) runs the un-deferred convergence workflow (review-parked-prs, #2437/#2410) over care-annotated PRs, dialing panel rigor by the care-level built in #2567, then applies review:accepted / ready-to-merge ONLY — converge+label, never land (the resident daemon stays sole main-writer). (2) Demote the scored signals (blast/size/dismissed/cross-repo/sampling) from the blocking review:pending human-park to a non-blocking care:* annotation the runner keys on. These MUST ship together: demoting the park without the wired runner lets the daemon auto-land scored PRs with ZERO review (merge-ai-prs hasUnclearedReviewLabel only refuses review:pending/human/changes). gate-self/statute stay review:human; non-convergence stays review:human. Edits the review trust chain → review:human, a human clears it.
