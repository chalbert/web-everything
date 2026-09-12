---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/review-dispatch-wrapper.mjs", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# review-dispatch-wrapper misclassifies a successful review as blocked-on-infra when a secondary logging step fails

Found live (2026-09-12) during a real review-dispatch run against PR #2137: the run actually succeeded end to end (real diff read, real accept verdict posted, review:pending -> review:accepted label flip, drain merged it), but we:scripts/operations/review-dispatch-wrapper.mjs's own local completion record said blocked-on-infra anyway. Root cause (already diagnosed): we:scripts/operations/review-loop-cli.mjs exited non-zero on this run because a secondary, non-essential filing step failed -- two owed prevention-guard entries were never appended to ~/.claude/conveyor/learnings/review-loop.jsonl (confirmed: its last entry is from PR #2116 the day before, nothing for #2137). execFileSync in the wrapper throws on that non-zero exit, and the wrapper's catch branch discards the real parsed result and hardcodes blocked-on-infra -- it cannot currently distinguish 'the review never ran' from 'the review ran and succeeded, but a secondary/non-essential step afterward failed'. Fix: in we:scripts/operations/review-dispatch-wrapper.mjs, classify the execFileSync failure by inspecting the actual we:scripts/operations/review-loop-cli.mjs output/exit reason rather than assuming any non-zero exit means the review itself failed, so a successful review with a failed secondary logging step reports its real outcome, not a false blocked-on-infra. This is part of the same mechanical-harness line of work as PR #2113 (epic #3383, still unmerged) that built this wrapper -- fix it there, ideally before/as #2113 lands, so the wrapper's completion signal is trustworthy from the start.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
