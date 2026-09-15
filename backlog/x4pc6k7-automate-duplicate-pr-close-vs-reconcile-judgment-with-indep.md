---
kind: decision
status: open
scope: ["we:scripts/conveyor/duplicate-pr-watch.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Automate duplicate-PR close-vs-reconcile judgment with independent second-model verification

we:scripts/conveyor/duplicate-pr-watch.mjs detects when two PRs both claim to deliver the same backlog item, but its finding comment explicitly punts resolution: a human or reconciliation agent should read the diffs, then either close the redundant PR(s) or reconcile them into one PR. On 2026-09-14 this fired live: PR #2220 and PR #2223 were both flagged as delivering item #3383, and resolving close-vs-merge required a real diff comparison, handled manually via a dispatched agent this session. Idea: automate this judgment — dispatch an agent to read both PRs' diffs and decide whether one is a clean superset of the other (close the redundant PR) or whether they need reconciling (merge unique value from both), without requiring human escalation in the confident case. Escalate to a human only when the automated judgment genuinely cannot confidently resolve which PR to keep or how to combine them. Specific idea for making the automated call trustworthy enough to skip human review: require a second, different model to independently vote/verify the close-or-reconcile resolution before it is acted on, mirroring this repo's existing multi-judge-panel pattern already used for code review (Codex/Gemini seated as independent judges alongside Claude, per the model-probation/graduation work, #3654/#3673) — i.e. treat which PR to keep (or how to merge them) as itself a judged decision requiring independent agreement, not a single agent's unilateral call, before it is allowed to skip human escalation. Open questions (unresolved — this item does not pick an approach): (1) what counts as cannot confidently resolve — needs a real, checkable threshold, not vague judgment language; (2) whether the second-model-vote requirement should reuse the existing judge-panel/model-probation infrastructure directly, or needs its own lighter-weight mechanism; (3) what the blast-radius of a wrong automated call would be — closing the wrong PR, or a bad merge-reconciliation — since that affects how conservative the confidence threshold needs to be.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
