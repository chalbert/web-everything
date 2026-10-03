---
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/codemod-replay.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Wide mechanical changes land as a barrier and open PRs replay the codemod instead of a textual rebase

Operator pain 2026-10-03: a bulk rename put open PRs into conflict, and each conflict then costs a fix-agent round plus a full CI run. Prior art: Google's Rosie splits a large mechanical change by ownership into independently submittable pieces with one global approver, and regenerates the change on fresh trunk rather than nursing stale patches (Software Engineering at Google, ch. 22); Mergify barriers serialize the queue around a change that touches everything. Design: a PR may declare itself mechanical by naming a codemod script and its version in its lane manifest. (1) Barrier: the drain lands it with no other ready PR whose files intersect it landing in between. (2) Replay: after it lands, for each open PR that now conflicts on files the codemod touched, apply the same codemod to the PR branch first and then merge main; both sides then hold the same rename, so git merges cleanly, and references the PR added get renamed too. Only if the replay still conflicts does the normal conflict-fix dispatch run. (3) Optional sharding by top-level area when the change spans three or more areas. Codemods must be deterministic and idempotent; a replay is an ordinary push to the PR branch, so CI and review rules apply as for any push. Scope: we:scripts/merge-ai-prs.mjs, we:scripts/conveyor/reconcile-fix-dispatch.mjs, a new we:scripts/lib/codemod-replay.mjs. Survey: we:reports/2026-10-03-delivery-strategy-survey-and-decider.md. Done when: a replay of a real rename against two open PRs that touch renamed files ends with both mergeable and no conflict-fix agent dispatched, with before and after evidence; unit tests cover the barrier hold and the replay order.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
