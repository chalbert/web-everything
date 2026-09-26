---
bornAs: x00g3tt
kind: story
size: 3
parent: "4075"
status: active
blockedBy: ["3949", "4194"]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
tags: []
---

# Post-accept red team: after a build/fix PR's review accepts, a non-Claude pass tries to break it

After a build or fix PR's review reaches an accept verdict, dispatch a non-Claude red-team pass (via we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs) that tries to break the finished work, following the jury's own post-accept red-team PATTERN already ratified for the in-loop jury skill (we:scripts/lib/jury-core.mjs#redTeamRequired / #foldRedTeamVerdict, #2707) — this card applies that SAME fail-closed pattern as a dedicated step after a PR's review accepts, routed to a different (non-Claude) model, not the jury skill's own internal step. Findings write to the evidence record (depends on #3949). Depends on #3949 and on the ADVISORY-lens routing card (this session's card 1, 4194) for the same codex/gemini dispatch plumbing.

## Done when

1. **Executable** — a test shows a PR whose review verdict is `accept` gets a red-team dispatch attempt to a non-Claude provider, and a PR whose verdict is not `accept` gets none — fails before this lands (no post-accept red-team dispatch exists on the mechanical review path today) and passes after.
2. **Live proof** — on one real build or fix PR that reaches `accept`, trigger the red-team pass; before/after: `gh pr view` shows the red-team's run (comment or check), and the evidence record gains a row for its verdict (break found → `changes`, clean → the accept stands), fail-closed exactly as `we:scripts/lib/jury-core.mjs#foldRedTeamVerdict` already fails closed for the in-loop jury case.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
