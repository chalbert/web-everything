---
kind: story
size: 3
status: open
dateOpened: "2026-08-17"
tags: []
---

# Drain leaves BEHIND PRs to their author with no automated rebase

we:scripts/merge-ai-prs.mjs deliberately skips any ready-to-merge PR whose mergeStateStatus is BEHIND ("left for its author / a later rebase — the sweep never force-updates someone's branch", we:scripts/merge-ai-prs.mjs:33-35). Under sustained concurrent merge traffic this recurs constantly: three PRs (#1437, #1436, #1426) all went BEHIND within roughly one hour of each other tonight purely because origin/main kept advancing while they sat reviewed-and-waiting; a fourth (#1443) landed BEHIND from the moment it opened. Nobody wrote new code in any of them — each just needed we:AGENTS.md's inventory regenerated against the new main tip and re-pushing. Right now the ONLY route back to landable is the orchestrating session noticing (via a full PR sweep) and manually running: fetch, checkout, merge/rebase origin/main, npm run gen:inventory, commit, force-with-lease push, and — if the head SHA advanced past a prior review:accepted — a fresh-session-id review-set-label re-accept to clear #2832's stale-review park. That is real, recurring, mechanical orchestration-session time with zero judgment content: script-decidable by #51's own hookable-vs-judgment rule. A background sweep (cron-style, or a drain-adjacent step) that finds ready-to-merge+review:accepted PRs in BEHIND state, rebases each safely (preferring rebase over merge to avoid bloating the PR's apparent diff with unrelated main-tip files, which itself risks tripping #2832's size-based re-review threshold), regenerates the inventory, and re-pushes would eliminate this class of manual toil entirely. Also worth caring about: prefer 'git rebase' with we:AGENTS.md conflict resolved via regeneration over 'git merge origin/main' — a merge commit pulls every unrelated file changed on main into the PR's diff, which can itself cross #2832's 400-line re-review threshold and force an unnecessary re-review even when the PR's own content did not change (observed live on #1426 tonight).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
