---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/guard-stop-passive-wait.mjs", "we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Session reply and report format: which parts of the closing tail are script-decidable, and is a renderer warranted at all

FOUND 2026-09-20. The end-of-turn tail of a session reply is composed by hand each turn: a short list of what changed, a "Needs you" list, a "what changed since the handoff" block, and a plain-version paragraph. The rules live in two places, and both are instructions, not mechanism: the operator's global personal instructions file (brief by default, an actionable tail, a Plain version paragraph, the on-demand simple version) and the deployed /continue command ("what changed since the handoff" in under 100 words; "Needs you" is the NEEDS YOU section of the operator queue script printed verbatim and nothing else). 

Nothing checks that a reply followed them, and the global instructions file is not in the repository.

Precedents in the repository, read 2026-09-20. (1) we:scripts/lib/review-core.mjs already renders recurring outbound text from structured data: `renderDrainRunSummary`, `renderReviewNotice` and `renderCloseSessionFlowLine` (#2433, "template the render, not the prose"). (2) A Stop hook already reads the final message: we:scripts/guard-stop-passive-wait.mjs, wired in we:.claude/settings.json for Stop and SubagentStop, reads a bounded tail of the transcript and can block. So both a renderer and a checker have a precedent. The hookable-versus-judgment rule (memory index item 51: script-decidable goes to a hook, judgment stays as instruction) is the test to apply.

OVERLAP, NAMED. None covers the reply format. Related and distinct: #3736 (compact phone-first /wip tables: a report, not a reply), #3775 and the start-of-session state pass card filed alongside (they would produce the counts this tail prints).

FIRST-CUT CLASSIFICATION (to be verified in the design review).
- Script-decidable: "Needs you", the NEEDS YOU section of we:scripts/operations/operator-queue.mjs verbatim (empty means print nothing about it); the count lines (open PRs, sessions live versus dead, workers); the "what changed since the handoff" list from git and `gh` (pull requests merged, cards filed since a stated reference point); the presence of result files.
- Judgment: which changes matter, the recommendation, the plain-version paragraph and its wording, whether a message is long enough to need a tail at all.

DESIGN TO SETTLE.
1. Whether a renderer is warranted at all. "No: keep as instructions" is a valid outcome, for example when the state report from the start-of-session card already prints the Needs-you and count blocks and the model only pastes them. Cost of a renderer: one more format to maintain and a second source of tone. Benefit: "Needs you" cannot be embellished, which the /continue text has to forbid in prose today.
2. If something is built, which shape: (a) the state report emits the Needs-you and count blocks and the model pastes them; (b) a renderer that takes the needs-you text, the counts and the changes list and prints the tail, with the model supplying only the judgment lines; (c) a Stop-hook checker that only verifies (a reply that prints a Needs-you list must equal the script's output; a long reply must end with a tail) and never writes.
3. Where the rules live so the model and any renderer share one copy: the global instructions file cannot be checked in, so decide whether the repository carries the source of truth (a project command or skill) and the global file points at it.
4. The "what changed since the handoff" reference point (the handoff file's timestamp or a commit) and its source.
5. The failure to avoid: a rendered block the model then contradicts in the sentences around it.

## Done when

1. **Executable** — the card's design records a classification table (script-decidable versus judgment, per part of the tail) and the chosen shape among (a), (b), (c) or "keep as instructions". If the choice is "keep as instructions", the item resolves with that finding and nothing is built.
2. **Executable** — if a renderer or checker is chosen, a test with reply fixtures: a reply whose Needs-you text equals the fixture operator queue output passes, a reply that adds a pull request that is not in the output fails, and an empty NEEDS YOU section prints nothing about it.
3. **Human verify** — the operator confirms the parts that stay judgment and that the tail on a long reply still reads as they want.
