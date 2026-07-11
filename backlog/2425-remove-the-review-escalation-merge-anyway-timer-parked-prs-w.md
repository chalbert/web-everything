---
bornAs: x30jq9n
kind: task
status: resolved
relatedTo: ["2412", "2410", "2262", "2171", "2285"]
scaffoldedBy: "remove-review-timer"
dateScaffolded: "2026-07-10"
dateOpened: "2026-07-10"
dateResolved: "2026-07-10"
tags: [gate, review, drain, merge-anyway]
---

# Remove the review-escalation merge-anyway timer — parked PRs wait for a verdict

The 30-min watch-window (#2262, `windowMinutes` in we:scripts/lib/review-escalation.mjs) merges an escalated PR when no reviewer verdict arrives in time. Since #2285/#2310 the drain session runs the review itself, so the timer races the very review it waits for — observed 2026-07-10: PR #396 merged mid-negotiation at the round-1 tip while round-2 mandatory-lens findings were still being fixed. Remove the merge-anyway path entirely: a parked PR rests parked until review:accepted/review:changes; a stuck park is handled by a manual /drain. Rewrites that part of the #2171 rubric.

**Delivers #2412 Gap 1 by removal** (operator call, 2026-07-10 drain session): rather than harden the timeout
(#2412's layered recommendation), the timeout itself is deleted — any action a clock takes mid-review preempts
the review, whether that action is "merge" or "relabel to human". No timer, no race. The rest of #2412
(traceability residue, defense-in-depth layers, #2410's convergence loop) stays open there.

## What was removed

- `decideReviewGate`'s `merge-anyway` action + its `parkedSinceMs`/`nowMs`/`windowMs` params (we:scripts/lib/review-escalation.mjs) — an escalated PR with no verdict now always parks; legacy park-age params are ignored (tripwire-tested).
- `DEFAULT_THRESHOLDS.windowMinutes`.
- `--review-window-minutes` flag, the park-age clock read/write, and the merge-anyway branch in we:scripts/merge-ai-prs.mjs.
- we:scripts/lib/review-park-state.mjs + its test — the module existed only to feed the timer. The untracked runtime state file (we:.claude/skills/drain/review-park-state.json) is now inert debris, safe to delete.

**The relief valve for a genuinely stuck park** is the operator: a manual `/drain`, or the documented
`--no-review-escalation` override (honors `review:pending`, still refuses `review:human`/`review:changes`) —
never an auto-land. The #2285/#2362 invariants (human-gated PRs never auto-merge; sticky `review:human`) are
unchanged and still swept by we:scripts/lib/__tests__/gate-invariants.test.mjs, which now also proves no
park-age input can resurrect a timeout.
