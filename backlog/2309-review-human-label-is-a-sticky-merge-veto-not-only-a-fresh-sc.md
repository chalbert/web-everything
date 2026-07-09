---
kind: story
size: 2
parent: "2285"
status: resolved
graduatedTo: "we:scripts/lib/review-escalation.mjs"
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# review:human is a sticky merge veto, not only a fresh-score classification

PR #289 MERGED (commit af4c686e, 2026-07-09) while still carrying `review:human` + `review:pending` — a human-gated PR landed with no human verdict. Root cause: `decideReviewGate` (we:scripts/lib/review-escalation.mjs) decides the human gate purely from the drain's FRESH `scoreEscalation` of the current diff (`humanRequired: score.humanRequired`, we:scripts/merge-ai-prs.mjs), never from the `review:human` LABEL already on the PR. #289 was stamped `review:human` at open (its pre-rebase diff touched we:scripts/merge-ai-prs.mjs, a gate-self path); after rebase the diff narrowed, the gate-self file dropped out, the drain's re-score returned `humanRequired:false`, so it fell through the human branch to the `merge-anyway` timeout and landed despite the sticky label. Fix: `decideReviewGate` treats the PRESENCE of `review:human` as a hard veto (`humanRequired || hasReviewLabel(labels, review:human)` → `park`, no timeout), checked BEFORE the `!escalate`-merge and merge-anyway branches, so once any pass gates a PR to a human only a human clearing it (→ `review:accepted`, which still wins first) may merge — even if the diff later de-escalates. This is the deterministic half of "no PR merges with review:human on it"; a second, server-side belt (a required status check that fails while `review:human` is present) is recommended follow-up under #2285 so even a manual `gh pr merge` cannot bypass it.
