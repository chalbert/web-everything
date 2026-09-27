---
bornAs: xgos7st
kind: decision
status: open
dateOpened: "2026-09-27"
tags: []
---

# Land-time order for a ready PR that overlaps a larger PR already in review: yield, or land first and make the rebase cheap

Large daemon PRs keep drifting into conflict with main because smaller overlapping PRs land ahead of them while they sit in review (PR 2821, 20 files, conflicted twice on 2026-09-27; each conflict cost a fixer round, CI and a re-review). The drain (we:scripts/merge-ai-prs.mjs) lands whatever is ready, in item order, with no notion of an open overlapping PR still in review. Forks: should the drain briefly hold a ready PR that overlaps a larger PR in review (bounded yield), and, separately, may a PR keep its review after a clean mechanical rebase?

**Status: filed, NOT yet prepared.** The forks below carry options, tradeoffs and a proposed bold default from the preparation of the build card (4308). There is no `/research/` topic and no skeptic pass yet, so `/prepare` must finish this item before anyone rules on it. An independent Codex review of the build card (recorded on 4308) already reshaped these forks: it added the status-quo and eligible-only options, split review carry-over into its own fork, and showed an overlap-only size order can cycle.

## Context

- **The cost, measured on one PR.** #2821 (`lane/fix-procedure`, 20 files, +1807/−118) opened 18:26Z. #2826 merged at 20:30Z, touching `we:scripts/conveyor/review-status-tag.mjs`, which #2821 also changes. The conflict watch labelled #2821 `merge-status:conflicting` at 20:32Z. The conflict was cleared at 21:16Z. That is 44 minutes, two fixer sessions (one a duplicate, see 4306), a full CI run and a fresh review round. Earlier the same day #2819 conflicted with it in `we:scripts/operations/ci-heal-pr-dispatch.mjs`.
- **What the drain does today.** `we:scripts/merge-ai-prs.mjs#planLabelDrain` (near line 1901) orders ready PRs by `blockedBy`/`stackParents` edges, then by item number, then by PR number (near line 2013). It knows nothing about an open PR that is NOT ready. Its only conflict help is at land time for the PR being landed (the manifest rebase-drop and the non-overlapping-hunk auto-resolve, #2198 and #2371).
- **Existing overlap machinery.** `we:scripts/readiness/overlap-chain.mjs` stacks overlapping items at AUTHORING time, inside one serial batch. #4295 (4295) will serialize overlapping BUILD dispatches. Neither sees work that was dispatched outside the build daemon, or two PRs that are both already open. #2821 and #2826 were both orchestrator-dispatched fixes.

## Fork 1 — land-time ORDER when a ready PR overlaps an open PR in review

- **Status quo.** Keep landing ready work in today's order. The PR that lands second pays the conflict through the existing conflict watch and fixer. Nothing new to trust or tune. This is the baseline every other option must beat on measured cost.
- **A. Bounded yield (proposed default).** Hold the ready PR X (a `deferred` entry, `waitOn: ['overlap-yield:#Y']`) while a larger overlapping PR Y is in final review, inside a per-X budget counted from X's own `ready-to-merge` label. Larger means one global order (total changed lines, then PR number), so yields cannot cycle. Tradeoff: X waits up to its budget, and the conflict is not removed, only moved to the smaller PR, whose re-land has less to re-review and re-test. That benefit is a hypothesis to measure, not a given.
- **A′. Order only among PRs that are all eligible to merge.** Only when X and Y are BOTH ready in the same pass, land the larger first. Never hold X for a PR still in review. Tradeoff: it never delays anything, but it would not have helped #2821, which was in review, not ready, when #2826 landed.
- **C. Stack X on Y at land time.** Rebase X onto Y's head so X can only land after Y. Tradeoff: it couples X to Y's fate. If Y bounces or stalls, X is stuck behind unreviewed code, and the proof-of-land gate for stacks (#2393) is built for authoring-time stacks, not ones the drain would create itself.
- **D. GitHub merge queue.** Rejected: #2138 and #2153 ruled the deferred drain as the landing transport, and a merge queue orders by enqueue time, not by overlap.
- **E. Smaller slices only.** Not a land-time option. Authoring guidance already says to split anything over size 8, and #2821 still happened. It stays upstream advice.

**Proposed default: A.** It is the only option that would have protected #2821 without coupling two PRs' fates. The per-X budget keeps its worst case bounded.

## Fork 2 — may a rebased PR keep its review? (independent of Fork 1)

This is a separate axis, not an alternative to A: it changes what a conflict COSTS, whatever the order.

- **Keep today's rule.** Any conflict resolution sends the PR back through a fixer, CI and a fresh review round.
- **B. Keep the review after a mechanical rebase.** When the rebase onto the new main is textually clean, or resolves with both sides kept verbatim, the PR keeps its review state and goes straight back to CI. Tradeoff: a reviewer approved a diff that no longer exists byte for byte, and "both sides kept" can still be wrong (two edits to one function). It needs its own trust rule and red-team.

**Proposed default: keep today's rule here, and prepare B as its own item.** B's trust question deserves its own research and skeptic pass.

## Fork 3 — making A mechanical

- "Larger": total changed lines of the PR (sum of per-file counts), then lower PR number. **Proposed default.** It is a total order, so it cannot cycle. An overlap-only measure is more precise but can cycle across three PRs.
- "Final review": Y is open, not a draft, on the same base as X, not `review:changes`, and carries `review:pending` or `review:accepted`; and Y does not depend on X. **Proposed default.**
- Budget: 45 minutes per X from its own ready label. **Proposed starting value.** It rests on one incident (the #2821 conflict took 44 minutes end to end), so it is a flag, logged, and revisited from the first week of yields.

## Proposed ruling — NOT READY (needs /prepare, then explicit ratification)

Fork 1 A; Fork 2 keep today's rule and prepare B separately; Fork 3 as defaulted above. The build card is 4308.
